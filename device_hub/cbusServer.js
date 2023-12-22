const net = require('net')
//const jsonfile = require('jsonfile')
//const serialport = require('serialport')
const winston = require('winston');		// use config from root instance
//const parsers = serialport.parsers

//const config = jsonfile.readFileSync('./config/config.json')

//const USB_PORT = config.usb4Port
//const NET_PORT = config.cbusServerPort
//const NET_ADDRESS = config.serverAddress


exports.cbusServer = function (USB_PORT,NET_PORT, NET_ADDRESS) {
    let clients = []

/*    const parser = new parsers.Readline({
        delimiter: ';'
    })

    const serialPort = new serialport(USB_PORT, {
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
    })

    serialPort.pipe(parser)

    const client = new net.Socket()

    client.connect(NET_PORT, NET_ADDRESS, function () {
        winston.info({message: `CbusServer : Client Connected to ${USB_PORT}`})
    })

    client.on('data', function (data) {
        //console.log(USB_PORT+' USB4 Received: ' + data);
        var outMsg = data.toString().split(";")
        for (var i = 0; i < outMsg.length - 1; i++) {
            serialPort.write(outMsg[i].toString() + ';')
            console.log(USB_PORT + ' USB4 Received: ' + outMsg[i].toString() + ';')
            winston.info({message: `${USB_PORT} -> CbusServer Message Received : ${outMsg[i].toString()}`})
        }
    })

    serialPort.on("open", function () {
        winston.info({message: `PORT : ${USB_PORT} Open`})
        //console.log('Serial Port '+USB_PORT+' Open')
    })

    parser.on('data', function (data) {
        winston.info({message: `${USB_PORT} -> Message Parsed : ${data.toString()}`})
        //console.log('USB Received (Parsed)' + data.toString() + ";")
        client.write(data.toString() + ";")
    })

    serialPort.on("error", function (err) {
        console.log('Serial port error: ' + err.message)
        winston.info({message: `Serial port ERROR:  : ${err.message}`})
    });*/

    const server = net.createServer(function (socket) {
        socket.setKeepAlive(true, 60000)
        clients.push(socket)
        winston.info({message: `CbusServer Client Connected to Server`})
        //console.log('Client Connected to Server')
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
            winston.info({message: `Client Disconnected`})
        })

        socket.on("error", function (err) {
            clients.splice(clients.indexOf(socket), 1)
            //console.log("Caught flash policy server socket error: ")
            //console.log(err.stack)
            winston.info({message: `Caught flash policy server socket error:   : ${err.stack}`})
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
                    winston.info({message: `CbusServer Invalid Message : ${data.toString()}`})
                }
            })
        }
    })

    server.listen(NET_PORT)
}