const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance
const utils = require('./../VLCB-server/utilities.js');

const name = 'mock_cbusServer'


class mock_cbusServer{
  constructor(CBUS_SERVER_PORT) {
    winston.info({message:name + `: Constructor - Port ` + CBUS_SERVER_PORT})

    this.clients = [];
    this.messagesIn = [];

    const server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000);
      this.clients.push(socket);
      winston.info({message:name + `: remote Client Connected: ` + JSON.stringify(socket.address())})

      socket.on('connect', function (data) {
        winston.info({message:name + `: On connect :`})
      }.bind(this));

      socket.on('data', function (data) {
        winston.debug({message:name + `: On data received: ${data}`})
        this.messagesIn.push(data)
      }.bind(this));

      socket.on('error', function (data) {
        winston.info({message:name + `: On error Received :`})
      }.bind(this));

    }.bind(this));

    server.listen(CBUS_SERVER_PORT)
  } // end constructor

  // this accepts gridconnect data
  inject(outMsg){
    winston.info({message:`mock_cbusServer: inject ` + outMsg})
    let cbusLibMsg = cbusLib.decode(outMsg)
    this.clients.forEach(function (client) {
        let output = JSON.stringify(cbusLibMsg);
        winston.debug({message:name + `: inject receive data` + output})
        winston.debug({message:name + `: client` + JSON.stringify(client._sockname)})
        client.write(outMsg);
    });
  }


}

module.exports = mock_cbusServer;

