const winston = require('winston');
const name = 'cbusServer.js'
const net = require('net')

const utils = require('./utilities.js');
//const SerialPort = require("chrome-apps-serialport").SerialPort;
const {SerialPort} = require("serialport");
const canUSB = require('./canUSB')


//
// cbusServer - connects to a serial port to interface to the CAN bus
// accepts connections from multiple network clients
// Intended to be used with 'modified Grid Connect' format messages
//


module.exports = class cbusServer {
  constructor() {
    winston.info({message: name + ': Constructor'});
    this.clients = []

    this.server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000)
      this.clients.push(socket)
      winston.info({message: name + `: Client Connection received`})
      //console.log(name + `: Client Connected to Server')
      socket.on('data', function (data) {
          let outMsg = data.toString().split(";");
          for (let i = 0; i < outMsg.length - 1; i++) {
              this.broadcast(outMsg[i] + ';', socket)
              //console.log('Server Broadcast : ' + data.toString());
          }
      }.bind(this));

      socket.on('end', function () {
          this.clients.splice(this.clients.indexOf(socket), 1)
          //console.log('Client Disconnected')
          winston.info({message: name + `: Client Disconnected`})
      }.bind(this))

      socket.on("error", function (err) {
          this.clients.splice(clients.indexOf(socket), 1)
          //console.log("Caught flash policy server socket error: ")
          //console.log(err.stack)
          winston.info({message: name + `: socket error:   : ${err.stack}`})
      }.bind(this))

    }.bind(this)) //end create server

  } // end constructor

  //
  // separate connect method so the instance can be passed
  // and the connection made later when the parameters are known
  //
  async connect(CbusServerPort, targetSerial){
    var result = false
    // now start the listner...
    winston.info({message: name + ': starting listner '});
    this.server.listen(CbusServerPort)

    // use target serial port if it exists
    // otherwise look for a CANUSBx
    winston.info({message: name + ': trying serialport.list '});
    var serialPorts = await this.getSerialPorts()
    winston.debug({message: name + ': serialports ' + JSON.stringify(serialPorts)});

    if (targetSerial){
      winston.info({message: name + ': Using serial port ' + targetSerial});
      if (serialPorts.find(({ path }) => path === targetSerial) ){
        canUSB.canUSB(targetSerial, CbusServerPort, 'localhost')
        result = true
      } else {
        winston.info({message: name + ': serial port ' + targetSerial + ' not found'});
        // close server - should raise error on clients
        this.close()
        result = false
      } 
    } else {
      winston.info({message: 'Finding CANUSBx...'});
      if ( await this.connectCANUSBx(CbusServerPort, 'localhost') ) {
        result = true
      } else {
        winston.info({message: name + ': Failed to find CANUSBx...'});
        // close server - should raise error on clients
        this.close()
        result = false
      }
    }
    return result
  } // end connect

  //
  // method to close the listner
  // Essential for unit testing, so that we can close the conenction & open it again
  //
  close(){
    winston.info({message: name + ': close:'});
    this.server.removeAllListeners()
    this.server.close()
  }


  broadcast(data, sender) {
    this.clients.forEach(function (client) {
        // Don't want to send it to sender
        if (client === sender)
            return
        if (data.length > 8) {
            client.write(data)
            //winston.info({message: `CbusServer Broadcast : ${data.toString()}`})
        } else {
            //console.log('Server Broadcast : ' + data.toString())
            winston.info({message: name + `: CbusServer Invalid Message : ${data.toString()}`})
        }
    })
  } // end broadcast

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
  
  async connectCANUSBx(CbusServerPort){
    return new Promise(function (resolve, reject) {
      SerialPort.list().then(ports => {
        ports.forEach(function(port) {
          if (port.vendorId != undefined && port.vendorId.toString().toUpperCase().includes('4D8') && port.productId.toString().toUpperCase().includes('F80C')) {
            // CANUSB4
            winston.info({message: 'CANUSB4 : ' + port.path});
            canUSB.canUSB(port.path,  CbusServerPort, 'localhost')
            resolve(true);
          } else if (port.vendorId != undefined && port.vendorId.toString().toUpperCase().includes('403') && port.productId.toString().toUpperCase().includes('6001')) {
            // Old CANUSB
            winston.info({message: 'CANUSB : ' + port.path});
            canUSB.canUSB(port.path, CbusServerPort, 'localhost')
            resolve(true);
          }
        })
        resolve(false);
      })
    })
  } // end connectCANUSBx
  
}

