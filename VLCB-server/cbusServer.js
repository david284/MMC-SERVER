const winston = require('winston');
const name = 'cbusServer.js'
const net = require('net')

const utils = require('./utilities.js');
//const canUSB = require('./canUSB')
const canUSBX = require('../VLCB-server/canUSBX');
const { get } = require('http');


//
// cbusServer - many to one adapter
// connects to a single serial port to interface to the CAN bus
// accepts connections from multiple network clients
// Intended to be used with 'modified Grid Connect' format messages
//


class cbusServer {
  constructor(CbusServerPort) {
    winston.info({message: name + `: Constructor: port ${CbusServerPort}`});
    this.clients = []
    this.enableSerialReconnect = false
    this.serialConnected = false

    //
    //
    this.server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000)
      this.clients.push(socket)
      winston.info({message: name + `: Client Connection received`})

      socket.on('data', function (data) {
          let outMsg = data.toString().split(";");
          for (let i = 0; i < outMsg.length - 1; i++) {
            canUSBX.write(outMsg[i] + ';')
            this.broadcast(outMsg[i] + ';', socket)
          }
      }.bind(this));

      socket.on('end', function () {
          this.clients.splice(this.clients.indexOf(socket), 1)
          winston.info({message: name + `: Client Disconnected`})
      }.bind(this))

      socket.on("error", (err) => {
        winston.info({message: name + `: socket error:`})
      })

    }.bind(this)) //end create server

    // now start the listener...
    winston.info({message: name + `: connect: starting listener on port ${CbusServerPort}`})

    this.server.listen(CbusServerPort, () => {
      winston.info({message: name + ': connect: listener bound '})
    })
    
    //
    //
    canUSBX.on('data', function (data) {
      //winston.info({message: name + `: emitted:  ${JSON.stringify(data)}`})
      let outMsg = data.toString().split(";");
      for (let i = 0; i < outMsg.length - 1; i++) {
        // don't specify socket as it doesn't have one
        this.broadcast(outMsg[i] + ';')
      }
    }.bind(this))
    
    //
    //
    canUSBX.on('close', function () {
      winston.info({message: name + `: serial port close:`})
      this.serialConnected = false
    }.bind(this))

    //
    //
    canUSBX.on('error', function (data) {
      winston.info({message: name + `: serial port error:  ${JSON.stringify(data)}`})
    }.bind(this))

    setInterval(this.serialConnectIntervalFunction.bind(this), 2000);

} // end constructor

  //
  // separate connect method so the instance can be passed
  // and the connection made later when the parameters are known
  //
  async connect(targetSerial){
    // connect to serial port
    let result = await canUSBX.connect(targetSerial)

    if (result == false){
      // close server - should raise error on clients
      winston.info({message: name + ': failed to connect to serial port ' + targetSerial});
      this.serialConnected = false
      this.enableSerialReconnect = false
      this.close()
    }  else {
      this.serialConnected = true
      this.enableSerialReconnect = true
    }
    return result
  } // end connect

  //
  // method to close the listener
  // Essential for unit testing, so that we can close the connection & open it again
  //
  close(){
    winston.info({message: name + ': close:'});
    this.server.removeAllListeners()
    this.server.close()
  }

  //
  //
  broadcast(data, sender) {
    this.clients.forEach(function (client) {
        // Don't want to send it to sender
        if (client === sender)
            return
        if (data.length > 8) {
            client.write(data)
            //winston.info({message: `CbusServer Broadcast : ${data.toString()}`})
        } else {
            winston.info({message: name + `: CbusServer Invalid Message : ${data.toString()}`})
        }
    })
  } // end broadcast



  serialConnectIntervalFunction(){
    winston.info({message:name + ': serialConnectIntervalFunction:'})
  
    if(this.enableSerialReconnect){
      winston.info({message:name + ': serial port reconnect enabled:'})
      if(this.serialConnected){
        winston.info({message:name + ': serial port still connected:'})
      } else {
        winston.info({message:name + ': serial port not connected:'})
        //this.connect(this.clientHost, this.clientPort)
      }
    }
    
  }

}

module.exports = (CbusServerPort) => { return new cbusServer(CbusServerPort) }

