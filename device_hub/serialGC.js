'use strict';
const winston = require('winston');		// use config from root instance
const {SerialPort} = require("serialport");
const { ReadlineParser } = require('@serialport/parser-readline')
const { MockBinding } = require('@serialport/binding-mock')

const cbusLib = require('cbuslibrary');

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block sscope (like let), and can't be changed through reassigment or redeclared


class SerialGC {

  constructor(USB_PORT){
    this.messagesIn = [];
    this.testStarted = false;  
    this.callback = this.dummyFunction;

  
    if(USB_PORT == "MOCK_PORT"){
      MockBinding.createPort('MOCK_PORT', { echo: false, record: true })
      this.serialPort = new SerialPort({binding: MockBinding, path:'MOCK_PORT', baudRate: 115200});
    } else {
      
      this.serialPort = new SerialPort({
        path: USB_PORT,
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      })
    }

    winston.debug({message: 'SerialGC: Connecting to ' + USB_PORT + '\n'});

    // grid connect message end with ';'
    this.GCparser = this.serialPort.pipe(new ReadlineParser({ delimiter: ';' }))

    // debug message end with ':'
    this.debugParser = this.serialPort.pipe(new ReadlineParser({ delimiter: ':' }))

    this.serialPort.on("open", function () {
      winston.debug({message: `SerialGC: Serial Port: ${USB_PORT} Open`})
    }.bind(this));
    
    this.GCparser.on('data', function (serialData) {
      winston.debug({message: 'SerialGC: GC parser <<< receive serial data: ' + serialData});
      // we want the last portion of the string that starts with ':' and ends with ';'
      // we want to drop any characters before that, including any extra ':' characters
      const msgArray = serialData.toString().split(":");
      // get last element that we really want & restore start & end characters
      var message = ':' + msgArray[msgArray.length-1] + ';'
      var decodedMsg = cbusLib.decode(message)
      this.messagesIn.push(decodedMsg)
      if (this.testStarted) {
        winston.info({message: `VLCB:      <<< Received: ${message} ${decodedMsg.text}`})
      }
      this.callback(decodedMsg);
    }.bind(this));

    this.debugParser.on('data', function (serialData) {
//      winston.debug({message: 'SerialGC: debug parser <<< receive serial data: ' + serialData});
      // we want the last portion of the string that starts with ';' and ends with ':'
      // we want to drop any characters before that, including any extra ';' characters
      const msgArray = serialData.toString().split(";");
      var message = msgArray[msgArray.length-1]
      if(message.length > 0) {
        winston.info({message: 'VLCB: <<< module debug output: ' + message});
      }
    }.bind(this));

    this.serialPort.on("error", function (err) {
      winston.error({message: `SerialGC: Serial port ERROR:  : ${err.message}`})
      process.exit();
    }.bind(this));


  } // end constructor


  write(msgData) {
    var decodedMsg = cbusLib.decode(msgData);
    this.serialPort.write(msgData)
    winston.debug({message: 'SerialGC: Transmit >>> ' + decodedMsg.encoded + ' ' + decodedMsg.text});		
    winston.info({message: 'VLCB:      >>> transmitted: ' + decodedMsg.encoded + ' ' + decodedMsg.text}); 
  }

	closeConnection(){
    this.serialPort.close();
	}
	

	dummyFunction(msg) {
    // do nothing - this function will be replaced at runtime
  }

} // end class

module.exports = {
  SerialGC: SerialGC
}