'use strict';
var winston = require('winston');		// use config from root instance
const net = require('net')
const fs = require('fs');
const readline = require('readline');
const jsonfile = require('jsonfile')
const path = require('path');
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

// FLAGS
const FLAG_PROGRAM_CONFIG = 1
const FLAG_PROGRAM_EEPROM = 2
const FLAG_IGNORE_CPUTYPE = 4
const FLAG_PROGRAM_IN_BOOTMODE = 8


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
//  || set programState = STATE_FIRMWARE
//  || send intial control message SPCMD_INIT_CHK (2) with address 0000 & CONTROL_BITS
//  || then for each block.... always starting at block 000800
//  || send control message SPCMD_NOP (0) with block address & CONTROL_BITS
//  || send all data messages for that block
//  || if more blocks, send control with new block address & then data...
//  || when all data sent...
//  || set programState = STATE_END_FIRMWARE
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
const STATE_END_FIRMWARE = 4


//
//
//
class programNode extends EventEmitter  {
  constructor(config) {
    super()
    this.config = config
    this.FIRMWARE = {}
    this.NEWFIRMWARE = {}
    this.TRANSMIT_DATA_BLOCKS = {}
    this.nodeNumber = null
    this.ackReceived = false
    this.decodeState = {}
    this.programState = STATE_NULL
    this.nodeCpuType = null
    this.success = false
    this.COMMAND_FLAGS = 0

    // event handler for responses from node
    this.config.eventBus.on('GRID_CONNECT_RECEIVE', async function GDR (data) {
      winston.debug({message: name + `:  GRID_CONNECT_RECEIVE ${data}`})
      let cbusMsg = cbusLib.decode(data)
      try {
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
              if (this.programState == STATE_END_FIRMWARE){
                winston.debug({message: 'programNode: Check OK received: Sending reset'});
                var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x01, 0, 0)
                await this.transmitCBUS(msg, 80)
                this.success = true
                // 'Success:' is a necessary string in the message to signal the client it's been successful
                this.sendSuccessToClient('Success: programing completed')
                this.programState = STATE_QUIT
              } else {
                winston.debug({message: 'programNode: ACK received'});
              }
            }
            if (cbusMsg.response == 2) {
              winston.debug({message: 'programNode: BOOT MODE Confirmed received:'});
              if (this.programState != STATE_FIRMWARE){
                await this.send_to_node(this.COMMAND_FLAGS)
              }
            }
          }
        }
      } catch (err){
        winston.debug({message: name + ': event handler: ' + err});
      }
    }.bind(this))


  } // end constructor
    
  // sets any cpu dependent values at run time
  //
  setCpuType(cpuType){
    this.nodeCpuType = cpuType
    this.area_start = {
      "BOOT": 0,
      "FLASH":0x800,
      "CONFIG":0x300000,
      "EEPROM":0xF00000
    }
    // modify EEPROM_START for certain cpu's
    if (this.nodeCpuType == 23){
      this.EEPROM_START = 0x380000        // start for 18F27Q83
      this.area_start.EEPROM = 0x380000
    }
    winston.info({message: name + `:  area_start.EEPROM ${this.area_start.EEPROM}`})
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
    this.TxCount = 0
    this.dataCount = 0
    this.assembledDataCount = 0
    this.COMMAND_FLAGS = FLAGS
    this.calculatedHexChecksum = '0000'
    this.ackReceived = false

    // set any cpu dependent values
    this.setCpuType(CPUTYPE)

    //
    //
    if (this.parseHexFile(INTEL_HEX_STRING)){
      winston.debug({message: 'programNode: parseHexFile success'})

      if (this.COMMAND_FLAGS & 0x4) {
        this.sendMessageToClient('CPUTYPE ignored')
      } else {
        if (this.checkCPUTYPE (CPUTYPE) != true) {
          winston.debug({message: 'programNode: >>>>>>>>>>>>> cpu check: FAILED'})
          this.sendFailureToClient('CPU mismatch')
          this.programState = STATE_QUIT
        }
      }
      winston.debug({message: 'programNode: parseHexFile success 2'})

      if (this.programState != STATE_QUIT){
        // not quiting, so proceed...
        if (this.COMMAND_FLAGS & 0x8) {
          // already in boot mode, so proceed with download
          winston.debug({message: 'programNode: already in BOOT MODE: starting download'});
          await this.send_to_node(this.COMMAND_FLAGS)
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
    this.config.writeBootloaderdata("****** End download ******");

  } /// end program method
  
  //
  //
  async send_to_node(FLAGS){
    winston.info({message: `programNode: send_to_node: ${FLAGS}` });
    this.programState = STATE_FIRMWARE
    this.last_block_address = null

    this.config.writeBootloaderdata("****** Start download ******");
    this.config.writeBootloaderdata("CPU TYPE    : " + this.nodeCpuType);
    this.config.writeBootloaderdata("FLASH  Start: " + utils.decToHex(this.area_start.FLASH, 8));
    this.config.writeBootloaderdata("CONFIG Start: " + utils.decToHex(this.area_start.CONFIG, 8));
    this.config.writeBootloaderdata("EEPROM Start: " + utils.decToHex(this.area_start.EEPROM, 8));


    // start with SPCMD_INIT_CHK
    var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, SPCMD_INIT_CHK, 0, 0)
    winston.debug({message: 'programNode: sending SPCMD_INIT_CHK: ' + msgData});
    await this.transmitCBUS(msgData, 80)
    
    // note that ECMAScript 2020 defines ordering for 'for in', so no need to re-order
    for (const block in this.TRANSMIT_DATA_BLOCKS) {
      //winston.info({message: `programNode: send_to_node: ${JSON.stringify(block)}` });
      await this.send_block(block)
    }

    //
    this.programState = STATE_END_FIRMWARE
    
    // Verify Checksum
    // 00049272: Send: :X00080004N000000000D034122;
    winston.debug({message: 'programNode: Sending Check firmware'});
    winston.info({message: 'programNode: calculatedHexChecksum ' + this.calculatedHexChecksum });

    this.sendMessageToClient('FIRMWARE: checksum: 0x' + this.calculatedHexChecksum + ' length: ' + this.dataCount)
    //      winston.info({message: 'programNode: calculatedHexChecksum ' + JSON.stringify(fullArray)});

    var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', CONTROL_BITS, 0x03, parseInt(this.calculatedHexChecksum.substr(2,2), 16), parseInt(this.calculatedHexChecksum.substr(0,2),16))
    await this.transmitCBUS(msgData, 60)

  }

  //
  //
  async send_block(block_address){  
    let area = this.getArea(block_address)
    // be careful to ensure value is numeric before addition
    if (block_address != parseInt(this.last_block_address) + 8){
      await this.start_new_segment(block_address)
    }
    
    let string = area + " : " + utils.decToHex(block_address,8) + " "
    for (let i=0; i<this.TRANSMIT_DATA_BLOCKS[block_address].length; i++ ){
      string += utils.decToHex(this.TRANSMIT_DATA_BLOCKS[block_address][i],2) + ' '
    }
    winston.info({message: `programNode: send_to_node: ${string}` });
    this.config.writeBootloaderdata( string);
    this.last_block_address = block_address

    this.calculatedHexChecksum = this.arrayChecksum(this.TRANSMIT_DATA_BLOCKS[block_address], this.calculatedHexChecksum)

    var msgData = cbusLib.encode_EXT_PUT_DATA(this.TRANSMIT_DATA_BLOCKS[block_address])
    winston.debug({message: `programNode: sending ${area} data: ${msgData}` });
    await this.transmitCBUS(msgData, 60)
    this.dataCount += 8

    if (true) {
      // report progress every 16 messages (128 bytes)
      var progress = (this.dataCount / this.assembledDataCount) * 100
      var text = `Progress: ${area} ${utils.decToHex(block_address, 6)} : ${Math.round(progress)}%`
      this.sendBootModeToClient(text)
    }

  }

  //
  //
  async start_new_segment(block){
    winston.info({message: `programNode: send_to_node: new data segment: ${utils.decToHex(block, 8)}` });
    var msgData = cbusLib.encode_EXT_PUT_CONTROL(utils.decToHex(block, 6), CONTROL_BITS, 0x00, 0, 0)
    winston.debug({message: 'programNode: sending segment address: ' + msgData});
    await this.transmitCBUS(msgData, 60)
    this.config.writeBootloaderdata(">> New segment " + utils.decToHex(block, 8));
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
    this.TRANSMIT_DATA_BLOCKS = {}
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

      /*
      for (const area in this.FIRMWARE) {
        for (const block in this.FIRMWARE[area]) {
          winston.info({message: 'programNode: parseHexFile: FIRMWARE: ' + area + ': ' + utils.decToHex(block, 8) + ' length: ' + this.FIRMWARE[area][block].length});
        }
      } 
      for (const area in this.NEWFIRMWARE) {
        winston.info({message: 'programNode: parseHexFile: NEWFIRMWARE: ' + area + ': length: ' + this.NEWFIRMWARE[area].length});
      } 
      */

      winston.info({message: `programNode: parseHexFile: ${JSON.stringify(this.TRANSMIT_DATA_BLOCKS)}` });
      for (const block in this.TRANSMIT_DATA_BLOCKS) {
        let string = ""
        for (let i=0; i<this.TRANSMIT_DATA_BLOCKS[block].length; i++ ){
          string += utils.decToHex(this.TRANSMIT_DATA_BLOCKS[block][i],2) + ' '
        }
        winston.info({message: `programNode: parseHexFile: TRANSMIT_ARRAYS: ${utils.decToHex(block,8)} ${string}` });
      } 
    }

    return result
  }


  //
  //
  //
  checkCPUTYPE (nodeCPU) {
    //
    // parameters start at offset 0x820 in the firmware download
    // cpu type is a byte value at 0x828
    //
    var result = false
    var targetCPU =null
    if(this.TRANSMIT_DATA_BLOCKS[0x828]){
      targetCPU = this.TRANSMIT_DATA_BLOCKS[0x828][0]
    }
    winston.info({message: 'programNode: >>>>>>>>>>>>> cpu check: selected target: ' + nodeCPU + ' firmware target: ' + targetCPU})
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
    this.ackReceived = false  // set to false before writing
    winston.debug({message: `programNode: CBUS Transmit ${this.TxCount} ${msg}`})
    this.config.eventBus.emit ('GRID_CONNECT_SEND', msg)

    // need to add a delay between write to the module
    //
    var startTime = Date.now()
    await utils.sleep(1) // always allow at least 1mSecs anyway
    while (((Date.now() - startTime) < delay) && (this.ackReceived == false)){
      await utils.sleep(0)    // allow task switch (potentially takes a while anyway )
    }       
    winston.debug({message: name + `: CBUS Transmit time ${this.TxCount++} ${(Date.now() - startTime)}`})
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
          this.processDataByteNG(absoluteAddress, dataByte)
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

  // Build up the Transmit blocks structure
  // but only use the area's requested (FLAGS)
  //
  processDataByteNG(absoluteAddress, dataByte){
    if (this.checkValidArea(absoluteAddress)){
      let block = (absoluteAddress & 0xFFFFFFF8)
      if (this.TRANSMIT_DATA_BLOCKS[block] == undefined){
        // fill new block with FF's
        this.TRANSMIT_DATA_BLOCKS[block] = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
        winston.debug({message: `programNode: processDataByteNG:  new block ${utils.decToHex(block, 8)}` })
        this.assembledDataCount += 8
      }
      this.TRANSMIT_DATA_BLOCKS[block][absoluteAddress & 7] = dataByte
    }
  }

  //
  //
  checkValidArea(absoluteAddress){
    // always do FLASH
    if ((absoluteAddress >= this.area_start.FLASH) && (absoluteAddress < this.area_start.CONFIG)){
      return true
    }
    if (this.COMMAND_FLAGS & FLAG_PROGRAM_CONFIG){
      if ((absoluteAddress >= this.area_start.CONFIG) && (absoluteAddress < this.area_start.EEPROM)){
        return true
      }
    }
    if (this.COMMAND_FLAGS & FLAG_PROGRAM_EEPROM){
      if (absoluteAddress >= this.area_start.EEPROM){
        return true
      }
    }
    return false
  }

  //
  //
  getArea(absoluteAddress){
    if ((absoluteAddress >= this.area_start.FLASH) && (absoluteAddress < this.area_start.CONFIG)){
      return 'FLASH'
    }
    if ((absoluteAddress >= this.area_start.CONFIG) && (absoluteAddress < this.area_start.EEPROM)){
      return 'CONFIG'
    }
    if (absoluteAddress >= this.area_start.EEPROM){
      return 'EEPROM'
    }
    return 'BOOT'
  }

  processDataByte(absoluteAddress, dataByte){
    //winston.debug({message: `programNode: processDataByte:  ${utils.decToHex(absoluteAddress, 8)} data ${utils.decToHex(dataByte, 2)}` }) 

    let area = this.getArea(absoluteAddress, this.nodeCpuType)
    if (this.NEWFIRMWARE.area == undefined){this.NEWFIRMWARE[area] = []}
    let area_offset  = absoluteAddress-this.area_start[area]
    this.NEWFIRMWARE[area][area_offset] = dataByte
    //winston.debug({message: `programNode: processDataByte:  ${area} ${area_offset} data ${this.NEWFIRMWARE[area][area_offset]}` }) 

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
  //
  getArea(absoluteAddress){
    let area = 'BOOT' 
    if      (absoluteAddress >= this.area_start.EEPROM) { area = 'EEPROM' }
    else if (absoluteAddress >= this.area_start.CONFIG) { area = 'CONFIG' }
    else if (absoluteAddress >= this.area_start.FLASH) { area = 'FLASH' }
    //winston.debug({message: `programNode: getArea: ${absoluteAddress} ${area}`});
    return area
  }

};


module.exports = (config) => { return new programNode(config) } 