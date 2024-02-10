const winston = require('winston');
const name = 'cbusServer.js'
winston.info({message: name + `: loaded`})
const net = require('net')


exports.cbusServer = function (config) {
    let clients = []

    const server = net.createServer(function (socket) {
        socket.setKeepAlive(true, 60000)
        clients.push(socket)
        winston.info({message: name + `: Client Connection received`})
        //console.log(name + `: Client Connected to Server')
        socket.on('data', function (data) {
            let outMsg = data.toString().split(";");
            for (let i = 0; i < outMsg.length - 1; i++) {
                broadcast(outMsg[i] + ';', socket)
                //console.log('Server Broadcast : ' + data.toString());
            }
        });

        socket.on('end', function () {
            clients.splice(clients.indexOf(socket), 1)
            //console.log('Client Disconnected')
            winston.info({message: name + `: Client Disconnected`})
        })

        socket.on("error", function (err) {
            clients.splice(clients.indexOf(socket), 1)
            //console.log("Caught flash policy server socket error: ")
            //console.log(err.stack)
            winston.info({message: name + `: socket error:   : ${err.stack}`})
        })

        function broadcast(data, sender) {
            clients.forEach(function (client) {
                // Don't want to send it to sender
                if (client === sender)
                    return
                if (data.length > 8) {
                    client.write(data)
                    //winston.info({message: `CbusServer Broadcast : ${data.toString()}`})
                } else {
                    //console.log('Server Broadcast : ' + data.toString())
                    winston.info({message: name + `: CbusServer Invalid Message : ${data.toString()}`})
                }
            })
        }
    })

    server.listen(config.getCbusServerPort())
}