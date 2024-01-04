const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance


exports.jsonServer = function (config) {

    let clients = [];

    let cbusClient = new net.Socket();

    cbusClient.connect(config.getCbusServerPort(), config.getServerAddress(), function () {
        winston.info({message:'JSON Server: Connected to ' + config.getServerAddress() + ' on ' + config.getCbusServerPort()})
    });

    cbusClient.on('data', function (data) {
        cbusClient.setKeepAlive(true, 60000);
        let outMsg = data.toString().split(";");
        for (let i = 0; i < outMsg.length - 1; i++) {
            let cbusLibMsg = cbusLib.decode(outMsg[i])
            /*let message={}
            message['mnemonic']=cbusLibMsg.mnemonic
            message['nodeNumber']=cbusLibMsg.nodeNumber
            message['eventNumber']=cbusLibMsg.eventNumber
            let cbusLibJsonMsg = cbusLib.encode(message)
            console.log(`New ::${outMsg[i]} ==> ${JSON.stringify(cbusLibMsg)} ==> ${JSON.stringify(cbusLibJsonMsg)} => ${cbusLibJsonMsg.encoded}`)*/
            clients.forEach(function (client) {
                let output = JSON.stringify(cbusLibMsg);
                //console.log('Output to Client : ' + output);
                //winston.info({message:'Json Server Output to Client : ' + output})
                client.write(output);
            });
        }
    });

    const server = net.createServer(function (socket) {
        socket.setKeepAlive(true, 60000);
        clients.push(socket);
        //console.log('Client Connected to JSON Server');
        winston.info({message:`jsonServer: Client Connected`})

        socket.on('data', function (data) {
            winston.info({message:`jsonServer: Data Received : ${data}`})
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
            winston.error({message:`jsonServer: Caught flash policy server socket error: `});
            winston.error({message:`jsonServer: ` + err.stack});
        });

        function broadcast(data, sender) {
            winston.info({message:`jsonServer: broadcast : ${data} `})
            let input = JSON.parse(data)
            let cbusMsg = cbusLib.encode(input)
            let outMsg = cbusLib.decode(cbusMsg.encoded)
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

}
