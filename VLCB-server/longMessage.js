'use strict';
const winston = require('winston');		// use config from root instance

const logPrefix = 'longMessage'

class longMessage{
  constructor(){
    this.channels = []
  } // end constructor

  setup(configuration){
    this.config = configuration
  }
  
  processLongMessage(cbusMsg){
    if (!cbusMsg || typeof cbusMsg !== 'object'){
      winston.debug({message: logPrefix + ': ignoring malformed long message'})
      return
    }
    winston.debug({message: logPrefix + `: Long Message ${JSON.stringify(cbusMsg)}`})
    switch(cbusMsg.command){
      case "DATA":
        this.do_DATA(cbusMsg)
        break
      case "USAGES":
        break
      case "QUERY":
        break
      case "REQUEST":
        this.do_REQUEST(cbusMsg)
        break
      case "LAST_DATA1":
        break
      case "LAST_DATA2":
        break
      case "LAST_DATA3":
        break
      case "LAST_DATA4":
        break
      case "LAST_DATA5":
        break
      case "END_MESSAGE":
        this.do_END_MESSAGE(cbusMsg)
        break
      case "START_MESSAGE":
        this.do_START_MESSAGE(cbusMsg)
        break
      case "RELEASE_CHANNEL":
        break
      case "CLAIM_CHANNEL":
        this.do_CLAIM_CHANNEL(cbusMsg)
        break
      case "PROPOSE_CHANNEL":
        this.do_PROPOSE_CHANNEL(cbusMsg)
        break
    }
    
  }

  do_DATA(cbusMsg){
    // opCode, channel, data1, data2, data3, data4, data5, data6
    try{
      this.checkData(cbusMsg.channel)
      let currentMessage = this.channels[cbusMsg.channel].currentMessage
      this.channels[cbusMsg.channel][currentMessage].data.push(cbusMsg.Data1)
      this.channels[cbusMsg.channel][currentMessage].data.push(cbusMsg.Data2)
      this.channels[cbusMsg.channel][currentMessage].data.push(cbusMsg.Data3)
      this.channels[cbusMsg.channel][currentMessage].data.push(cbusMsg.Data4)
      this.channels[cbusMsg.channel][currentMessage].data.push(cbusMsg.Data5)
      this.channels[cbusMsg.channel][currentMessage].data.push(cbusMsg.Data6)
      winston.debug({message: logPrefix + `: do_DATA ${JSON.stringify(this.channels[cbusMsg.channel])}`})
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  do_START_BLOCK(cbusMsg){
    // opCode, START_BLOCK, channel, 0, 0, 0, 0, 0
    try{
      this.checkChannel(cbusMsg.channel)
      this.channels[cbusMsg.channel].nodeNumber = cbusMsg.nodeNumber
      winston.debug({message: logPrefix + `: do_START_BLOCK ${JSON.stringify(this.channels[cbusMsg.channel])}`})
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  do_END_MESSAGE(cbusMsg){
    // opCode, END_MESSAGE, channel, 0, CHK_HI, CHK_LO, 0, 0
    try{
      this.checkData(cbusMsg.channel)
      let currentMessage = this.channels[cbusMsg.channel].currentMessage
      this.channels[cbusMsg.channel][currentMessage].checksum = cbusMsg.checksum
      //this.channels[cbusMsg.channel][currentMessage].data.push(70)
      //this.channels[cbusMsg.channel][currentMessage].data.push(71)
      let text = ""
      if (this.channels[cbusMsg.channel][currentMessage].data.length > 0){
        text = String.fromCharCode.apply(String, this.channels[cbusMsg.channel][currentMessage].data);
      }
        winston.info({message: logPrefix + `: Long Message: text ${text}`})
      let message = `Long Message Received: channel: ${cbusMsg.channel} node: ${this.channels[cbusMsg.channel][currentMessage].nodeNumber}`
      let content = ` ${text} : ${JSON.stringify(this.channels[cbusMsg.channel], null, " ")}`
      if (this.channels[cbusMsg.channel][currentMessage].use == 254){
        content = text
      }
      let data = {
        message: message,
        caption: content,
        type: "develop",
        timeout: 10000
      }
      this.config.eventBus.emit ('SERVER_NOTIFICATION', data)
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  // proposal from a node for a channel
  // we'll need to add code to respond if we have that channel
  //
  do_PROPOSE_CHANNEL(cbusMsg){
    // opCode, PROPOSE_CHANNEL, channel, 0, NN_H, NN_L, 0, 0
    try{
      winston.debug({message: logPrefix + `: do_PROPOSE_CHANNEL ${JSON.stringify(this.channels[cbusMsg.channel])}`})
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  // a node is stating it's claim on this channel
  // so clear this channel for new messages
  //
  do_CLAIM_CHANNEL(cbusMsg){
    // opCode, CLAIM_CHANNEL, channel, 0, NN_H, NN_L, 0, 0
    try{
      this.channels[cbusMsg.channel]={}
      //
      winston.debug({message: logPrefix + `: do_CLAIM_CHANNEL ${JSON.stringify(this.channels[cbusMsg.channel])}`})
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  // REQUEST (220)
  //
  do_REQUEST(cbusMsg){
    // opCode, REQUEST, channel, use, NN_H, NN_L, option_flags, request
    try{
      this.checkChannel(cbusMsg.channel)
      this.channels[cbusMsg.channel].use = cbusMsg.use
      this.channels[cbusMsg.channel].nodeNumber = cbusMsg.nodeNumber
      this.channels[cbusMsg.channel].option_flags = cbusMsg.option_flags
      this.channels[cbusMsg.channel].request = cbusMsg.request
      winston.debug({message: logPrefix + `: do_REQUEST ${JSON.stringify(this.channels[cbusMsg.channel])}`})
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  // START_MESSAGE (239)
  //
  do_START_MESSAGE(cbusMsg){
    // opCode, START_MESSAGE, channel, use, NN_H, NN_L, option_flags, 0
    winston.debug({message: logPrefix + `: do_START_MESSAGE: cbusMsg: ${JSON.stringify(cbusMsg)}`})
    try{
      this.createMessage(cbusMsg.channel)
      let currentMessage = this.channels[cbusMsg.channel].currentMessage
      this.channels[cbusMsg.channel][currentMessage].nodeNumber = cbusMsg.nodeNumber
      this.channels[cbusMsg.channel][currentMessage].use = cbusMsg.use
      this.channels[cbusMsg.channel][currentMessage].option_flags = cbusMsg.option_flags
      winston.debug({message: logPrefix + `: do_START_MESSAGE ${JSON.stringify(this.channels[cbusMsg.channel])}`})
    } catch(error){
      winston.debug({message: logPrefix + `: Long Message: ${error}`})
    }
  }

  //
  //
  checkChannel(channel){
    if (this.channels[channel] == undefined){
      // create fresh entry for channel if undefined
      this.channels[channel]={
      }
    }
  }

  //
  //
  checkMessage(channel){
    this.checkChannel(channel)
    if (this.channels[channel].currentMessage == undefined){
      this.createMessage(channel)
    }
  }

  //
  //
  checkData(channel){
    this.checkMessage(channel)
    let currentMessage = this.channels[channel].currentMessage
    if (this.channels[channel][currentMessage].data == undefined){
      this.channels[channel][currentMessage].data = []
    }
  }

  //
  //
  createMessage(channel){
    try{
      this.checkChannel(channel)
      //let messageIndex = Date.now()
      let messageIndex = new Date().toJSON()
      this.channels[channel].currentMessage = messageIndex
      this.channels[channel][messageIndex] = {
      }
    } catch (error){
      winston.debug({message: logPrefix + `: createMessage: ${error}`})
    }
  }


}
module.exports = new longMessage()
