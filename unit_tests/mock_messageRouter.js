'use strict';
const winston = require('winston');		// use config from root instance
const cbusLib = require('cbuslibrary')
const utils = require('./../VLCB-server/utilities.js');

const name = 'mock_messageRouter'

// bit weights
const CTLBT_WRITE_UNLOCK = 0
const CTLBT_ERASE_ONLY = 1
const CTLBT_AUTO_ERASE = 2
const CTLBT_AUTO_INC = 3
const CTLBT_ACK = 4

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


class mock_messageRouter{
  constructor(config) {
    winston.info({message:name + `: Constructor`})

    this.config = config
    this.messagesIn = [];
    this.learnNodeNumber = 0;
    this.ackRequested = false

    this.config.eventBus.on('GRID_CONNECT_SEND', function (data) {
      winston.debug({message: name + `:  GRID_CONNECT_SEND ${data}`})
      let cbusMsg = cbusLib.decode(data)
      this.messagesIn.push(cbusMsg)
      this.processMessagesIn(cbusMsg)
    }.bind(this))
    
  } // end constructor

  //
  //
  connect(remoteAddress, cbusPort){
    winston.info({message:name + ': try Connect ' + remoteAddress + ' on ' + cbusPort})
    // connect to remote socket for cbusServer or remote equivalent
  }


  // this expects gridconnect data
  //
  inject(outMsg){
    winston.debug({message: name + `: inject: ` + outMsg})
    let cbusMsg = cbusLib.decode(outMsg)
    winston.info({message: name + `: inject: ` + cbusMsg.text})
    this.config.eventBus.emit ('GRID_CONNECT_RECEIVE', outMsg)
  }

  //
  //
  processMessagesIn(message){
    if (message.ID_TYPE == 'X'){
      this.processExtended(message)
    } else {
      this.processStandard(message)
    }
  }

  //
  //
  processStandard(message){
    winston.info({message:name + `: processStandard: ` + message.text})
    switch(message.mnemonic){
      case "EVLRN":
        winston.debug({message:name + `: processMessagesIn: EVLRN` + message.text})
        var cbusMsg = cbusLib.encodeWRACK(this.learnNodeNumber)
        winston.debug({message:name + `: processMessagesIn: WRACK ` + cbusMsg})
        this.inject(cbusMsg)
        break
      case "NNLRN":
        winston.debug({message:name + `: processMessagesIn: NNLRN ` + message.text})
        this.learnNodeNumber = message.nodeNumber
        break
      case "NNULN":
        winston.debug({message:name + `: processMessagesIn: NNULN ` + message.text})
        this.learnNodeNumber = null
        break
      case "REVAL":
        winston.debug({message:name + `: processMessagesIn: REVAL ` + message.text})
        if (message.eventVariableIndex == 0){
          // reply with number of event variables used - for test purposes, just 2
          var cbusMsg = cbusLib.encodeNEVAL(message.nodeNumber, message.eventIndex, message.eventVariableIndex, 2)
          this.inject(cbusMsg)
        } else {
          var cbusMsg = cbusLib.encodeNEVAL(message.nodeNumber, message.eventIndex, message.eventVariableIndex, 255)
          this.inject(cbusMsg)
        }
        break
      default:
        winston.debug({message:name + `: processMessagesIn: default ` + JSON.stringify(message)})
    }
  }

  //
  //
  processExtended(message){
    winston.info({message:name + `: processMessagesIn: Extended header message`})
    if (message.type == 'CONTROL') {
      switch (message.SPCMD) {
          case 0:
              winston.debug({message: name + ': <<< Received control message CMD_NOP <<< '});
              break;
          case 1:
              winston.debug({message: name + ': <<< Received control message CMD_RESET  <<< '});
              this.firmware = []
              break;
          case 2:
              winston.debug({message: name + ': <<< Received control message CMD_RST_CHKSM <<< '});
              this.firmware = []
              winston.debug({message: name + ': <<< Received CMD_RST_CHKSM - new checksum ' + arrayChecksum(this.firmware, 0)});
              break;
          case 3:
              winston.debug({message: name + ': <<< Received control message CMD_CHK_RUN <<< '});
              this.firmwareChecksum = arrayChecksum(this.firmware, 0)
              winston.info({message: name + ': CMD_CHK_RUN: calculated checksum: ' + this.firmwareChecksum
                + ' length ' + this.firmware.length
                + ' received checksum: ' + utils.decToHex(message.CPDTH, 2) + utils.decToHex(message.CPDTL, 2)});
              if (this.firmwareChecksum == utils.decToHex(message.CPDTH, 2) + utils.decToHex(message.CPDTL, 2)) {
                  this.outputExtResponse(1)   // 1 = ok
              } else {
                  this.outputExtResponse(0)   // 0 = not ok
              }
              break;
          case 4:
              winston.debug({message: name + ': <<< Received control message CMD_BOOT_TEST <<< '});
              this.outputExtResponse(2)   // 2 = confirm boot load
              this.firmware = []
              break;
          default:
              winston.debug({message: name + ': <<< Received control message UNKNOWN COMMAND ' + message.text});
              break
        }
        if(message.CTLBT & (2**CTLBT_ACK))  {
          //winston.debug({message: name + ': ACK requested : CTLBT ' + message.CTLBT + ' ' + (2**CTLBT_ACK)});
          this.ackRequested = true
        }
    }
    if (message.type == 'DATA') {
      for (var i = 0; i < 8; i++) {this.firmware.push(message.data[i])}
      winston.debug({message: name + ': <<< Received DATA - new length ' + this.firmware.length});
      winston.debug({message: name + ': <<< Received DATA - new checksum ' + arrayChecksum(this.firmware, 0)});
        if(this.ackRequested){
          this.outputExtResponse(1)   // 1 = ok          
        }
    }

  }

  //
  //
  outputExtResponse(value) {
		var cbusMsg = cbusLib.encode_EXT_RESPONSE(value)
    this.config.eventBus.emit ('GRID_CONNECT_RECEIVE', cbusMsg)
  }

}

module.exports = (configuration) => { return new mock_messageRouter(configuration) }


