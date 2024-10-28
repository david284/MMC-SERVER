const net = require('net')
const cbusLib = require('cbuslibrary')
const winston = require('winston');		// use config from root instance
const utils = require('./../VLCB-server/utilities.js');

const name = 'mock_jsonServer'

// bit weights
const CTLBT_WRITE_UNLOCK = 0
const CTLBT_ERASE_ONLY = 1
const CTLBT_AUTO_ERASE = 2
const CTLBT_AUTO_INC = 3
const CTLBT_ACK = 4

//
//
//
function  arrayChecksum(array, start) {
  var checksum = 0;
  if ( start != undefined) {
      checksum = (parseInt(start, 16) ^ 0xFFFF) + 1;
  }
  for (var i = 0; i <array.length; i++) {
      checksum += array[i]
      checksum = checksum & 0xFFFF        // trim to 16 bits
  }
  var checksum2C = utils.decToHex((checksum ^ 0xFFFF) + 1, 4)    // checksum as two's complement in hexadecimal
  return checksum2C
}


class mock_jsonServer{
  constructor(JSON_SERVER_PORT) {
    winston.info({message:`mock_jsonServer: Constructor - Port ` + JSON_SERVER_PORT})

    this.clients = [];
    this.messagesIn = [];
    this.learnNodeNumber = 0;
    this.ackRequested = false

    const server = net.createServer(function (socket) {
      socket.setKeepAlive(true, 60000);
      this.clients.push(socket);
      winston.info({message:`mock_jsonServer: remote Client Connected: ` + JSON.stringify(socket.address())})
  
      socket.on('connect', function (data) {
        winston.info({message:`mock_jsonServer: On remote Client connected :`})
      }.bind(this));

      socket.on('data', function (data) {
          winston.debug({message:`mock_jsonServer: on data received start: ${data}`})
          try{
            let indata = data.toString().replace(/}{/g, "}|{")
            const outMsg = indata.toString().split("|")
            var cbusMsg = JSON.parse(outMsg[0])
            this.messagesIn.push(cbusMsg)
            this.processMessagesIn(cbusMsg)
          } catch (err){
            winston.error({message:`mock_jsonServer: Data Received ` + err})
            winston.error({message:`mock_jsonServer: Data Received ` + JSON.stringify(data)})
          }
      }.bind(this));

      socket.on('error', function (data) {
        winston.info({message:`mock_jsonServer: error Received :`})
      }.bind(this));

    }.bind(this));

    server.listen(JSON_SERVER_PORT)
  }


  connect(remoteAddress, cbusPort){
    winston.info({message:name + ': try Connect ' + remoteAddress + ' on ' + cbusPort})
    // connect to remote socket for CBUS messages
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
    if (message.ID_TYPE == 'S'){
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
    if (message.ID_TYPE == 'X'){
      winston.info({message:`mock_jsonServer: processMessagesIn: Extended header message`})
      if (message.type == 'CONTROL') {
        switch (message.SPCMD) {
            case 0:
                winston.debug({message: 'mock_jsonServer: <<< Received control message CMD_NOP <<< '});
                break;
            case 1:
                winston.debug({message: 'mock_jsonServer: <<< Received control message CMD_RESET  <<< '});
                this.firmware = []
                break;
            case 2:
                winston.debug({message: 'mock_jsonServer: <<< Received control message CMD_RST_CHKSM <<< '});
                this.firmware = []
                break;
            case 3:
                winston.debug({message: 'mock_jsonServer: <<< Received control message CMD_CHK_RUN <<< '});
                this.firmwareChecksum = arrayChecksum(this.firmware, 0)
                winston.info({message: 'mock_jsonServer: CMD_CHK_RUN: calculated checksum: ' + this.firmwareChecksum
                  + ' length ' + this.firmware.length
                  + ' received checksum: ' + utils.decToHex(message.CPDTH, 2) + utils.decToHex(message.CPDTL, 2)});
                if (this.firmwareChecksum == utils.decToHex(message.CPDTH, 2) + utils.decToHex(message.CPDTL, 2)) {
                    this.outputExtResponse(1)   // 1 = ok
                } else {
                    this.outputExtResponse(0)   // 0 = not ok
                }
                break;
            case 4:
                winston.debug({message: 'mock_jsonServer: <<< Received control message CMD_BOOT_TEST <<< '});
                this.outputExtResponse(2)   // 2 = confirm boot load
                this.firmware = []
                break;
            default:
                winston.debug({message: 'mock_jsonServer: <<< Received control message UNKNOWN COMMAND ' + message.text});
                break
          }
          if(message.CTLBT & (2**CTLBT_ACK))  {
            winston.info({message: 'mock_jsonServer: ACK requested : CTLBT ' + message.CTLBT + ' ' + (2**CTLBT_ACK)});
            this.ackRequested = true
          }
      }
      if (message.type == 'DATA') {
        for (var i = 0; i < 8; i++) {this.firmware.push(message.data[i])}
        winston.debug({message: 'mock_jsonServer: <<< Received DATA - new length ' + this.firmware.length});
          if(this.ackRequested){
            this.outputExtResponse(1)   // 1 = ok          
          }
      }
    }
  }

  outputExtResponse(value) {
		var cbusMsg = cbusLib.encode_EXT_RESPONSE(value)
    var msgData = cbusLib.decode(cbusMsg)
		winston.info({message: 'mock_jsonServer: Network OUT >>>  ' + msgData.text + " >>> "});
    this.clients.forEach(function (client) {
      client.write(JSON.stringify(msgData));
  });
}



}

module.exports = mock_jsonServer;

