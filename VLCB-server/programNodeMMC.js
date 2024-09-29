'use strict';
var winston = require('winston');		// use config from root instance
const net = require('net')
const fs = require('fs');
const readline = require('readline');
const jsonfile = require('jsonfile')
let cbusLib = require('cbuslibrary')
const EventEmitter = require('events').EventEmitter;
const utils = require('./../VLCB-server/utilities.js');


//
//
//
function decodeLine(FIRMWARE, line, callback) {
    var MARK = line.substr(0,1)
    var RECLEN = parseInt(line.substr(1,2), 16)
    var OFFSET = parseInt(line.substr(3,4), 16)
    var RECTYP = parseInt(line.substr(7,2), 16) 
    var data = line.substr(9, line.length - 9 - 2)
    var CHKSUM = parseInt(line.substr(line.length - 2, 2), 16)
    
    // test the checksum to see if the line is valid
    var linechecksum = 0x00
    for (var i = 1; i < line.length; i += 2) {
        linechecksum += parseInt(line.substr(i, 2), 16)
       linechecksum &= 0xFF
      winston.debug({message: 'programNode: READ LINE: ' + i + ' ' + linechecksum});
        }
    if (linechecksum != 0) {
      winston.debug({message: 'programNode: READ LINE: checksum error ' + linechecksum});
      if(callback) {callback(null);}
      return false;
    }
    
    // Check to see if the persistant variables has been initialized
    if ( typeof decodeLine.index == 'undefined' ) { decodeLine.index = 0; }
    if ( typeof decodeLine.area == 'undefined' ) { decodeLine.area = 'default'; }
    if ( typeof decodeLine.extAddressHex == 'undefined' ) { decodeLine.extAddressHex = '0000'; }
    if ( typeof decodeLine.startAddressHex == 'undefined' ) { decodeLine.startAddressHex = '00000000'; }
    
      winston.debug({message: 'programNode: READ LINE: MARK ' + MARK + 
      ' RECLEN ' + RECLEN + 
      ' OFFSET ' + OFFSET + 
      ' RECTYP ' + RECTYP + 
      ' data ' + data + 
      ' CHKSUM ' + CHKSUM });

    //
    // address of line start in the hex file is extAddressHex + OFFSET
    // address of line start in the array is startAddressHex + index in array 
    //

    if ( RECTYP == 0) { // Data Record:
        // Read data into a contiguous array in 16 byte chunks, on 16 byte boundaries - prefilled with '0xFF'
        // So, three choices - start new array, start new 'chunk' in existing array, or insert into existing 'chunk'
        // so first work out the physical addresses & mask out for 16 byte boundary
        var a = (parseInt(decodeLine.startAddressHex, 16) + decodeLine.index)>>4
        var b = ((parseInt(decodeLine.extAddressHex, 16) << 16) + OFFSET) >>4
        
        if (a == b) { // same chunk
            winston.debug({message: 'programNode: line decode: Data Record: Same chunk ' + a});
            if (FIRMWARE[decodeLine.area][decodeLine.startAddressHex] == undefined) {FIRMWARE[decodeLine.area][decodeLine.startAddressHex] = []}
            if (FIRMWARE[decodeLine.area][decodeLine.startAddressHex][0] == undefined) {
                winston.debug({message: 'programNode: line decode: Data Record: Same chunk - prep array '});
                for (var i = 0; i < 16; i++) { FIRMWARE[decodeLine.area][decodeLine.startAddressHex].push(255)}
            }
        } else if (a + 1 == b) { // next chunk
            winston.debug({message: 'programNode: line decode: Data Record: Next chunk ' + a + ' ' + b});
            decodeLine.index += 16
            for (var i = 0; i < 16; i++) { FIRMWARE[decodeLine.area][decodeLine.startAddressHex].push(255)}
        } else { // must be new array then
            winston.debug({message: 'programNode: line decode: Data Record: New array ' + a + ' ' + b});
            decodeLine.startAddressHex = decodeLine.extAddressHex + utils.decToHex(OFFSET & 0xFFE0, 4)
            if (FIRMWARE[decodeLine.area][decodeLine.startAddressHex] == undefined) {FIRMWARE[decodeLine.area][decodeLine.startAddressHex] = []}
            decodeLine.index = 0
            for (var i = 0; i < 16; i++) { FIRMWARE[decodeLine.area][decodeLine.startAddressHex].push(255)}
        }
        
        // the above code assumes each 'line' fits into a 16 byte chunk, arranged on a 16 byte boundary
        // so check if a line straddles a 16 byte boundary, and error if so
        if ( (OFFSET % 16) + RECLEN > 16) {
            winston.info({message: 'programNode: line decode: Data Record: *************************** ERROR - straddles boundary'});
        }
       
      if (FIRMWARE[decodeLine.area][decodeLine.startAddressHex] == undefined) {FIRMWARE[decodeLine.area][decodeLine.startAddressHex] = []}
      for (var i = 0; i < RECLEN; i++) {
        FIRMWARE[decodeLine.area][decodeLine.startAddressHex][decodeLine.index + i + OFFSET%16] = (parseInt(data.substr(i*2, 2), 16))
      }

      var chunkLine = []
      for (var i = 0; i < 16; i++) { 
        chunkLine.push(utils.decToHex(FIRMWARE[decodeLine.area][decodeLine.startAddressHex][decodeLine.index + i], 2))
      }
      winston.debug({message: 'programNode: line decode: Chunk Line:  ' + decodeLine.area + ' ' + decodeLine.startAddressHex + ' ' + utils.decToHex(decodeLine.index, 4) + ' ' + chunkLine});
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
      winston.debug({message: 'programNode: line decode: Extended Segment Address Record:'});
    }

    if ( RECTYP == 3) {
      winston.debug({message: 'programNode: line decode: Start Segment Address Record:'});
    }

    if ( RECTYP == 4) {
      winston.debug({message: 'programNode: line decode: Extended Linear Address Record: ' + data});
      if (data == '0000') {decodeLine.area = 'FLASH'}
      if (data == '0030') {decodeLine.area = 'CONFIG'}
      if (data == '00F0') {decodeLine.area = 'EEPROM'}
      decodeLine.extAddressHex = data
      winston.debug({message: 'programNode: ******** NEW MEMORY AREA: ' + decodeLine.area + ' area address ' + data })
      if (FIRMWARE[decodeLine.area] == undefined) {FIRMWARE[decodeLine.area] = []}
    }

    if ( RECTYP == 5) {
      winston.debug({message: 'programNode: line decode: Start Linear Address Record:'});
    }
    
    return true
}


//
//
//
class programNode extends EventEmitter  {
    constructor(NET_ADDRESS, NET_PORT) {
        super()
        this.net_address = NET_ADDRESS
        this.net_port = NET_PORT
        this.client = null
        this.FIRMWARE = {}
        this.nodeNumber = null
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
    */
    async program (NODENUMBER, CPUTYPE, FLAGS, INTEL_HEX_STRING) {
      winston.debug({message: 'programNode: Started'})
      this.success = false
      this.nodeNumber = NODENUMBER
      this.client = new net.Socket()
      this.client.connect(this.net_port, this.net_address, function () {
        winston.info({message: 'programNode: this Client Connected ' + this.net_address + ':' + this.net_port});
      }.bind(this))
      await utils.sleep(500)
      this.client.write|("test")

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

                    this.client.on('data', function (message) {
                        var cbusMsg = cbusLib.decode(message.toString())
                        winston.info({message: 'programNode: CBUS Receive  <<<: ' + cbusMsg.text});
                            if (cbusMsg.response == 0) {
                                winston.debug({message: 'programNode: Check NOT OK received: download failed'});
                                this.sendFailureToClient('Check NOT OK received: download failed')
                            }
                        if (cbusMsg.operation == 'RESPONSE') {
                            if (cbusMsg.response == 1) {
                                winston.debug({message: 'programNode: Check OK received: Sending reset'});
                                var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', 0x0D, 0x01, 0, 0)
                                this.transmitCBUS(msg)
                                // ok, can shutdown the connection now
                                this.client.end();
                                winston.debug({message: 'programNode: Client closed normally'});
                                this.success = true
                                // 'Success:' is a necessary string in the message to signal the client it's been successful
                                this.sendSuccessToClient('Success: programing completed')
                                this.client.removeAllListeners()
                            }
                            if (cbusMsg.response == 2) {
                                winston.debug({message: 'programNode: BOOT MODE Confirmed received:'});
                                this.sendFirmware(FLAGS)
                            }
                        }
                    }.bind(this))

                    // set boot mode
                    var msg = cbusLib.encodeBOOTM(NODENUMBER)
                    this.transmitCBUS(msg)
                    
                    // need to allow a small time for module to go into boot mode
                    await utils.sleep(500)
                    var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', 0x0D, 0x04, 0, 0)
                    this.transmitCBUS(msg)
                    
                    // ok, need to check if it's completed after a reasonable time, if not must have failed
                    // allow 10 seconds
                    setTimeout(() => {
                        winston.debug({message: 'programNode: ***************** download: ENDING - success is ' + this.success});
                        // 'Failed:' is a necessary string in the message to signal the client it's failed
                        if (this.success == false) { this.sendFailureToClient('Failed: Timeout') }               
                    }, 25000)
                }
                else {
                    this.sendFailureToClient('Failed: file parsing failed')
                }
            }.bind(this))
            
        } catch (error) {
            winston.debug({message: 'programNode: ERROR: ' + error});
            this.sendFailureToClient('ERROR: ' + error)
        }
    }
    

    programBootMode (CPUTYPE, FLAGS, INTEL_HEX_STRING) {
        this.success = false
        this.nodeNumber = null

        try {
            // parse the intel hex file into our firmware object
            this.parseHexFile(INTEL_HEX_STRING, function (firmwareObject) {

                if (firmwareObject == null) {
                    this.sendFailureToClient('Failed: file parsing failed')
                    return
                }

                winston.debug({message: 'programBootMode: >>>>>>>>>>>>> parseHexFile callback ' + JSON.stringify(firmwareObject)})

                this.FIRMWARE = firmwareObject
                
                if (FLAGS & 0x4) {
                    this.sendMessageToClient('CPUTYPE ignored')
                } else {
                    if (this.checkCPUTYPE (CPUTYPE, this.FIRMWARE) != true) {
                        winston.debug({message: 'programBootMode: >>>>>>>>>>>>> cpu check: FAILED'})
                        this.sendFailureToClient('CPU mismatch')
                        return;
                    }
                }
               
                this.client = new net.Socket()
                
                this.client.connect(this.net_port, this.net_address, function () {
                    winston.debug({message: 'programBootMode: Client Connected ' + this.net_address + ':' + this.net_port});
                }.bind(this))
                
                this.client.on('error', (err) => {
                    var msg = 'TCP ERROR: ' + err.code
                    winston.debug({message: 'programBootMode: ' + msg});
                    this.sendFailureToClient(msg)
                })
                
                this.client.on('close', function () {
                    winston.debug({message: 'programBootMode: Connection Closed'});
                })

                this.client.on('data', function (message) {
                    var cbusMsg = cbusLib.decode(message.toString())
                    winston.info({message: 'programBootMode: CBUS Receive  <<<: ' + cbusMsg.text});
                        if (cbusMsg.response == 0) {
                            winston.debug({message: 'programBootMode: Check NOT OK received: download failed'});
                            this.sendFailureToClient('Check NOT OK received: download failed')
                        }
                    if (cbusMsg.operation == 'RESPONSE') {
                        if (cbusMsg.response == 1) {
                            winston.debug({message: 'programBootMode: Check OK received: Sending reset'});
                            var msg = cbusLib.encode_EXT_PUT_CONTROL('000000', 0x0D, 0x01, 0, 0)
                            this.transmitCBUS(msg)
                            // ok, can shutdown the connection now
                            this.client.end();
                            winston.debug({message: 'programBootMode: Client closed normally'});
                            this.success = true
                            // 'Success:' is a necessary string in the message to signal the client it's been successful
                            this.sendSuccessToClient('Success: programing completed')
                            this.client.removeAllListeners()
                        }
                        if (cbusMsg.response == 2) {
                            winston.debug({message: 'programBootMode: WARNING - unexpected BOOT MODE Confirmed received:'});
                        }
                    }
                }.bind(this))

                // ok, alreay in boot mode, so can immediately start downloading firmware
                this.sendFirmware(FLAGS)
                
                // ok, need to check if it's completed after a reasonable time, if not must have failed
                // allow 10 seconds
                setTimeout(() => {
                    winston.debug({message: 'programBootMode: ***************** download: ENDING - success is ' + this.success});
                    // 'Failed:' is a necessary string in the message to signal the client it's failed
                    if (this.success == false) { this.sendFailureToClient('Failed: Timeout') }               
                }, 25000)
                
            }.bind(this))

        } catch (error) {
            winston.debug({message: 'programBootMode: ERROR: ' + error});
            this.sendFailureToClient('ERROR: ' + error)
        }
    }


    //
    //
    //
    sendFirmware(FLAGS) {
        winston.debug({message: 'programNode: Started sending firmware - FLAGS ' + FLAGS});
        // sending the firmware needs to be done in 8 byte messages
        // and to allow the receiving module to keep up, we use an incrementing 'stagger' value on the timeout
        //
        var pauseTime = 30
        var staggeredTimeout = 0;
        // we need to keep a running checksum of all the data we send, so we can include it in the check message at the end
        var calculatedChecksum;
        // we want to indicate progress for each region, so we keep a counter that we can reset and then incrmeent for each region
        var progressCount = 0
        
        // always do FLASH area, but only starting from 00000800
        var program = this.FIRMWARE['FLASH']['00000800']
        winston.debug({message: 'programNode: FLASH : 00000800 length: ' + program.length});
        var msg = cbusLib.encode_EXT_PUT_CONTROL('000800', 0x0D, 0x02, 0, 0)
        this.transmitCBUS(msg)
        
        for (let i = 0; i < program.length; i += 8) {
            setTimeout((program) => {
                var chunk = program.slice(i, i + 8)
                var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
                this.transmitCBUS(msgData)
                calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
                winston.debug({message: 'programNode: sending FLASH data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
                if (progressCount <= i) {
                    progressCount += 128    // report every 16 messages
                    var text = 'Progress: FLASH ' + Math.round(i/program.length * 100) + '%'
                    this.sendBootModeToClient(text)
                }
            }, staggeredTimeout += pauseTime, program)
        }
        
        if (FLAGS & 0x1) {      // Program CONFIG area
            for (const block in this.FIRMWARE['CONFIG']) {
                var config = this.FIRMWARE['CONFIG'][block]
                winston.debug({message: 'programNode: CONFIG : ' + block + ' length: ' + config.length});
                setTimeout(() => {
                    var msgData = cbusLib.encode_EXT_PUT_CONTROL(block.substr(2), 0x0D, 0x00, 0, 0)
                    winston.debug({message: 'programNode: sending CONFIG address: ' + msgData});
                    this.transmitCBUS(msgData)
                }, staggeredTimeout += 8)
                for (let i = 0; i < config.length; i += 8) {
                    setTimeout((config) => {
                        var chunk = config.slice(i, i + 8)
                        var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
                        this.transmitCBUS(msgData)
                        calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
                        winston.debug({message: 'programNode: sending CONFIG data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
                        // report progress on every message
                        var text = 'Progress: CONFIG ' + Math.round(i/config.length * 100) + '%'
                        this.sendBootModeToClient(text)
                    }, staggeredTimeout += pauseTime, config)
                }
            }
        }
        
        if (FLAGS & 0x2) {      // Program EEPROM area
            for (const block in this.FIRMWARE['EEPROM']) {
                var eeprom = this.FIRMWARE['EEPROM'][block]
                winston.debug({message: 'programNode: EEPROM : ' + block + ' length: ' + eeprom.length});
                setTimeout(() => {
                    var msgData = cbusLib.encode_EXT_PUT_CONTROL(block.substr(2), 0x0D, 0x00, 0, 0)
                    winston.debug({message: 'programNode: sending EEPROM address: ' + msgData});
                    this.transmitCBUS(msgData)
                }, staggeredTimeout += 8)
                for (let i = 0; i < eeprom.length; i += 8) {
                    setTimeout((eeprom) => {
                        var chunk = eeprom.slice(i, i + 8)
                        var msgData = cbusLib.encode_EXT_PUT_DATA(chunk)
                        this.transmitCBUS(msgData)
                        calculatedChecksum = this.arrayChecksum(chunk, calculatedChecksum)
                        winston.debug({message: 'programNode: sending EEPROM data: ' + i + ' ' + msgData + ' Rolling CKSM ' + calculatedChecksum});
                        // report progress on every message
                        var text = 'Progress: EEPROM ' + Math.round(i/eeprom.length * 100) + '%  ' +  + i/eeprom.length
                        this.sendBootModeToClient(text)
                    }, staggeredTimeout += pauseTime, eeprom)
                }
            }
        }
        
        setTimeout(() => {
            // Verify Checksum
            // 00049272: Send: :X00080004N000000000D034122;
            winston.debug({message: 'programNode: Sending Check firmware'});
            var msgData = cbusLib.encode_EXT_PUT_CONTROL('000000', 0x0D, 0x03, parseInt(calculatedChecksum.substr(2,2), 16), parseInt(calculatedChecksum.substr(0,2),16))
            this.transmitCBUS(msgData)
        },  staggeredTimeout += 200)
    }
    

    //
    //
    //
    arrayChecksum(array, start) {
        var checksum = 0;
        if ( start != undefined) {
            checksum = (parseInt(start, 16) ^ 0xFFFF) + 1;
        }
        for (var i = 0; i <array.length; i++) {
            checksum += array[i]
            checksum = checksum & 0xFFFF        // trim to 16 bits
        }
        var checksum2C = utils.decToHex((checksum ^ 0xFFFF) + 1, 4)    // checksum as two's complement in hexadecimal
        winston.debug({message: 'programNode: arrayChecksum: ' + checksum2C});
        return checksum2C
    }



    //
    //
    //
    parseHexFile(intelHexString, CALLBACK) {
        var firmware = {}

        this.sendMessageToClient('Parsing file')
        winston.debug({message: 'programNode: parseHexFile - hex ' + intelHexString})

        const lines = intelHexString.toString().split("\r\n");
        winston.debug({message: 'programNode: parseHexFile - line count ' + lines.length})

        for (var i = 0; i < lines.length - 1; i++) {
        winston.debug({message: 'programNode: parseHexFile - line ' + lines[i]})

            var result = decodeLine(firmware, lines[i], function (firmwareObject) {
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
      this.client.write(JSON.stringify(jsonMessage))
      await utils.sleep(10)
    }


    sendMessageToClient(text) {this.emitMessageToClient('Pending', text)}
    sendSuccessToClient(text) {this.emitMessageToClient('Success', text)}
    sendFailureToClient(text) {this.emitMessageToClient('Failure', text)}
    sendBootModeToClient(text) {this.emitMessageToClient('BootMode', text)}

    emitMessageToClient(status, text) {
        const data = {
			"status": status,
			"nodeNumber": this.nodeNumber,
			"text": text }
        this.emit('programNode', data)
        winston.info({message: 'programNode: Emit: ' + JSON.stringify(data)})
    }

};


module.exports = ( NET_ADDRESS, NET_PORT ) => { return new programNode( NET_ADDRESS, NET_PORT ) }