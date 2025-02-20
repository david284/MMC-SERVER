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
    this.nodeCpuType = null
  }
    
  //
  //
  //
  setConnection(host, port){
    this.net_address = host
    this.net_port = port
  }



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
    this.nodeCpuType = CPUTYPE


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
                  await this.transmitCBUS(msg, 80)
                  this.success = true
                  // 'Success:' is a necessary string in the message to signal the client it's been successful
                  this.sendSuccessToClient('Success: programing completed')
                  this.programState = STATE_QUIT
                }
              }
              if (cbusMsg.response == 2) {
                  winston.debug({message: 'programNode: BOOT MODE Confirmed received:'});
                  this.sendFirmwareNG(FLAGS)
              }
            }
          }
        } catch (err){
          winston.debug({message: name + ': program on data: ' + err});
        }
      }
    }.bind(this))

    if (this.parseHexFile(INTEL_HEX_STRING)){
      winston.debug({message: 'programNode: parseHexFile success'})

      if (FLAGS & 0x4) {
        this.sendMessageToClient('CPUTYPE ignored')
      } else {
        if (this.checkCPUTYPE (CPUTYPE, this.FIRMWARE) != true) {
          winston.debug({message: 'programNode: >>>>>>>>>>>>> cpu check: FAILED'})
          this.sendFailureToClient('CPU mismatch')
          this.programState = STATE_QUIT
        }
      }
      winston.debug({message: 'programNode: parseHexFile success 2'})

      if (this.programState != STATE_QUIT){
        // not quiting, so proceed...
        if (FLAGS & 0x8) {
          // already in boot mode, so proceed with download
          winston.debug({message: 'programNode: already in BOOT MODE: starting download'});
          this.sendFirmwareNG(FLAGS)
        } else {
          // set boot mode
          var msg = cbusLib.encodeBOOTM(NODENUMBER)
          await this.transmitCBUS(msg, 80)
          this.sendBootModeToClient("BootMode requested...")
          
          // need to allow a small time for module to go into boot mode
          await utils.sleep(100)
          var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x04, 0, 0)
          await this.transmitCBUS(msg, 80)
        }
      }    

    } else {
      // failed parseHexFile
      winston.warn({message: name + ': parseFileHex failed:'});
      this.sendFailureToClient('Failed: file parsing failed')
      this.programState = STATE_QUIT
    } // end if parseHexFileA...

    var startDate = Date.now()
    // abort if not completed by 5 minutes (300,000)
    while(startDate + 300000 > Date.now()){
      await utils.sleep(10)
      // terminate early if quit
      if(this.programState == STATE_QUIT) {break}
    }
    await utils.sleep(300)  // allow time for last messages to be sent
    this.client.end()
    await utils.sleep(100)  // allow time for connection to end
    this.client.removeAllListeners()

  }
  

  //
  //
  //
  async sendFirmwareNG(FLAGS) {
      this.programState = STATE_FIRMWARE
      winston.debug({message: 'programNode: Started sending firmware - FLAGS ' + FLAGS});
      // sending the firmware needs to be done in 8 byte messages

      // we need to keep a running checksum of all the data we send, so we can include it in the check message at the end
      var calculatedChecksum = 0;
      var fullArray = []
      // we want to indicate progress for each region, so we keep a counter that we can reset and then incrmeent for each region
      var progressCount = 0

      this.sendingFirmware = true

      // start with SPCMD_INIT_CHK
      var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, SPCMD_INIT_CHK, 0, 0)
      winston.debug({message: 'programNode: sending SPCMD_INIT_CHK: ' + msgData});
      await this.transmitCBUS(msgData, 80)

      
      // always do FLASH area, but only starting from 00000800
      for (const block in this.FIRMWARE['FLASH']) {
        if (block >= 0x800) {
          var program = this.FIRMWARE['FLASH'][block]
          //
          winston.info({message: name + ': sendFirmwareNG: FLASH AREA : ' + utils.decToHex(block, 8) + ' length: ' + program.length});
          winston.info({message: name + ': sendFirmwareNG: FLASH AREA : ' + utils.decToHex(block, 6)});
          var msgData = cbusLib.encode_EXT_PUT_CONTROL(utils.decToHex(block, 6), CONTROL_BITS, 0x00, 0, 0)
          winston.debug({message: 'programNode: sending FLASH address: ' + msgData});
          await this.transmitCBUS(msgData, 60)
          //
          progressCount = 0
          for (let i = 0; i < program.length; i += 8) {
            var chunk = program.slice(i, i + 8)
            var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
            await this.transmitCBUS(msgData, 60)
            calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
            for (let z=0; z<8; z++){fullArray.push(chunk[z])}
            winston.debug({message: 'programNode: sending FLASH data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
            if (progressCount <= i) {
              progressCount += 128    // report progress every 16 messages
              var text = 'Progress:   FLASH ' + utils.decToHex(block, 8) + ' : ' + utils.decToHex(i, 4) + ' : ' + Math.round(i/program.length * 100) + '%'
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
          winston.debug({message: 'programNode: CONFIG : ' + utils.decToHex(block, 8) + ' length: ' + config.length});
          var msgData = cbusLib.encode_EXT_PUT_CONTROL(utils.decToHex(block, 6), CONTROL_BITS, 0x00, 0, 0)
          winston.debug({message: 'programNode: sending CONFIG address: ' + msgData});
          await this.transmitCBUS(msgData, 80)
          //
          for (let i = 0; i < config.length; i += 8) {
            var chunk = config.slice(i, i + 8)
            var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
            await this.transmitCBUS(msgData, 80)
            calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
            for (let z=0; z<8; z++){fullArray.push(chunk[z])}
            winston.debug({message: 'programNode: sending CONFIG data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
            if (progressCount <= i) {
              progressCount += 32    // report progress every 4 messages
              var text = 'Progress: CONFIG ' + utils.decToHex(block, 8) + ' : ' + utils.decToHex(i, 4) + ' : ' + Math.round(i/config.length * 100) + '%'
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
          winston.debug({message: 'programNode: EEPROM : ' + utils.decToHex(block, 8) + ' length: ' + eeprom.length});
          var msgData = cbusLib.encode_EXT_PUT_CONTROL(utils.decToHex(block, 6), CONTROL_BITS, 0x00, 0, 0)
          winston.debug({message: 'programNode: sending EEPROM address: ' + msgData});
          await this.transmitCBUS(msgData, 80)
          //
          for (let i = 0; i < eeprom.length; i += 8) {
            var chunk = eeprom.slice(i, i + 8)
            var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
            await this.transmitCBUS(msgData, 80)
            calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
            for (let z=0; z<8; z++){fullArray.push(chunk[z])}
            winston.debug({message: 'programNode: sending EEPROM data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
            if (progressCount <= i) {
              progressCount += 32    // report progress every 4 messages
              var text = 'Progress: EEPROM ' + utils.decToHex(block, 8) + ' : ' + utils.decToHex(i, 4) + ' : ' + Math.round(i/eeprom.length * 100) + '%  '
              this.sendBootModeToClient(text)
            }
          }
        }
      }

      this.sendingFirmware = false
      
      // Verify Checksum
      // 00049272: Send: :X00080004N000000000D034122;
      winston.debug({message: 'programNode: Sending Check firmware'});
      winston.info({message: 'programNode: calculatedChecksum ' + calculatedChecksum
        + ' fullChecksum ' + this.arrayChecksum(fullArray, 0)
        + ' length ' + fullArray.length
      });
      this.sendMessageToClient('FIRMWARE: checksum: 0x' + calculatedChecksum + ' length: ' + fullArray.length)
      //      winston.info({message: 'programNode: calculatedChecksum ' + JSON.stringify(fullArray)});

      var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x03, parseInt(calculatedChecksum.substr(2,2), 16), parseInt(calculatedChecksum.substr(0,2),16))
      await this.transmitCBUS(msgData, 60)
  }
      

  //
  // function to add the contents of an input array to an existing two's complement checksum
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
//    var firmware = {}       // ???
    this.FIRMWARE = {}
    this.decodeState = {}   // keeps state between calls to decodeLine
    var result = false      // end result

    this.sendMessageToClient('Parsing file')
//        winston.debug({message: 'programNode: parseHexFile - hex ' + intelHexString})

    const lines = intelHexString.toString().split(':');
    winston.debug({message: 'programNode: parseHexFile - line count ' + lines.length})

    for (var i = 1; i < lines.length; i++) {
    winston.debug({message: 'programNode: parseHexFile - line ' + ':' + lines[i]})
      // replace MARK symbol lost due to split
      result = this.decodeLineNG(':' + lines[i])

      if (result == false) {break}
    }

    winston.info({message: name + ': parseHexFile: result: ' + result});
    if (result){
      for (const area in this.FIRMWARE) {
        for (const block in this.FIRMWARE[area]) {
          winston.info({message: 'programNode: parseHexFile: FIRMWARE: ' + area + ': ' + utils.decToHex(block, 8) + ' length: ' + this.FIRMWARE[area][block].length});
        }
      } 
    }
    return result
  }


  //
  //
  //
  checkCPUTYPE (nodeCPU, FIRMWARE) {
    //
    // parameters start at offset 0x820 in the firmware download
    // cpu type is a byte value at 0x828
    //
    var result = false
    var targetCPU =null
    if ( 0x800 in FIRMWARE['FLASH']){
      if (FIRMWARE['FLASH'][0x800].length > 0x28){
        targetCPU = FIRMWARE['FLASH'][0x800][0x28]
      }
    }
    if ( 0x810 in FIRMWARE['FLASH']){
      if (FIRMWARE['FLASH'][0x810].length > 0x18){
        targetCPU = FIRMWARE['FLASH'][0x810][0x18]
      }
    }
    if ( 0x820 in FIRMWARE['FLASH']){
      if (FIRMWARE['FLASH'][0x820].length > 0x8){
        targetCPU = FIRMWARE['FLASH'][0x820][0x8]
      }
    }
    winston.debug({message: 'programNode: >>>>>>>>>>>>> cpu check: selected target: ' + nodeCPU + ' firmware target: ' + targetCPU})
    if (nodeCPU == targetCPU) {return true}
    else {return false}    
  }    

  //
  // The following advice is from Mike Boltons bootloader notes:
  //   The bootloader requires time to program the PIC memory bytes. There is no handshake.
  //   The PC program should have delays of 10millisecs between program data frames
  //   and 50millisecs between config and EEPROM data frames.  
  //
  async transmitCBUS(msg, delay)
  {
    if (delay == undefined){ delay = 50}
    var jsonMessage = cbusLib.decode(msg)
    winston.info({message: 'programNode: CBUS Transmit >>>: ' + JSON.stringify(jsonMessage)})
    this.ackReceived = false  // set to false before writing
    var count = 0
    this.client.write(JSON.stringify(jsonMessage))
    // need to add a delay between write to the module
    //
    var startTime = Date.now()
    await utils.sleep(10) // always allow at least 10mSecs anyway
    while (((Date.now() - startTime) < delay) && (this.ackReceived == false)){
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
  // returns true on success, false on failure
  //
  decodeLineNG(line){

    // check if the persistent values are intialised, if not then do it first
    if ( typeof this.decodeState.area == 'undefined' ) { 
      this.decodeState.area = 'BOOT'              // set initial area in FIRMWARE structure
      this.decodeState.LBA = 0                    // Linear Block Address of input file
      this.decodeState.blockAddress = 0           // absolute address for block of data in FIRMWARE    
      this.decodeState.blockAddressPtr = 0        // current pointer into block address
      this.decodeState.blockPaddingPtr = 0        // where the padding of the current block ends
      this.FIRMWARE[this.decodeState.area] = {}   // initialise starting area
    }

    if (line.length < 11 ){
      winston.error({message: 'programNode: READ LINE: line too short (<11) ' + line});
      return false;
    }
    // now lets look at the line we're given
    // but beware there is likely to be unwanted 'End of Line' characters
    // So calculate length of valid content
    var MARK = line.substr(0,1)
    var RECLEN = parseInt(line.substr(1,2), 16)
    var OFFSET = parseInt(line.substr(3,4), 16)
    var RECTYP = parseInt(line.substr(7,2), 16) 
    let dataLength = RECLEN*2
    var data = line.substr(9, dataLength)
    var CHKSUM = parseInt(line.substr(9 + dataLength, 2), 16)
    winston.debug({message: 'programNode: READ LINE: '
      + ' RECLEN ' + RECLEN 
      + ' OFFSET ' + utils.decToHex(OFFSET, 4) 
      + ' RECTYP ' + RECTYP 
      + ' data ' + data
      + ' CHKSUM ' + CHKSUM});

      // work out length of line for checksum purposes
      let lineLength = (9 + dataLength + 2)  

      // if actual length of line is less than calculated, then fail
      if (line.length < lineLength ){
        winston.error({message: 'programNode: READ LINE: line too short for RECLEN ' + line});
        return false;
      }  

    if (lineLength > 0 ){
      // test the checksum to see if the line is valid
      // Start at index 1 to ignore the MARK symbol at index 0
      var lineChecksum = 0x00
      for (var i = 1; i < lineLength; i += 2) {
        lineChecksum += parseInt(line.substr(i, 2), 16)
        lineChecksum &= 0xFF
      }
      if (lineChecksum != 0) {
        winston.error({message: 'programNode: READ LINE: checksum error ' + lineChecksum});
        return false;
      }
    } else {
      // wasn't a valid linelength, so fail
      winston.error({message: 'programNode: READ LINE: invalid calculated length ' + line});
      return false;    
    }

    // ok, line is valid so start processing it

    //
    // Area's are used to describe the type of content, and have no effect on addressing
    // Blocks are continuous 'runs' of data, if there's a gap, then start a new block
    // but the output array is padded out to a pre-defined size
    // so if the gap is small, and within the padded area (or +1), then treat as continuous
    //

    switch (RECTYP){
      case 0:
        //winston.debug({message: 'programNode: line decode: Data Record: '});
        for (let i =0; i < data.length/2; i++){
          var absoluteAddress = this.decodeState.LBA + OFFSET + i
          var dataByte = parseInt(data[i*2]+data[i*2+1], 16)
          this.processDataByte(absoluteAddress, dataByte)
        }
        //winston.debug({message: name + ': decodeLineNG: FIRMWARE: ' + JSON.stringify(this.FIRMWARE)});
        break;
      case 1:
        winston.debug({message: 'programNode: line decode: End of File Record:'});
        break;
      case 2:
        winston.warn({message: 'programNode: line decode: Extended Segment Address Record:'});
        break;
      case 3:
        winston.warn({message: 'programNode: line decode: Start Segment Address Record:'});
        break;
      case 4:
        winston.debug({message: 'programNode: line decode: Extended Linear Address Record:'});
        this.decodeState.LBA = parseInt(data, 16)<<16 + OFFSET
        // get the area for this
        this.decodeState.area = this.getArea(this.decodeState.LBA, this.nodeCpuType)
        // don't overite an existing area
        if (this.FIRMWARE[this.decodeState.area] == undefined) {
          this.FIRMWARE[this.decodeState.area] = {} 
        }
        this.decodeState.blockAddress = this.decodeState.LBA       // reset block address
        this.decodeState.blockAddressPtr = 0                        // reset pointer
        this.decodeState.blockPaddingPtr = 0
        winston.debug({message: 'programNode: line decode: LBA: ' 
          + utils.decToHex(this.decodeState.LBA,8)
          + ' area ' + this.decodeState.area
        });
        break;
      case 5:
        winston.warn({message: 'programNode: line decode: Start Linear Address Record:'});
        break;
      default:
    }

//    winston.debug({message: name + ': decodeLineNG: FIRMWARE: ' + JSON.stringify(this.FIRMWARE)});

  /*
    for (const area in this.FIRMWARE) {
      for (const block in this.FIRMWARE[area]) {
        winston.debug({message: name + ': decodeLineNG: FIRMWARE: ' + area + ': ' + utils.decToHex(block, 6) + ' length: ' + this.FIRMWARE[area][block].length});
      }
    } 
  */

    return true
  }

  processDataByte(absoluteAddress, dataByte){
//    winston.debug({message: 'programNode: processDataByte: ' + utils.decToHex(absoluteAddress, 8) + ':' + utils.decToHex(dataByte, 2) }) 

    this.setCurrentBlock(absoluteAddress)
    // pointer may have changed, so check padding
    this.checkPadding()

    //
    // now lets write the data into the FIRMWARE array
    // we want to write it into the firmware block, at an offset from the block start
    // so we need to subtract the block address from the input data absolute address
    // and set the pointer to that value
    // pointer will have changed, so check padding
    //
    this.decodeState.blockAddressPtr = absoluteAddress - this.decodeState.blockAddress
    this.checkPadding()
    this.FIRMWARE[this.decodeState.area][this.decodeState.blockAddress][this.decodeState.blockAddressPtr++] = dataByte

/*    
    winston.debug({message: 'programNode: write DataByte: ' + utils.decToHex(dataByte, 2) 
      + ' absolute ' + utils.decToHex(absoluteAddress, 8)
      + ' to block  ' + utils.decToHex(this.decodeState.blockAddress, 8)
      + ' + ptr ' + utils.decToHex(this.decodeState.blockAddressPtr, 8)
    }) 
*/

  }

  //
  // Need to check if input absoluteAddress is within the scope of the current block
  // or do we need to start a new block
  // we set 16 bytes of padding, on a 16 byte boundary
  // scope of block is this set of padding, and next set of padding, hence adding 31 bytes
  // special case when 0x800 boundary is reached
  //
  setCurrentBlock(absoluteAddress){
    var targetAbsoluteAddress = this.decodeState.blockAddress + this.decodeState.blockAddressPtr
    var targetChunk = (targetAbsoluteAddress & 0xFFFFFFF0) + 31

    if ((targetAbsoluteAddress <= 0x800) & (absoluteAddress >= 0x800)){
      // need new area & block starting at 0x800
      this.decodeState.area = 'FLASH'
      this.decodeState.blockAddress = 0x800
      this.decodeState.blockAddressPtr = 0
      this.decodeState.blockPaddingPtr = 0
      winston.debug({message: 'programNode: line decode: New block at 0x800 : ' + utils.decToHex(this.decodeState.blockAddress, 8)});
    } 
    else if (absoluteAddress > targetChunk) {
      // need new block
      this.decodeState.blockAddress = absoluteAddress & 0xFFFFFFF0
      this.decodeState.blockAddressPtr = 0
      this.decodeState.blockPaddingPtr = 0
      winston.debug({message: 'programNode: line decode: New block : ' + utils.decToHex(this.decodeState.blockAddress, 8)});
    }

    // ensure block exists in FIRMWARE structure, it may be a new one
    if (this.FIRMWARE[this.decodeState.area] == undefined) {
      this.FIRMWARE[this.decodeState.area] = {} 
    }
    if (this.FIRMWARE[this.decodeState.area][this.decodeState.blockAddress] == undefined) {
      this.FIRMWARE[this.decodeState.area][this.decodeState.blockAddress] = [] 
    }

  }

  //
  // Need to check if we need to add anymore padding
  // The block should already have been set, so we only need to worry about the pointers
  // blockAddressPtr points to the next index to be written
  // blockPaddingPtr points to the next index after the end of the paddding
  // if blockAddressPtr < blockPaddingPtr, we're going to write inside the padding, so all good
  // if blockAddressPtr >= blockPaddingPtr, we need to extedn the padding
  // we'll call this everytime the pointer is changed to ensure we're upto date
  // with the padding, and don't overwrite anything already written 
  //
  checkPadding(){
    if(this.decodeState.blockAddressPtr >= this.decodeState.blockPaddingPtr) {
      var startIndex = this.decodeState.blockAddressPtr & 0xFFFFFFF0
      for (let i =0; i < 16; i++){
        this.FIRMWARE[this.decodeState.area][this.decodeState.blockAddress][startIndex + i] = 0xFF 
      }
      // set pointer to next index after padding
      this.decodeState.blockPaddingPtr = startIndex + 16
    }
  }

  //
  // work out which area the absolute address is in
  // for CPU type = 23, EEPROM start is at 0x380000
  //
  getArea(absoluteAddress, nodeCpuType){
    let eepromStart = 0x00F00000    //default
    if (nodeCpuType == 23){
      eepromStart = 0x380000        // start for 18F27Q83
    }

    let area = 'BOOT' 
    if      (absoluteAddress >= eepromStart) { area = 'EEPROM' }
    else if (absoluteAddress >= 0x00300000) { area = 'CONFIG' }
    else if (absoluteAddress >= 0x00000800) { area = 'FLASH' }
    else    { this.decodeState.area = 'BOOT' }
    return area
  }

};



module.exports = new programNode() 