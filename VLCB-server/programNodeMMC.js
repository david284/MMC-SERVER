'use strict';
var winston = require('winston');		// use config from root instance
const net = require('net')
const fs = require('fs');
const readline = require('readline');
const jsonfile = require('jsonfile')
let cbusLib = require('cbuslibrary')
const EventEmitter = require('events').EventEmitter;
const utils = require('./../VLCB-server/utilities.js');

const name = 'programNode'

//=============================================================================
//
// Based on the microchip AN247 application note (see documents folder)
//
//=============================================================================


// control bit weights
const CTLBT_WRITE_UNLOCK = 1
const CTLBT_ERASE_ONLY = 2
const CTLBT_AUTO_ERASE = 4
const CTLBT_AUTO_INC = 8
const CTLBT_ACK = 16
//normal mode = CTLBT_WRITE_UNLOCK + CTLBT_AUTO_ERASE + CTLBT_AUTO_INC + CTLBT_ACK
// = 1+4+8+16      erase only disabled
const CONTROL_BITS = CTLBT_WRITE_UNLOCK + CTLBT_AUTO_ERASE + CTLBT_AUTO_INC + CTLBT_ACK

// Special Commands (SPCMD)
const SPCMD_NOP       = 0
const SPCMD_RESET     = 1
const SPCMD_INIT_CHK  = 2
const SPCMD_CHK_RUN   = 3
const SPCMD_BOOT_TEST = 4

// RESPONSE codes
// 0 - not ok
// 1 - ok acknowledge
// 2 - confirm boot mode


// Sequence of operation
//
//  put into bootmode
//  send check_boot - SPCMD_BOOT_TEST (4)
//  expect response 2 - start send firmware process (||)
//
//  || set sendingFirmware = true
//  || send intial control message SPCMD_INIT_CHK (2) with address 0000 & CONTROL_BITS
//  || then for each block.... always starting at block 000800
//  || send control message SPCMD_NOP (0) with block address & CONTROL_BITS
//  || send all data messages for that block
//  || if more blocks, send control with new block address & then data...
//  || when all data sent...
//  || set sendingFirmware = false
//  || send control message SPCMD_CHK_RUN with check sum 
//
//  expect response message to SPCMD_CHK_RUN (now sendingFirmware == false)
//    if response 1 - download succeeded, send control message SPCMD_RESET to start firmware
//    if response 0 - download failed...
//
//  A response 1 at any time will also set ackReceived flag,
//  so the wait on transmit can be terminated early


const STATE_NULL = 0
const STATE_START = 1
const STATE_FIRMWARE = 2
const STATE_QUIT = 3

//
//
//
class programNode extends EventEmitter  {
  constructor() {
    super()
    this.client = new net.Socket()  
    this.FIRMWARE = {}
    this.nodeNumber = null
    this.ackReceived = false
    this.sendingFirmware = false
    this.decodeState = {}
    this.programState = STATE_NULL
  }
    
  //
  //
  //
  setConnection(host, port){
    this.net_address = host
    this.net_port = port
  }


  //  expose decodeLine for testing purposes
  decodeLine(array, line, callback) { decodeLine(array, line, callback)}


  /** actual download function
  * @param NODENUMBER
  * @param CPUTYPE
  * @param FLAGS
  * @param INTEL_HEX_STRING
  * Flags
  * 1 = Program CONFIG
  * 2 = Program EEPROM
  * 4 = Ignore CPUTYPE
  * 8 = program in BootMode
  */

  async program (NODENUMBER, CPUTYPE, FLAGS, INTEL_HEX_STRING) {
    this.success = false
    this.nodeNumber = NODENUMBER
    this.programState = STATE_START


    this.client.connect(this.net_port, this.net_address, function () {
      winston.info({message: name + ': this Client Connected ' + this.net_address + ':' + this.net_port});
      winston.info({message: name + ': this Client is port ' + this.client.localPort});
    }.bind(this))
    await utils.sleep(10)    // allow time for connection
    
    this.client.on('close', function () {
      winston.debug({message: 'programNode: Connection Closed'});
      this.programState = STATE_QUIT
    }.bind(this))

    this.client.on('error', function (err) {
      var msg = 'TCP ERROR: ' + err.code
      winston.debug({message: 'programNode: ' + msg});
      this.sendFailureToClient(msg)
      this.programState = STATE_QUIT
    }.bind(this))

    this.client.on('data', async function (message) {
      let tmp = message.toString().replace(/}{/g, "}|{")
      const inMsg = tmp.toString().split("|")
      for (let i = 0; i < inMsg.length; i++) {
        try {
          var cbusMsg = JSON.parse(inMsg[i])
          if (cbusMsg.ID_TYPE == "X"){
            winston.info({message: 'programNode: CBUS Receive  <<<: ' + cbusMsg.text});
            if (cbusMsg.operation == 'RESPONSE') {
              if (cbusMsg.response == 0) {
                winston.debug({message: 'programNode: Check NOT OK received: download failed'});
                this.sendFailureToClient('Check NOT OK received: download failed')
                this.programState = STATE_QUIT
              }
              if (cbusMsg.response == 1) {
                this.ackReceived = true
                if (this.sendingFirmware == false){
                  winston.debug({message: 'programNode: Check OK received: Sending reset'});
                  var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x01, 0, 0)
                  await this.transmitCBUS(msg)
                  this.success = true
                  // 'Success:' is a necessary string in the message to signal the client it's been successful
                  this.sendSuccessToClient('Success: programing completed')
                  this.programState = STATE_QUIT
                }
              }
              if (cbusMsg.response == 2) {
                  winston.debug({message: 'programNode: BOOT MODE Confirmed received:'});
                  this.sendFirmware(FLAGS)
              }
            }
          }
        } catch (err){
          winston.debug({message: name + ': program on data: ' + err});
        }
      }
    }.bind(this))

    if (this.parseHexFile(INTEL_HEX_STRING)){

      if (FLAGS & 0x4) {
        this.sendMessageToClient('CPUTYPE ignored')
      } else {
        if (this.checkCPUTYPE (CPUTYPE, this.FIRMWARE) != true) {
          winston.debug({message: 'programNode: >>>>>>>>>>>>> cpu check: FAILED'})
          this.sendFailureToClient('CPU mismatch')
          this.programState = STATE_QUIT
        }
      }

      if (this.programState != STATE_QUIT){
        // not quiting, so proceed...
        if (FLAGS & 0x8) {
          // already in boot mode, so proceed with download
          winston.debug({message: 'programNode: already in BOOT MODE: starting download'});
          this.sendFirmware(FLAGS)
        } else {
          // set boot mode
          var msg = cbusLib.encodeBOOTM(NODENUMBER)
          await this.transmitCBUS(msg)
          
          // need to allow a small time for module to go into boot mode
          await utils.sleep(100)
          var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x04, 0, 0)
          await this.transmitCBUS(msg)
        }
      }    

    } else {
      // failed parseHexFile
      winston.warn({message: name + ': parseFileHex failed:'});
      this.sendFailureToClient('Failed: file parsing failed')
      this.programState = STATE_QUIT
    } // end if parseHexFileA...

    var startDate = Date.now()
    while(startDate + 100000 > Date.now()){
      await utils.sleep(10)
      // terminate early if quit
      if(this.programState == STATE_QUIT) {break}
    }
    await utils.sleep(300)  // allow time for last messages to be sent
    this.client.end()
    await utils.sleep(100)  // allow time for connection to end
    this.client.removeAllListeners()

  }
  
/*

  async programB (NODENUMBER, CPUTYPE, FLAGS, INTEL_HEX_STRING) {
    winston.info({message: 'programNode: Started'})
    this.success = false
    this.nodeNumber = NODENUMBER

    this.client.connect(this.net_port, this.net_address, function () {
      winston.info({message: name + ': this Client Connected ' + this.net_address + ':' + this.net_port});
      winston.info({message: name + ': this Client is port ' + this.client.localPort});
    }.bind(this))
    
    await utils.sleep(10)    // allow time for connection

    try {

      // parse the intel hex file into our firmware object
      this.parseHexFile(INTEL_HEX_STRING, async function (firmwareObject) {

        if (firmwareObject != null) {
          winston.debug({message: 'programNode: >>>>>>>>>>>>> parseHexFile callback ' + JSON.stringify(firmwareObject)})
          this.FIRMWARE = firmwareObject

          if (FLAGS & 0x4) {
              this.sendMessageToClient('CPUTYPE ignored')
          } else {
              if (this.checkCPUTYPE (CPUTYPE, this.FIRMWARE) != true) {
                  winston.debug({message: 'programNode: >>>>>>>>>>>>> cpu check: FAILED'})
                  this.sendFailureToClient('CPU mismatch')
                  return;
              }
          }

          this.client.on('error', (err) => {
              var msg = 'TCP ERROR: ' + err.code
              winston.debug({message: 'programNode: ' + msg});
              this.sendFailureToClient(msg)
          })
            
          this.client.on('close', function () {
              winston.debug({message: 'programNode: Connection Closed'});
          })

          this.client.on('data', async function (message) {
            let tmp = message.toString().replace(/}{/g, "}|{")
            const inMsg = tmp.toString().split("|")
            for (let i = 0; i < inMsg.length; i++) {
              try {
                var cbusMsg = JSON.parse(inMsg[i])
                if (cbusMsg.ID_TYPE == "X"){
                  winston.info({message: 'programNode: CBUS Receive  <<<: ' + cbusMsg.text});
                  if (cbusMsg.operation == 'RESPONSE') {
                    if (cbusMsg.response == 0) {
                      winston.debug({message: 'programNode: Check NOT OK received: download failed'});
                      this.sendFailureToClient('Check NOT OK received: download failed')
                    }
                    if (cbusMsg.response == 1) {
                      this.ackReceived = true
                      if (this.sendingFirmware == false){
                        winston.debug({message: 'programNode: Check OK received: Sending reset'});
                        var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x01, 0, 0)
                        await this.transmitCBUS(msg)
                        // ok, can shutdown the connection now
                        this.client.end();
                        winston.debug({message: 'programNode: Client closed normally'});
                        this.success = true
                        // 'Success:' is a necessary string in the message to signal the client it's been successful
                        this.sendSuccessToClient('Success: programing completed')
                        this.client.removeAllListeners()
                      }
                    }
                    if (cbusMsg.response == 2) {
                        winston.debug({message: 'programNode: BOOT MODE Confirmed received:'});
                        this.sendFirmware(FLAGS)
                    }
                  }
                }
              } catch (err){
                winston.debug({message: name + ': program on data: ' + err});
              }
            }
          }.bind(this))

          if (FLAGS & 0x8) {
            // already in boot mode, so proceed with download
            winston.debug({message: 'programNode: already in BOOT MODE: starting download'});
            this.sendFirmware(FLAGS)
          } else {
            // set boot mode
            var msg = cbusLib.encodeBOOTM(NODENUMBER)
            await this.transmitCBUS(msg)
            
            // need to allow a small time for module to go into boot mode
            await utils.sleep(100)
            var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x04, 0, 0)
            await this.transmitCBUS(msg)
          }          

          // ok, need to check if it's completed after a reasonable time, if not must have failed
          // allow 10 seconds
          setTimeout(() => {
              winston.debug({message: 'programNode: ***************** download: ENDING - success is ' + this.success});
              // 'Failed:' is a necessary string in the message to signal the client it's failed
              if (this.success == false) { this.sendFailureToClient('Failed: Timeout') }               
          }, 60000)

        } else {
            this.sendFailureToClient('Failed: file parsing failed')
        } // if (firmwareObject != null)

      }.bind(this)) // parseHexFile

    } catch (error) {
      winston.debug({message: 'programNode: ERROR: ' + error});
      this.sendFailureToClient('ERROR: ' + error)
    }

  }
*/    

  //
  //
  //
  async sendFirmware(FLAGS) {
      this.programState = STATE_FIRMWARE
      winston.debug({message: 'programNode: Started sending firmware - FLAGS ' + FLAGS});
      // sending the firmware needs to be done in 8 byte messages

      // we need to keep a running checksum of all the data we send, so we can include it in the check message at the end
      var calculatedChecksum;
      // we want to indicate progress for each region, so we keep a counter that we can reset and then incrmeent for each region
      var progressCount = 0

      this.sendingFirmware = true

      // start with SPCMD_INIT_CHK
      var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, SPCMD_INIT_CHK, 0, 0)
      winston.debug({message: 'programNode: sending SPCMD_INIT_CHK: ' + msgData});
      await this.transmitCBUS(msgData)

      
      // always do FLASH area, but only starting from 00000800
      for (const block in this.FIRMWARE['FLASH']) {
        progressCount = 0
        if (parseInt(block, 16) >= 0x800) {
          var program = this.FIRMWARE['FLASH'][block]
          //
          winston.info({message: 'programNode: FLASH AREA : ' + block + ' length: ' + program.length});
          var msgData = cbusLib.encode_EXT_PUT_CONTROL(block.substr(2), CONTROL_BITS, 0x00, 0, 0)
          winston.debug({message: 'programNode: sending FLASH address: ' + msgData});
          await this.transmitCBUS(msgData)
          //
          for (let i = 0; i < program.length; i += 8) {
            var chunk = program.slice(i, i + 8)
            var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
            await this.transmitCBUS(msgData)
            calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
            winston.debug({message: 'programNode: sending FLASH data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
            if (progressCount <= i) {
              progressCount += 32    // report progress every 4 messages
              var text = 'Progress:   FLASH ' + block + ' : ' + utils.decToHex(i, 4) + ' : ' + Math.round(i/program.length * 100) + '%'
              this.sendBootModeToClient(text)
            }
          }
        }
      }

      if (FLAGS & 0x1) {      // Program CONFIG area
        for (const block in this.FIRMWARE['CONFIG']) {
          progressCount = 0
          var config = this.FIRMWARE['CONFIG'][block]
          //
          winston.debug({message: 'programNode: CONFIG : ' + block + ' length: ' + config.length});
          var msgData = cbusLib.encode_EXT_PUT_CONTROL(block.substr(2), CONTROL_BITS, 0x00, 0, 0)
          winston.debug({message: 'programNode: sending CONFIG address: ' + msgData});
          await this.transmitCBUS(msgData)
          //
          for (let i = 0; i < config.length; i += 8) {
            var chunk = config.slice(i, i + 8)
            var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
            await this.transmitCBUS(msgData)
            calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
            winston.debug({message: 'programNode: sending CONFIG data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
            if (progressCount <= i) {
              progressCount += 32    // report progress every 4 messages
              var text = 'Progress: CONFIG ' + block + ' : ' + utils.decToHex(i, 4) + ' : ' + Math.round(i/config.length * 100) + '%'
              this.sendBootModeToClient(text)
            }
          }
        }
      }
      
      if (FLAGS & 0x2) {      // Program EEPROM area
        for (const block in this.FIRMWARE['EEPROM']) {
          progressCount = 0
          var eeprom = this.FIRMWARE['EEPROM'][block]
          //
          winston.debug({message: 'programNode: EEPROM : ' + block + ' length: ' + eeprom.length});
          var msgData = cbusLib.encode_EXT_PUT_CONTROL(block.substr(2), CONTROL_BITS, 0x00, 0, 0)
          winston.debug({message: 'programNode: sending EEPROM address: ' + msgData});
          await this.transmitCBUS(msgData)
          //
          for (let i = 0; i < eeprom.length; i += 8) {
            var chunk = eeprom.slice(i, i + 8)
            var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
            await this.transmitCBUS(msgData)
            calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
            winston.debug({message: 'programNode: sending EEPROM data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
            if (progressCount <= i) {
              progressCount += 32    // report progress every 4 messages
              var text = 'Progress: EEPROM ' + block + ' : ' + utils.decToHex(i, 4) + ' : ' + Math.round(i/eeprom.length * 100) + '%  '
              this.sendBootModeToClient(text)
            }
          }
        }
      }

      this.sendingFirmware = false
      
      // Verify Checksum
      // 00049272: Send: :X00080004N000000000D034122;
      winston.debug({message: 'programNode: Sending Check firmware'});
      var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x03, parseInt(calculatedChecksum.substr(2,2), 16), parseInt(calculatedChecksum.substr(0,2),16))
      await this.transmitCBUS(msgData)
  }
    

  //
  // function to add the contents of an inp0ut array to an existing two's complement checksum
  // this is so we can build up a single checksum from multiple arrays of data
  //
  arrayChecksum(array, start) {
    winston.debug({message: 'programNode: arrayChecksum: array length = ' + array.length});
    var checksum = 0;
      if ( start != undefined) {
        // convert back from two's complement in hexadecimal..
          checksum = (parseInt(start, 16) ^ 0xFFFF) + 1;
      }
      // add contents of the array to the checksum
      for (var i = 0; i <array.length; i++) {
        checksum += array[i]
        checksum = checksum & 0xFFFF        // trim to 16 bits
      }
      // and convert resulting checksum back to two's complement in hexadecimal
      var checksum2C = utils.decToHex((checksum ^ 0xFFFF) + 1, 4)
      winston.debug({message: 'programNode: arrayChecksum: ' + checksum2C});
      return checksum2C
  }


  //
  // returns true or false
  // will populate this.FIRMWARE
  //
  parseHexFile(intelHexString) {
    var firmware = {}       // ???
    this.decodeState = {}   // keeps state between calls to decodeLine
    var result = false      // end result
    var firmwareObject = undefined

    this.sendMessageToClient('Parsing file')
//        winston.debug({message: 'programNode: parseHexFile - hex ' + intelHexString})

    const lines = intelHexString.toString().split("\r\n");
    winston.debug({message: 'programNode: parseHexFile - line count ' + lines.length})

    for (var i = 0; i < lines.length - 1; i++) {
    //winston.debug({message: 'programNode: parseHexFile - line ' + lines[i]})
      result = this.decodeLine(firmware, lines[i], function (firmwareObject) {
        winston.debug({message: 'programNode: >>>>>>>>>>>>> end of file callback'})
        if (firmwareObject == null) { 
          winston.debug({message: 'programNode: parseFileHex:  firmware object is null'});
        }
        for (const area in firmwareObject) {
          for (const block in firmwareObject[area]) {
            winston.debug({message: name + ': parseHexFileA: FIRMWARE: ' + area + ': ' + block + ' length: ' + firmwareObject[area][block].length});
          }
        } 
        this.FIRMWARE = firmwareObject
      }.bind(this))
      if (result == false) {break}
    }

    winston.debug({message: name + ': parseHexFileA: result: ' + result});
    winston.debug({message: name + ': parseHexFileA: firmwareObject: ' + JSON.stringify(this.FIRMWARE)});
    if (result){
      for (const area in this.FIRMWARE) {
        for (const block in this.FIRMWARE[area]) {
          winston.debug({message: 'programNode: EOF callback: FIRMWARE: ' + area + ': ' + block + ' length: ' + this.FIRMWARE[area][block].length});
        }
      } 
    }
    return result
  }


/*
  //
  //
  //
  parseHexFileB(intelHexString, CALLBACK) {
    var firmware = {}
    this.decodeState = {}

    this.sendMessageToClient('Parsing file')
//        winston.debug({message: 'programNode: parseHexFile - hex ' + intelHexString})

    const lines = intelHexString.toString().split("\r\n");
    winston.debug({message: 'programNode: parseHexFile - line count ' + lines.length})

    for (var i = 0; i < lines.length - 1; i++) {
    //winston.debug({message: 'programNode: parseHexFile - line ' + lines[i]})
      var result = this.decodeLine(firmware, lines[i], function (firmwareObject) {
        winston.debug({message: 'programNode: >>>>>>>>>>>>> end of file callback'})
        if (firmwareObject == null) { 
          winston.debug({message: 'programNode: parseFileHex:  firmware object is null'});
        }
        for (const area in firmwareObject) {
          for (const block in firmwareObject[area]) {
            winston.debug({message: 'programNode: EOF callback: FIRMWARE: ' + area + ': ' + block + ' length: ' + firmwareObject[area][block].length});
          }
        }  
        if(CALLBACK) {CALLBACK(firmwareObject)}
        else {winston.info({message: 'programNode: read hex file: WARNING - No EOF callback'})}
      })
      if (result == false) {break}
    }
  }
*/

  //
  //
  //
  checkCPUTYPE (nodeCPU, FIRMWARE) {
    //
    // parameters start at offset 0x820 in the firmware download
    // cpu type is a byte value at 0x828
    //
    var targetCPU = FIRMWARE['FLASH']['00000800'][0x28]
    winston.debug({message: 'programNode: >>>>>>>>>>>>> cpu check: selected target: ' + nodeCPU + ' firmware target: ' + targetCPU})
    if (nodeCPU == targetCPU) {return true}
    else {return false}    
  }    

  
  async transmitCBUS(msg)
  {
    var jsonMessage = cbusLib.decode(msg)
    winston.info({message: 'programNode: CBUS Transmit >>>: ' + JSON.stringify(jsonMessage)})
    this.ackReceived = false  // set to false before writing
    var count = 0
    this.client.write(JSON.stringify(jsonMessage))
    var startTime = Date.now()
    await utils.sleep(1)
    while (((Date.now() - startTime) < 50) && (this.ackReceived == false)){
      await utils.sleep(0)    // allow task switch (potentially takes a while anyway )
      count++
    }       
    winston.debug({message: 'programNode: CBUS Transmit time ' + (Date.now() - startTime) + ' ' + count})
  }


  sendMessageToClient(text) {this.emitMessageToClient('Pending', text)}
  sendSuccessToClient(text) {this.emitMessageToClient('Success', text)}
  sendFailureToClient(text) {this.emitMessageToClient('Failure', text)}
  sendBootModeToClient(text) {this.emitMessageToClient('BootMode', text)}

  emitMessageToClient(status, text) {
    const data = {
      "status": status,
      "nodeNumber": this.nodeNumber,
      "text": text 
    }
    this.emit('programNode_progress', data)
    winston.debug({message: 'programNode: Emit: ' + JSON.stringify(data)})
  }


  //
  // This method takes a line from an intel formatted hex file
  // and builds a collection of arrays with the equivalent binary data
  // ready to downloaded to a node
  //
  decodeLine(FIRMWARE, line, callback) {
    var MARK = line.substr(0,1)
    var RECLEN = parseInt(line.substr(1,2), 16)
    var OFFSET = parseInt(line.substr(3,4), 16)
    var RECTYP = parseInt(line.substr(7,2), 16) 
    var data = line.substr(9, line.length - 9 - 2)
    var CHKSUM = parseInt(line.substr(line.length - 2, 2), 16)
    winston.debug({message: 'programNode: READ LINE: '
      + ' RECLEN ' + RECLEN 
      + ' OFFSET ' + utils.decToHex(OFFSET, 4) 
      + ' RECTYP ' + RECTYP 
      + ' data ' + data
      + ' CHKSUM ' + CHKSUM});
    
    // test the checksum to see if the line is valid
    var linechecksum = 0x00
    for (var i = 1; i < line.length; i += 2) {
      linechecksum += parseInt(line.substr(i, 2), 16)
      linechecksum &= 0xFF
    }
    if (linechecksum != 0) {
      winston.debug({message: 'programNode: READ LINE: checksum error ' + linechecksum});
      if(callback) {callback(null);}
      return false;
    }
    
    // Check to see if the persistant variables has been initialized
    // if there hasn't been an initial 'Extended Linear Address' then start at 0 (FLASH)
    if ( typeof this.decodeState.index == 'undefined' ) { this.decodeState['index'] = 0 }
    if ( typeof this.decodeState.area == 'undefined' ) { 
      this.decodeState.area = 'FLASH'
      FIRMWARE[this.decodeState.area] = []
      this.decodeState.index = 0
      this.decodeState.paddingCount = 0
    }
    if ( typeof this.decodeState.extAddressHex == 'undefined' ) { this.decodeState.extAddressHex = '0000'; }
    if ( typeof this.decodeState.startAddressHex == 'undefined' ) { this.decodeState.startAddressHex = '00000000'; }
    
    //
    // address of line start in the hex file is extAddressHex + OFFSET
    // starting address in the current array is startAddressHex in array
    // next address to be written in the array is startAddressHex + index
    //

    if ( RECTYP == 0) { // Data Record:
      // Need to check if the data in this new line follows on from previous line
      // so check if next array address == line start address
      // but if new line starts before end of padded line, then it does follow on
      // if so, then add to existing array
      // if not, then start new array
      var arrayAddressPointer = parseInt(this.decodeState.startAddressHex, 16) + this.decodeState.index
      var lineStartAddress =  ((parseInt(this.decodeState.extAddressHex, 16) << 16) + OFFSET) 
      
      if (lineStartAddress > (arrayAddressPointer + this.decodeState.paddingCount)){
        // data doesn't follow on from last, so change startAddress & it'll force a new block a bit lower
        winston.debug({message: 'programNode: line decode: Data Record: '+this.decodeState.area+' Current addressPointer '+arrayAddressPointer+' Line startAddress: '+lineStartAddress});
        this.decodeState.startAddressHex = this.decodeState.extAddressHex + utils.decToHex(OFFSET, 4)
      }

      // check if block not set, will catch first time as well as change
      if (FIRMWARE[this.decodeState.area][this.decodeState.startAddressHex] == undefined) {
        FIRMWARE[this.decodeState.area][this.decodeState.startAddressHex] = []
        this.decodeState.index = 0
        this.decodeState.paddingCount = 0
        winston.debug({message: 'programNode: line decode: Data Record: ' + this.decodeState.area + ' New block ' + this.decodeState.startAddressHex});
      }

      // if line start is not at the current pointer, need to reset current index
      if(lineStartAddress != arrayAddressPointer)( this.decodeState.index = (lineStartAddress - parseInt(this.decodeState.startAddressHex, 16)))
      
      // now actually copy the program data
      for (i=0; i < RECLEN; i++){
        FIRMWARE[this.decodeState.area][this.decodeState.startAddressHex][this.decodeState.index++] = (parseInt(data.substr(i*2, 2), 16))
      }

      // now lets make sure the firmware array is padded out to an 16 byte boundary with 'FF'
      // but don't increment this.decodeLineStore.index, as next line may not start on 8 byte boundary
      // and may need to overwrite this padding
      const padLength = 64
      this.decodeState.index % padLength ? this.decodeState.paddingCount = padLength - (this.decodeState.index % padLength) : this.decodeState.paddingCount = 0
      for (var i = 0; i < this.decodeState.paddingCount; i++) {
        FIRMWARE[this.decodeState.area][this.decodeState.startAddressHex][this.decodeState.index + i] = 0xFF
      }  
    }

    if ( RECTYP == 1) {
      winston.debug({message: 'programNode: line decode: End of File Record:'});
      for (const area in FIRMWARE) {
        for (const block in FIRMWARE[area]) {
          winston.debug({message: 'programNode: line decode: FIRMWARE: ' + area + ': ' + block + ' length: ' + FIRMWARE[area][block].length});
        }
      }        
      if(callback) {callback(FIRMWARE);}
      else {winston.info({message: 'programNode: line decode: WARNING - No EOF callback'})}
    }

    if ( RECTYP == 2) {
      winston.warn({message: 'programNode: line decode: Extended Segment Address Record:'});
    }

    if ( RECTYP == 3) {
      winston.warn({message: 'programNode: line decode: Start Segment Address Record:'});
    }

    if ( RECTYP == 4) {
      winston.debug({message: 'programNode: line decode: Extended Linear Address Record: ' + data});
      if (data == '0000') {this.decodeState.area = 'FLASH'}
      else if (data == '0001') {this.decodeState.area = 'FLASH'}
      else if (data == '0030') {this.decodeState.area = 'CONFIG'}
      else if (data == '0038') {this.decodeState.area = 'CONFIG'}
      else if (data == '00F0') {this.decodeState.area = 'EEPROM'}
      else this.decodeState.area = 'UNKNOWN ' + data
      this.decodeState.extAddressHex = data
      this.decodeState.startAddressHex = '00000000'
      this.decodeState.index = 0
      this.decodeState.paddingCount = 0
      // don't overite an existing area
      if (FIRMWARE[this.decodeState.area] == undefined) {FIRMWARE[this.decodeState.area] = []}
      winston.debug({message: 'programNode: ******** NEW MEMORY AREA: ' + this.decodeState.area + ' area address ' + data })
    }

    if ( RECTYP == 5) {
      winston.warn({message: 'programNode: line decode: Start Linear Address Record:'});
    }
    
    return true
  }


};

module.exports = new programNode() 