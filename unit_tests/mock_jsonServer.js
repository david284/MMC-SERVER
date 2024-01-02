const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance

class mock_jsonServer{
  constructor(JSON_SERVER_PORT) {
    winston.info({message:`mock_jsonServer: Constructor - Port ` + JSON_SERVER_PORT})

    this.clients = [];
    this.messagesIn = [];

    const server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000);
      this.clients.push(socket);
      winston.info({message:`mock_jsonServer: Client Connected`})
  
      socket.on('data', function (data) {
        winston.info({message:`mock_jsonServer: Data Received : ${data}`})
        this.messagesIn.push(data)
      }.bind(this));

    }.bind(this));

    server.listen(JSON_SERVER_PORT)
  }

  // this accept gridconnect data
  inject(outMsg){
    winston.info({message:`mock_jsonServer: inject ` + outMsg})
    let cbusLibMsg = cbusLib.decode(outMsg)
    this.clients.forEach(function (client) {
        let output = JSON.stringify(cbusLibMsg);
        winston.info({message:`mock_jsonServer: inject output` + output})
        client.write(output);
    });
  }

}

module.exports = mock_jsonServer;

