const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance

//const JSON_SERVER_PORT = 5551;
//const CBUS_SERVER_ADDRESS = "localhost";
//const CBUS_SERVER_PORT = 5550

let clients = [];
let messages = [];
  
// this accept gridconnect data
exports.inject = function inject(outMsg){
  winston.info({message:`mock_jsonServer: inject ` + outMsg})
  let cbusLibMsg = cbusLib.decode(outMsg)
  clients.forEach(function (client) {
      let output = JSON.stringify(cbusLibMsg);
      winston.info({message:`mock_jsonServer: inject output` + output})
      client.write(output);
  });
}

exports.jsonServer = function jsonServer(JSON_SERVER_PORT) {

  // CBUS_SERVER_ADDRESS & CBUS_SERVER_PORT unused

  const server = net.createServer(function (socket) {
    socket.setKeepAlive(true, 60000);
    clients.push(socket);
    //console.log('Client Connected to JSON Server');
    winston.info({message:`mock_jsonServer: Client Connected`})

    socket.on('data', function (data) {
      winston.info({message:`mock_jsonServer: Data Received : ${data}`})
      //broadcast(data, socket)
      let indata = data.toString().replace(/}{/g, "}|{")
      //winston.info({message: `AdminNode CBUS Receive <<<  ${indata}`})
      const outMsg = indata.toString().split("|")
      //let outMsg = data.toString().split(";") //Sometimes multiple events appear in a single network package.
      for (let i = 0; i < outMsg.length; i++) { //loop through each event.
        messages.push(outMsg[i])
//          broadcast(outMsg[i], socket)
      }
    });


  })

  server.listen(JSON_SERVER_PORT)
}
