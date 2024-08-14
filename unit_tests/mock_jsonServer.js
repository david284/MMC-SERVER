const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance

class mock_jsonServer{
  constructor(JSON_SERVER_PORT) {
    winston.info({message:`mock_jsonServer: Constructor - Port ` + JSON_SERVER_PORT})

    this.clients = [];
    this.messagesIn = [];
    this.learnNodeNumber = 0;

    const server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000);
      this.clients.push(socket);
      winston.info({message:`mock_jsonServer: Client Connected`})
  
      socket.on('data', function (data) {
        winston.info({message:`mock_jsonServer: Data Received : ${data}`})
        let indata = data.toString().replace(/}{/g, "}|{")
        const outMsg = indata.toString().split("|")
        var cbusMsg = JSON.parse(outMsg[0])
        this.messagesIn.push(cbusMsg)
        this.processMessagesIn(cbusMsg)
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
        winston.debug({message:`mock_jsonServer: inject output` + output})
        client.write(output);
    });
  }

  processMessagesIn(message){
    winston.info({message:`mock_jsonServer: processMessagesIn ` + message.mnemonic})
    switch(message.mnemonic){
      case "EVLRN":
        winston.debug({message:`mock_jsonServer: processMessagesIn` + JSON.stringify(message)})
        var cbusMsg = cbusLib.encodeWRACK(this.learnNodeNumber)
        winston.debug({message:`mock_jsonServer: processMessagesIn - WRACK ` + cbusMsg})
        this.inject(cbusMsg)
        break
      case "NNLRN":
        winston.debug({message:`mock_jsonServer: processMessagesIn` + JSON.stringify(message)})
        this.learnNodeNumber = message.nodeNumber
        break
      case "NNULN":
        winston.debug({message:`mock_jsonServer: processMessagesIn` + JSON.stringify(message)})
        this.learnNodeNumber = null
        break
      default:
    }
  }
}

module.exports = mock_jsonServer;

