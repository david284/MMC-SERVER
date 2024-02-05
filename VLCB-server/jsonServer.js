const winston = require('winston');		// use config from root instance
const name = 'jsonServer.js'
winston.info({message: name + ': Loaded'});

const net = require('net')
const cbusLib = require('cbuslibrary')
const utils = require('./utilities.js');

//
// JSON Server
// listens from data from mergAdminNode (as server) - socket
// Connects to CAN via serial or network (as client) - cbusClient
//


exports.jsonServer = function (config) {

    let clients = [];

    let cbusClient = new net.Socket();

    try{
      cbusClient.connect(config.getCbusServerPort(), config.getServerAddress(), function () {
        winston.info({message:name + ': Connected to ' + config.getServerAddress() + ' on ' + config.getCbusServerPort()})
      });
    } catch(e){
      winston.info({message:name + ': cbusClient connection failed: ' + e})
    }

    cbusClient.on('data', function (data) {
        cbusClient.setKeepAlive(true, 60000);
        let outMsg = data.toString().split(";");
        for (let i = 0; i < outMsg.length - 1; i++) {
            let cbusLibMsg = cbusLib.decode(outMsg[i])
            clients.forEach(function (client) {
                let output = JSON.stringify(cbusLibMsg);
                winston.debug({message: name + ': Output to Client : ' + output})
                client.write(output);
            });
        }
    });


    cbusClient.on('error', async function (err) {
      winston.error({message: name + `: Client error: ` + err.stack});
      config.eventBus.emit ('bus_connection_state', false)
    })


    const server = net.createServer(function (socket) {
        socket.setKeepAlive(true, 60000);
        clients.push(socket);
        winston.info({message: name + `: Connection to jsonServer`})

        socket.on('data', function (data) {
            winston.debug({message:`jsonServer: Data Received : ${data}`})
            //broadcast(data, socket)
            let indata = data.toString().replace(/}{/g, "}|{")
            //winston.info({message: `AdminNode CBUS Receive <<<  ${indata}`})
            const outMsg = indata.toString().split("|")
            //let outMsg = data.toString().split(";") //Sometimes multiple events appear in a single network package.
            for (let i = 0; i < outMsg.length; i++) { //loop through each event.
                broadcast(outMsg[i], socket)
            }
        });

        socket.on('end', function () {
            clients.splice(clients.indexOf(socket), 1);
            winston.info({message:`jsonServer: Client Disconnected`});
        });

        socket.on("error", function (err) {
            clients.splice(clients.indexOf(socket), 1);
            winston.error({message:`jsonServer: ` + err.stack});
        });

        async function broadcast(data, sender) {
            winston.debug({message:`jsonServer: broadcast : ${data} `})
            let input = JSON.parse(data)
            let cbusMsg = cbusLib.encode(input)
            let outMsg = cbusLib.decode(cbusMsg.encoded)
//            await utils.sleep(100);
            clients.forEach(function (client) {
                // Don't want to send it to sender
                if (client === sender)
                    return;
                client.write(outMsg);
            });
            cbusClient.write(cbusMsg.encoded);
        }
    })

    server.listen(config.getJsonServerPort())

    return
}


