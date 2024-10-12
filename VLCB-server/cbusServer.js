const winston = require('winston');
const name = 'cbusServer.js'
winston.info({message: name + `: loaded`})
const net = require('net')

//
// cbusSever
// currently a one in, many out retransmission hub
// accepts connections from multiple clients
// doesn't itself connect to anything
//


module.exports = class cbusServer {
  constructor(config) {
    winston.info({message: name + ': Constructor'});
    this.clients = []

    this.server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000)
      this.clients.push(socket)
      winston.info({message: name + `: Client Connection received`})
      //console.log(name + `: Client Connected to Server')
      socket.on('data', function (data) {
          let outMsg = data.toString().split(";");
          for (let i = 0; i < outMsg.length - 1; i++) {
              this.broadcast(outMsg[i] + ';', socket)
              //console.log('Server Broadcast : ' + data.toString());
          }
      }.bind(this));

      socket.on('end', function () {
          this.clients.splice(this.clients.indexOf(socket), 1)
          //console.log('Client Disconnected')
          winston.info({message: name + `: Client Disconnected`})
      }.bind(this))

      socket.on("error", function (err) {
          this.clients.splice(clients.indexOf(socket), 1)
          //console.log("Caught flash policy server socket error: ")
          //console.log(err.stack)
          winston.info({message: name + `: socket error:   : ${err.stack}`})
      }.bind(this))

    }.bind(this)) //end create server

  } // end constructor


  connect(CbusServerPort){
    this.server.listen(CbusServerPort)
  }


  broadcast(data, sender) {
    this.clients.forEach(function (client) {
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
  } // end broadcast


}

