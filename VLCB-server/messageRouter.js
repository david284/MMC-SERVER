'use strict';
const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance
const utils = require('./utilities.js');

//
// messageRouter for 'Modified Grid Connect' (MGC) messages
// many to one connection
// links event based send/receive messages to a single socket connection (cbusServer or remote equivalent)
// also writes the busTraffic events
//

const name = 'messageRouter'

class messageRouter{

  constructor(configuration) {
    winston.info({message: name + ':  Constructor:'});
    this.cbusClient = new net.Socket()
    this.config = configuration
    this.eventBus = configuration.eventBus
    this.connectInterval = setInterval(this.connectIntervalFunction.bind(this), 5000);
    this.enableReconnect = false
    this.connected = false
    this.cbusClientHost = null
    this.cbusClientPort = null
    this.connectPromise = null

    //
    // Setup the handlers for cbusClient events
    // but doesn't actually connect to cbusServer yet
    //

    this.cbusClient.on('data', function (data) {
      winston.debug({message:name + `: cbusClient: data : ${data}`})
      this.connected = true
      this.cbusClient.setKeepAlive(true, 60000);
      let GCmsg = data.toString().split(";");
      for (let i = 0; i < GCmsg.length - 1; i++) {
        // restore terminating ';' lost due to split & then decode
        winston.debug({message: name + `:  GRID_CONNECT_RECEIVE ${GCmsg[i] + ';'}`})
        let cbusLibMsg = cbusLib.decode(GCmsg[i] + ';')
        winston.info({message: name + ': GRID_CONNECT_RECEIVE ' + cbusLibMsg.text});
        this.config.writeBusTraffic('<<<IN ' + cbusLibMsg.encoded + ' ' + cbusLibMsg.text)
        this.config.eventBus.emit ('GRID_CONNECT_RECEIVE', GCmsg[i] + ';')
        this.config.eventBus.emit ('CBUS_TRAFFIC', {timeStamp: utils.getTimestamp(), direction: 'In', json: cbusLibMsg})
      }
    }.bind(this));

    this.cbusClient.on('connection', function () {
      winston.debug({message:name + `: cbusClient: on connection:`})
    })

    this.cbusClient.on('connectionAttempt', function () {
      winston.debug({message:name + `: cbusClient: on connectionAttempt:`})
    })

    this.cbusClient.on('connectionAttemptFailed', function () {
      winston.debug({message:name + `: cbusClient: on connectionAttemptFailed:`})
    })

    this.cbusClient.on('connectionTimeout', function () {
      winston.debug({message:name + `: cbusClient: on connectionTimeout:`})
    })

    this.cbusClient.on('error', async function (err) {
      winston.error({message: name + `: cbusClient error: ` + err.stack});
      this.handleNetworkFailure()
    }.bind(this))

    this.cbusClient.on('close', function () {
      this.handleNetworkFailure(true)
    }.bind(this))

    this.gridConnectSendHandler = function (data) {
      let cbusLibMsg = cbusLib.decode(data)
      winston.info({message: name + ': GRID_CONNECT_SEND ' + cbusLibMsg.text});
      winston.debug({message: name + `:  GRID_CONNECT_SEND ${data}`})
      this.sendCbusMessage(data)
    }.bind(this)
    this.config.eventBus.on('GRID_CONNECT_SEND', this.gridConnectSendHandler)

  }

  handleNetworkFailure(onlyIfConnected = false){
    if (onlyIfConnected && !this.connected) {
      return
    }
    let caption = `IP: ${this.cbusClientHost}  Port: ${this.cbusClientPort}`
    winston.error({message: name + `: cbusClient error: ` + caption});
    let eventData = {
      message: "Network error - retrying connection",
      caption: caption,
      type: "warning",
      timeout: 3000
    }
    this.eventBus.emit ('NETWORK_CONNECTION_FAILURE', eventData)
    this.enableReconnect = true
    this.connected = false
  }

  //
  // method to actually connect to cbusServer
  //
  connect(remoteAddress, cbusPort){
    this.cbusClientHost = remoteAddress
    this.cbusClientPort = cbusPort
    winston.info({message:name + ': try Connect ' + remoteAddress + ' on ' + cbusPort})

    if (this.connected) {
      return Promise.resolve()
    }

    if (this.connectPromise) {
      return this.connectPromise
    }

    // connect to remote socket for CBUS messages
    this.connectPromise = new Promise((resolve, reject) => {
      const cleanup = () => {
        this.cbusClient.removeListener('connect', onConnect)
        this.cbusClient.removeListener('error', onError)
        this.cbusClient.removeListener('close', onClose)
      }

      const onConnect = () => {
        cleanup()
        let message = 'Connected to ' + remoteAddress + ' on ' + cbusPort
        winston.info({message:name + ': ' + message})
        this.connected = true
        let data = {
          message: "Network port connected",
          caption: message,
          type: "info",
          timeout: 500
        }
        this.config.eventBus.emit ('SERVER_NOTIFICATION', data)
        this.enableReconnect = true
        resolve()
      }

      const onError = (error) => {
        cleanup()
        reject(error)
      }

      const onClose = () => {
        cleanup()
        reject(new Error('Connection closed before it was established'))
      }

      this.cbusClient.once('connect', onConnect)
      this.cbusClient.once('error', onError)
      this.cbusClient.once('close', onClose)

      try {
        this.cbusClient.connect(cbusPort, remoteAddress)
      } catch (error) {
        cleanup()
        reject(error)
      }

      if (this.cbusClient){
        winston.info({message:name + ': cbusClient connection succeeded: '})
        winston.info({message:name + ': cbusClient socket: ' +JSON.stringify(this.cbusClient)})
        winston.info({message:name + ': cbusClient: readyState ' + this.cbusClient.readyState})
      } else {
        winston.info({message:name + ': cbusClient connection failed: '})
      }
    }).finally(() => {
      this.connectPromise = null
    })

    return this.connectPromise
  }

  connectIntervalFunction(){
    winston.debug({message:name + ': cbusClient check connection:'})
    if (this.cbusClient.readyState == 'opening'){
      let data = {
        message: "Network port opening",
        type: "info",
        timeout: 500
      }
      this.config.eventBus.emit ('SERVER_NOTIFICATION', data)
    }
    if(this.enableReconnect){
      winston.debug({message:name + ': cbusClient reconnect enabled:'})
      if(this.connected){
        winston.debug({message:name + ': cbusClient still connected:'})
      } else {
        winston.info({message:name + ': cbusClient not connected:'})
        this.connect(this.cbusClientHost, this.cbusClientPort).catch(function (error) {
          winston.debug({message:name + ': cbusClient reconnect failed: ' + error.message})
        })
      }
    }
  }

  //
  // outputs an already encoded message
  //
  sendCbusMessage(cbusMSG){
    let outMsg = cbusLib.decode(cbusMSG)
    this.config.writeBusTraffic('OUT>> ' + outMsg.encoded + ' ' + outMsg.text)
    this.config.eventBus.emit ('CBUS_TRAFFIC', {timeStamp: utils.getTimestamp(), direction: 'Out', json: outMsg})
    this.cbusClient.write(cbusMSG)
  }

  async close(){
    this.enableReconnect = false
    this.connected = false
    clearInterval(this.connectInterval)
    this.config.eventBus.removeListener('GRID_CONNECT_SEND', this.gridConnectSendHandler)

    if (this.cbusClient.destroyed) {
      return
    }

    await new Promise((resolve) => {
      this.cbusClient.once('close', resolve)
      this.cbusClient.destroy()
    })
  }

}

module.exports = (configuration) => { return new messageRouter(configuration) }
