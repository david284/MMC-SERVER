const winston = require('winston');
const name = 'cbusServer.js'
const net = require('net')

const utils = require('./utilities.js');
const serialGC = require('../VLCB-server/serialGC.js');
const { get } = require('http');

//
// cbusServer - many to one adapter
// connects to a single serial port to interface to the CAN bus
// accepts connections from multiple network clients
// Intended to be used with 'modified Grid Connect' format messages
//

class cbusServer {
  constructor(config) {
    winston.info({message: name + `: Constructor`});
    this.config = config
    this.clients = []
    this.enableSerialReconnect = false
    this.serialConnected = false
    this.targetSerial = null
    this.cbusServerPort = null

    //
    //
    this.server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000)
      this.clients.push(socket)
      winston.info({message: name + `: Client Connection received`})

      //
      //
      socket.on('data', function (data) {
          let outMsg = data.toString().split(";");
          for (let i = 0; i < outMsg.length - 1; i++) {
            serialGC.write(outMsg[i] + ';')
            this.broadcast(outMsg[i] + ';', socket)
          }
      }.bind(this));

      //
      //
      socket.on('end', function () {
          this.clients.splice(this.clients.indexOf(socket), 1)
          winston.info({message: name + `: Client Disconnected`})
      }.bind(this))

      //
      //
      socket.on("error", (err) => {
        winston.error({message: name + `: socket error:`})
      })

    }.bind(this)) //end create server

    //
    //
    this.server.on("error", function (err) {
      winston.error({message: name + `: server error: ` + err})
      let captionText = err.toString()
      let data = {
        message: "cbusServer error",
        caption: captionText,
        type: "warning",
        timeout: 0
      }
      this.config.eventBus.emit ('SERVER_NOTIFICATION', data)
    }.bind(this))

    //
    //
    serialGC.on('data', function (data) {
      //winston.info({message: name + `: emitted:  ${JSON.stringify(data)}`})
      let outMsg = data.toString().split(";");
      for (let i = 0; i < outMsg.length - 1; i++) {
        // don't specify socket as it doesn't have one
        this.broadcast(outMsg[i] + ';')
      }
    }.bind(this))
    
    //
    //
    serialGC.on('close', function (data) {
      winston.info({message: name + `: serial port closed:`})
      this.serialConnected = false
      // restart timer so we start with the correct time gap
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = setInterval(this.serialConnectIntervalFunction.bind(this), 5000);
      let eventData = {
        message: "Serial port closed",
        caption: data,
        type: "warning",
        timeout: 3000
      }
      this.config.eventBus.emit ('SERIAL_CONNECTION_FAILURE', eventData)
    }.bind(this))

    //
    //
    serialGC.on('error', function (data) {
      winston.info({message: name + `: serial port error:  ${JSON.stringify(data)}`})
      this.serialConnected = false
      let eventData = {
        message: `Serial port error - not connected: ${this.targetSerial}`,
        caption: data,
        type: "warning",
        timeout: 3000
      }
      this.config.eventBus.emit ('SERIAL_CONNECTION_FAILURE', eventData)
    }.bind(this))

    //
    //
    serialGC.on('open', function (message) {
      winston.info({message: name + `: serial port open: ${message}`})
      this.serialConnected = true
      let data = {
        message: "Serial port connected",
        caption: message,
        type: "info",
        timeout: 500
      }
      this.config.eventBus.emit ('SERVER_NOTIFICATION', data)
    }.bind(this))

    this.reconnectTimer = setInterval(this.serialConnectIntervalFunction.bind(this), 5000);

} // end constructor

  //
  // separate connect method so the instance can be passed
  // and the connection made later when the parameters are known
  // need to supply port number so unit tests can use a different port
  //
  async connect(CbusServerPort, targetSerial){

    // now start the listener...
    winston.info({message: name + `: connect: starting cbusServer listener on port ${CbusServerPort}`})
    this.cbusServerPort = CbusServerPort

    if (!this.server.listening){
      // don't do this if already listening
      this.server.listen(CbusServerPort, () => {
        winston.info({message: name + ': connect: listener bound '})
      })
    }

    let result = false
    let startTime = Date.now()
    while (Date.now() < startTime + 2000){
      if (this.server.listening){
        result = true
        break
      }
    }

    if (result){
      await this.connectSerialGC(targetSerial)
    } else {
      winston.error({message: name + ': connect: listen failed '})
    }

    return result
  } // end connect

  //
  // method to connect to serial port
  // can be called again to re-connect if initial connection lost
  //
  async connectSerialGC(targetSerial){

    winston.info({message: name + ': Connecting to serial port ' + targetSerial});
    this.targetSerial = targetSerial
    // connect to serial port
    let result = await serialGC.connect(this.targetSerial)

    if (result == false){
      // connection failed
      // restart timer so we start with the correct time gap
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = setInterval(this.serialConnectIntervalFunction.bind(this), 5000);
      winston.info({message: name + ': failed to connect to serial port ' + this.targetSerial});
      let data = {
        message: `Serial port failed to connect: ${this.targetSerial}`,
        caption: this.targetSerial,
        type: "warning",
        timeout: 3000
      }
      this.config.eventBus.emit ('SERIAL_CONNECTION_FAILURE', data)
      this.serialConnected = false
      this.enableSerialReconnect = true
    }  else {
      // connection worked, so set reconnection flags to true
      this.serialConnected = true
      this.enableSerialReconnect = true
    }
    return result
  }

  //
  // method to close the listener
  // Essential for unit testing, so that we can close the connection & open it again
  //
  close(){
    winston.info({message: name + ': close:'});
    this.server.removeAllListeners()
    this.server.close()
    if (this.serialGC){
      this.serialGC.close()
    }
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

  //
  // Will be called on a regular basis to reconnect to serial port if connection lost
  // but checks if reconnect is enabled first
  //
  serialConnectIntervalFunction(){
    winston.debug({message:name + `: serialConnectIntervalFunction: ${this.targetSerial}`})
    if(this.enableSerialReconnect){
      winston.debug({message:name + `: serial port reconnect enabled: ${this.targetSerial}`})
      if(this.serialConnected){
        winston.debug({message:name + `: serial port still connected: ${this.targetSerial}`})
      } else {
        winston.info({message:name + `: serial port not connected: ${this.targetSerial}`})
        this.connectSerialGC(this.targetSerial)
      }
    }
  }

}

module.exports = (config) => { return new cbusServer(config) }

