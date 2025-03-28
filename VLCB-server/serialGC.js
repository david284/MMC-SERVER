const winston = require('winston');
const name = 'serialGC.js'
winston.info({message: name + `: loaded`})
const EventEmitter = require('events').EventEmitter;

//const SerialPort = require("chrome-apps-serialport").SerialPort;
const { SerialPort } = require("serialport");
const { MockBinding } = require('@serialport/binding-mock')
let cbusLib = require('cbuslibrary')


/*
*
* @desc class to connect to a serial port and uses (modified) Grid Connect serial formatted data<br>
* Performs basic checks on (modified) Grid Connect message syntax, logs errors if checks fail
*
*/

class serialGC  extends EventEmitter {

  constructor(){
    winston.debug({message: name + `: constructor`})
    super();
    this.serialPort = undefined
    this.targetSerialPort = ''
    this.RxBuffer = ""
  } // end constructor

  async connect(targetSerialPort){
    winston.debug({message: name + `: connect: ${targetSerialPort}`})

    winston.info({message: name + ': trying serialport.list '});
    var serialPorts = await this.getSerialPorts()
    winston.debug({message: name + ': serialports ' + JSON.stringify(serialPorts)});

    if (targetSerialPort){
      this.targetSerialPort = targetSerialPort
    } else {
      this.targetSerialPort = await this.getCANUSBx()
    }

    winston.info({message: name + `: starting on ${this.targetSerialPort}`})

    if(this.targetSerialPort == "MOCK_PORT"){
      MockBinding.createPort('MOCK_PORT', { echo: false, record: true })
      this.serialPort = new SerialPort({binding: MockBinding, path:'MOCK_PORT', baudRate: 115200});
    }
    else if(this.targetSerialPort) {     
      // 'standard' serialport
      this.serialPort = new SerialPort({
        path: this.targetSerialPort,
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      })
      if (!this.serialPort) {return false}
    } else{
      // no connection found
      winston.error({message: name + `: no connection to ${this.targetSerialPort}`})
      return false
    }

    this.serialPort.on("open", function () {
      winston.info({message: name + `: Serial port: ${targetSerialPort} Open`})
      this.emit('open', this.targetSerialPort)
    }.bind(this))
      
    this.serialPort.on("close", function () {
      winston.info({message: name + `: Serial port: ${targetSerialPort} close`})
      this.emit('close', this.targetSerialPort)
    }.bind(this))
      
    this.serialPort.on("data", function (data) {
      //winston.debug({message: name + `: data Rx ${data}`})
      this.RxBuffer += data
      let messageArray = this.RxBuffer.split(';')
      if (messageArray.length > 1){
        for (var i=0; i < messageArray.length-1; i++ ){
          //winston.debug({message: name + `: ${targetSerialPort} Rx ${messageArray[i]};`})
          let message = this.getValidMessage(messageArray[i]);    // rebuild message as string
          if (message) {
              let cbusMsg = cbusLib.decode(message)
              winston.info({message: name + `: ${targetSerialPort} RX <- ${message} ${cbusMsg.mnemonic} Opcode ${cbusMsg.opCode}`})
              this.emit('data', message)
          }
        }
        this.RxBuffer = messageArray[messageArray.length-1]
      }
    }.bind(this))

    this.serialPort.on("error", function (err) {
        winston.error({message: name + `: Serial port ERROR:  : ${err.message}`})
        this.emit('error', err.message)
      }.bind(this));

    return true
  }  // end connect

  close(){
    this.serialPort.close()
  }
    
  write(data){
    if (this.serialPort){
      let outMsg = data.toString().split(";")
      for (let i = 0; i < outMsg.length - 1; i++) {
        let message = this.getValidMessage(outMsg[i]);    // rebuild message as string
        if (message) {
          let cbusMsg = cbusLib.decode(message)
          winston.info({message: name + `: ${this.targetSerialPort} TX -> ${message} ${cbusMsg.mnemonic} Opcode ${cbusMsg.opCode}`})
          this.serialPort.write(message)
          //winston.debug({message: name + `: ${this.targetSerialPort} Tx ${message}`})
        }
      }
    }
  }

  /**
  * @desc checks 'Grid Connect' message syntax & return a valid message<br>
  * @param {Object} message - a message up to but NOT including the terminating character ';'
  * @return {string} returns a validated message or 'undefined' if message is unusable
  *
  */
  getValidMessage(data) {
    data = data.toString() + ';';       // replace lost terminator
    
    // now split up by the starting character - if there's just one starting character as expected we'll get two elements
    // with the expected message in the second element
    var array = data.split(':');
    
    if (array.length == 1) {
        // no starting character found
        // so incomplete message - can't return a valid message
        winston.error({message: `message rejected - missing starting character: ${data.toString()}`})
        return undefined;
    }
    
    if (array.length == 2) {
        if (array[0].length > 0) {
            // unexpected characters before starting character
            // these will be ignored later - but post error anyway
            winston.error({message: `unexpected characters in message: ${data.toString()}`})
        }
    }
    
    // if more than one element, then there is at least one starting character
    if (array.length > 2) {
        // more than one starting character, so potentially two (or more) messages merged
        // can still use the last message, but generate an error log anyway
        winston.error({message: `multiple starting characters in message: ${data.toString()}`})
    }
    
    // get the last array element
    // need to replace the starting character lost in the 'split' operation
    let message = ':' + array[array.length - 1].toString()


    // now check that it's either an 'S' or 'X' type of message - the type is in a fixed position
    if ( (message[1] != 'S') && (message[1] != 'X') ) {
        winston.error({message: `message rejected - unknown Identifier type: ${message}`})
        return undefined;
    }
    

    // there are only two transmission types defined, 'N' & 'R'
    // use regex to split on either N or R - the position isn't fixed, as it depends on ID length
    // and we can use the result of the split for multiple checks
    let splitMessage = message.split(/N|R/);

    if (splitMessage.length == 1) {
        // if 1 then not N or R - unknown transmission type - so reject message
        winston.error({message: `message rejected - unknown Transmission type: ${message}`})
        return undefined;
    }

    if (splitMessage.length > 2) {
        // we already have the split, so can easily use it to check for unwanted multiple instances
        winston.error({message: `message rejected - unexpected N or R characters in message: ${message}`})
        return undefined;
    }
    
    // First element of split contains the type and Identifier - we've already tested type above, so check identifier
    // CBUS differs from Grid Connect in this identifier - for CBUS it is either 4 or 8 characters, not a variable length
    if (message.includes('S')) {
        // Standard identifier - 11 bits, so 4 characters, plus start & type gives 6 characters
        if ( splitMessage[0].length != 6 ) {
            winston.error({message: `message rejected - Standard Identifier field wrong length: ${message}`})
            return undefined;
        }
    }
    if (message.includes('X')) {
        // eXtended identifier - 29 bits, so 8 characters, plus start & type gives 10 characters
        if ( splitMessage[0].length != 10 ) {
            winston.error({message: `message rejected - Extended Identifier field wrong length: ${message}`})
            return undefined;
        }
    }

    // 2nd element is data field of 0 to 16 hex characters (8 bytes) plus the terminator - so 1 to 17 characters
    // we added the terminator earlier, and tested for it, so only test for maximum value
    if ( splitMessage[1].length > 17 ) {
        winston.error({message: `message rejected - Data field too long: ${message}`})
        return undefined;
    }

    return message;
  }

  async getCANUSBx(){
    return new Promise(function (resolve, reject) {
      winston.debug({message: name + `: getCANUSBx`})
      SerialPort.list().then(ports => {
        ports.forEach(function(port) {
          if (port.vendorId != undefined && port.vendorId.toString().toUpperCase().includes('4D8') && port.productId.toString().toUpperCase().includes('F80C')) {
            // CANUSB4
            winston.debug({message: name + ': CANUSB4 found on ' + port.path});
            resolve(port.path);
          } else if (port.vendorId != undefined && port.vendorId.toString().toUpperCase().includes('403') && port.productId.toString().toUpperCase().includes('6001')) {
            // Old CANUSB
            winston.debug({message: name + ': CANUSB found on ' + port.path});
            resolve(port.path);
          }
        })
        resolve(undefined);
      })
    })
  } // end connectCANUSBx

  //
  //
  async getSerialPorts() {
    return new Promise(function (resolve, reject) {
      var serialports= [];
      var portIndex = 0;
      SerialPort.list().then(ports => {
        ports.forEach(function(port) {
          serialports[portIndex] = port
          winston.info({message: 'serial port ' + portIndex + ': ' + serialports[portIndex].path});
          winston.debug({message: 'serial port ' + portIndex + ': ' + JSON.stringify(serialports[portIndex])});
          portIndex++
        })
        if (portIndex == 0){
          winston.info({message: 'No active serial ports found...\n'});
        }
        resolve(serialports);
      })
    })
  } // end getSerialPorts
  


}

module.exports = new serialGC()


    

    
    

  






