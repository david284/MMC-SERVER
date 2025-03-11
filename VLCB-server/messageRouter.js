'use strict';
const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance
const utils = require('./utilities.js');

//
// messageRouter for 'Modified Grid Connect' (MGC) messages
// links event based send/receive messages to a socket connection (cbusServer or remote equivalent)
//

const name = 'messageRouter'

class messageRouter{

  constructor(configuration) {
    winston.info({message: name + ':  Constructor:'});
    this.cbusClient = new net.Socket()
    this.config = configuration
    this.eventBus = configuration.eventBus
    setInterval(this.connectIntervalFunction.bind(this), 5000);
    this.enableReconnect = false
    this.connected = false
    this.cbusClientHost = null
    this.cbusClientPort = null

    //
    // Setup the handlers for cbusClient events
    // but doesn't actually connect to cbusServer yet
    //

    this.cbusClient.on('data', function (data) {
      winston.debug({message:name + `: cbusClient: data : ${data}`})
      this.connected = true
      this.cbusClient.setKeepAlive(true, 60000);
      let outMsg = data.toString().split(";");
      for (let i = 0; i < outMsg.length - 1; i++) {
        // restore terminating ';' lost due to split & then decode
        winston.debug({message:name + `: cbusClient: outMsg : ${outMsg[i] + ';'}`})
        this.config.eventBus.emit ('GRID_CONNECT_RECEIVE', outMsg[i] + ';')
        let cbusLibMsg = cbusLib.decode(outMsg[i] + ';')
        this.config.writeBusTraffic('<<<IN ' + cbusLibMsg.encoded + ' ' + cbusLibMsg.text)
      }
    }.bind(this));

    this.cbusClient.on('error', async function (err) {
      winston.error({message: name + `: Client error: ` + err.stack});
      let caption = `IP: ${this.cbusClientHost}  Port: ${this.cbusClientPort}` 
      winston.error({message: name + `: Client error: ` + caption});
      let eventData = {
        message: "Network error - retrying connection",
        caption: caption,
        type: "warning",
        timeout: 3000
      }
      this.eventBus.emit ('NETWORK_CONNECTION_FAILURE', eventData)
      this.connected = false
    }.bind(this))

    this.config.eventBus.on('GRID_CONNECT_SEND', function (data) {
      winston.info({message: name + `:  GRID_CONNECT_SEND ${data}`})
      this.sendCbusMessage(data)
    }.bind(this))

  }

  //
  // method to actually connect to cbusServer
  //
  connect(remoteAddress, cbusPort){
    this.cbusClientHost = remoteAddress
    this.cbusClientPort = cbusPort
    winston.info({message:name + ': try Connect ' + remoteAddress + ' on ' + cbusPort})
    // connect to remote socket for CBUS messages
    try{
      this.cbusClient.connect(cbusPort, remoteAddress, function () {
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
      }.bind(this));
    } catch(e){
      winston.info({message:name + ': cbusClient connection failed: ' + e})
    }    
  }

  connectIntervalFunction(){
    winston.debug({message:name + ': cbusClient check connection:'})
    if(this.enableReconnect){
      winston.debug({message:name + ': cbusClient reconnect enabled:'})
      if(this.connected){
        winston.debug({message:name + ': cbusClient still connected:'})
      } else {
        winston.info({message:name + ': cbusClient not connected:'})
        this.connect(this.cbusClientHost, this.cbusClientPort)
      }
    }
  }

  //
  // outputs an already encoded message
  //
  sendCbusMessage(cbusMSG){
    let outMsg = cbusLib.decode(cbusMSG)
    this.config.writeBusTraffic('OUT>> ' + outMsg.encoded + ' ' + outMsg.text)
    this.config.eventBus.emit ('CBUS_TRAFFIC', {direction: 'Out', json: outMsg})
    this.cbusClient.write(cbusMSG)
  }

}

module.exports = (configuration) => { return new messageRouter(configuration) }

