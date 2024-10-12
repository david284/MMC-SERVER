const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance
const utils = require('./utilities.js');

//
// JSON Server - a many to one interface
// listens for JSON messages from multiple clients - server (socket)
// Connects to a cbusServer to send MGC messages to CAN - cbusClient
// MGC = 'Modified Grid Connect'
//

const name = 'jsonServer'

class jsonServer{

  constructor(JsonPort, eventBus) {
    winston.info({message: name + ':  Constructor:'});
    this.clients = [];
    this.cbusClient = new net.Socket()
    this.eventBus = eventBus
    this.JsonPort = JsonPort

    //
    // Setup the handlers for cbusClient events
    // but doesn't actually connect to cbusServer yet
    //

    this.cbusClient.on('data', function (data) {
      this.cbusClient.setKeepAlive(true, 60000);
      let outMsg = data.toString().split(";");
      for (let i = 0; i < outMsg.length - 1; i++) {
        // restore terminating ';' lost due to split & then decode
        let cbusLibMsg = cbusLib.decode(outMsg[i] + ';')
        this.clients.forEach(function (client) {
            let output = JSON.stringify(cbusLibMsg);
            winston.debug({message: name + ': Output to ' + client.remotePort + ' : ' + output})
            client.write(output);
        });
      }
    }.bind(this));

    this.cbusClient.on('error', async function (err) {
      winston.error({message: name + `: Client error: ` + err.stack});
      this.eventBus.emit ('bus_connection_state', false)
    }.bind(this))

    //
    // creates socket on this machine, but doesn't start listening yet
    // for JSON encoded messages
    // and all the handlers
    //

    this.server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000);
      this.clients.push(socket);
      winston.info({message: name + `: Connection to jsonServer from ` + socket.remotePort})

      socket.on('data', function (data) {
        winston.debug({message:`jsonServer: Data Received : ${data}`})
        //broadcast(data, socket)
        let indata = data.toString().replace(/}{/g, "}|{")
        //winston.info({message: `AdminNode CBUS Receive <<<  ${indata}`})
        const outMsg = indata.toString().split("|")
        //let outMsg = data.toString().split(";") //Sometimes multiple events appear in a single network package.
        for (let i = 0; i < outMsg.length; i++) { //loop through each event.
            this.broadcast(outMsg[i], socket)
        }
      }.bind(this));

      socket.on('end', function () {
          this.clients.splice(this.clients.indexOf(socket), 1);
          winston.info({message:`jsonServer: Client Disconnected`});
      }.bind(this));

      socket.on("error", function (err) {
          this.clients.splice(this.clients.indexOf(socket), 1);
          winston.error({message:`jsonServer: ` + err.stack});
      }.bind(this));

    }.bind(this))

  }

  //
  // method to actually connect to cbusServer
  // and start listening for json messages from multiple sources
  //

  connect(remoteAddress, cbusPort){
    winston.info({message:name + ': try Connect ' + remoteAddress + ' on ' + cbusPort})
    // connect to remote socket for CBUS messages
    try{
      this.cbusClient.connect(cbusPort, remoteAddress, function () {
        winston.info({message:name + ': Connected to ' + remoteAddress + ' on ' + cbusPort})
      });

      this.server.listen(this.JsonPort)

    } catch(e){
      winston.info({message:name + ': cbusClient connection failed: ' + e})
    }    
  }


  broadcast(data, sender) {
    //            winston.debug({message:`jsonServer: broadcast : ${data} `})
    let input = JSON.parse(data)
    let cbusMsg = cbusLib.encode(input)
    let outMsg = cbusLib.decode(cbusMsg.encoded)
    this.clients.forEach(function (client) {
      // Don't want to send it to sender
      if (client === sender) return;
      client.write(JSON.stringify(outMsg));
      winston.debug({message:`jsonServer: json broadcast to ` + client.remotePort + `: ${JSON.stringify(outMsg)} `})
    });
    winston.debug({message:`jsonServer: cbus broadcast : ${JSON.stringify(outMsg)} `})
    this.cbusClient.write(cbusMsg.encoded);
  }

}

module.exports = jsonServer;
