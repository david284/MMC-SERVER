const expect = require('chai').expect;
var itParam = require('mocha-param');
var winston = require('./config/winston_test.js');
const fs = require('fs');
const jsonfile = require('jsonfile')

const cbusLib = require('cbuslibrary')

const NET_PORT = 5591;
const NET_ADDRESS = "127.0.0.1"

const testSystemConfigPath = "./unit_tests/test_output/config"
const testUserConfigPath = "./unit_tests/test_output/test_user"
const config = require('../VLCB-server/configuration.js')(testSystemConfigPath, testUserConfigPath)

// set config items
config.setServerAddress("localhost")
config.setCbusServerPort(5570);
config.setJsonServerPort(5591);
config.setSocketServerPort(5572);


const mock_jsonServer = new (require('./mock_jsonServer'))(config.getJsonServerPort())


describe('programNode tests', function(){
    
	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '======================================================================'});
		winston.info({message: '------------------------ Program Node tests --------------------------'});
		winston.info({message: '======================================================================'});
		winston.info({message: ' '});
        done();
            
  	});
    
    beforeEach(function() {
   		winston.debug({message: '  '});   // blank line to separate tests
      mock_jsonServer.messagesIn = []
    })

	after(function(done) {
   		winston.debug({message: ' '});   // blank line to separate tests
        setTimeout(() => {
            winston.debug({message: 'TEST: programNode: Tests ended'});
            done();
        }, 1000)
	});																										
	
	//
    // Start of actual tests................
    // 


    //
    //
    //
	it('Checksum test', function() {
		winston.debug({message: 'TEST: Checksum:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    // expect to get two's compliment of 16 bit checksum returned
    var array = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00]
    // checksum of above is 06F9, so two's complement is F907
    var expected  = 'F907'
    expect(programNode.arrayChecksum(array)).to.equal(expected);
	});


    //
    // Use real hex file to ensure correct operation
    //
	it('Parse Hex File test', function(done) {
		winston.debug({message: 'TEST: Parse Hex File test:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/shortFile.HEX');
    var callbackInvoked = false
		programNode.parseHexFile(intelHexString, 
      function(firmwareObject){ 
        winston.debug({message: 'TEST: Parse Hex File Test: callback invoked: ' + JSON.stringify(firmwareObject)});
    //    expect(firmwareObject["FLASH"]['00000800'].length).to.equal(6064, 'FLASH length'); 
        expect(programNode.arrayChecksum(firmwareObject["FLASH"]['00000800'])).to.equal('EC12','checksum');
        callbackInvoked = true
      }
    );
		setTimeout(function(){
      expect(callbackInvoked).to.equal(true, 'callbackInvoked');
			done();
		}, 500);
	});


    //
    // test callback works on decode line function
    //
	it('decode line test', function() {
		winston.debug({message: 'TEST: decode line:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    var callbackInvoked = false
    var firmware = {}
		programNode.decodeLine(firmware, ':00000001FF', function(){ callbackInvoked = true;});
    expect(callbackInvoked).to.equal(true, 'callbackInvoked');
	});


    //
    // test line checksum works on decode line function
    //
	it('decode line checksum test', function() {
		winston.debug({message: 'TEST: decode line:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    var callbackInvoked = false
    var firmware = {}
    var result = 'notNull'
		programNode.decodeLine(firmware, ':00000008FF', function (firmwareObject){ 
      result = firmwareObject
      callbackInvoked = true;
    });
    expect(callbackInvoked).to.equal(true, 'callbackInvoked');
    expect(result).to.equal(null, 'callback result');
	});




    //
    // test sequence of operations on download
    // use shortened file to save time, as we've already tested parsing full hex file above
    //
    // expect: sequence to start with sending of BOOTM opcode
    // expect: next, Hex file loaded, parsed & downloaded - verify by testing checksum of downloaded file if 'Complete' event received
    // expect: Last thing, expect reset command sent
    //
	it('Download short test', function(done) {
		winston.info({message: 'TEST: BEGIN short download:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    programNode.on('programNode', function (data) {
    	downloadData = data;
	    winston.warn({message: 'TEST: short download: ' + JSON.stringify(downloadData)});
		});	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/shortFile.HEX');
		programNode.program(3000, 1, 3, intelHexString);
		setTimeout(function(){
      //
      // expect first message to be BOOTM
      var firstMsg = cbusLib.decode(mock_jsonServer.messagesIn[0])
			winston.info({message: 'TEST: short download: first message: ' + JSON.stringify(firstMsg)});
      expect(firstMsg.ID_TYPE).to.equal('S', 'first message ID_TYPE');
      expect(firstMsg.opCode).to.equal('5C', 'first message BOOTM 5C');
      //
      // verify checksum when process is signalled as complete
      expect(downloadData.status).to.equal('Success', 'Download event');
      expect(downloadData.text).to.equal('Success: programing completed', 'Download event');
      expect(mock_jsonServer.firmwareChecksum).to.equal('C68E', 'Checksum');
      //
      // check last message is a reset command
			winston.info({message: 'TEST: short download: number of message: ' + mock_jsonServer.messagesIn.length});
      var lastMsg = mock_jsonServer.messagesIn[mock_jsonServer.messagesIn.length - 1]
			winston.info({message: 'TEST: short download: last message: ' + JSON.stringify(lastMsg)});
      var lastMsg = cbusLib.decode(lastMsg)
			winston.debug({message: 'TEST: short download: last message: ' + lastMsg.text});
      expect(lastMsg.ID_TYPE).to.equal('X', 'last message ID_TYPE');
      expect(lastMsg.type).to.equal('CONTROL', 'last message control type');
      expect(lastMsg.SPCMD).to.equal(1, 'last message reset command');
      winston.info({message: 'TEST: END short download:'});
			done();
		}, 1000);
	});


    //
    // test sequence of operations on download
    // using full file this time
    //
    // expect: sequence to start with sending of BOOTM opcode
    // expect: next, Hex file loaded, parsed & downloaded - verify by testing checksum of downloaded file if 'Complete' event received
    // expect: Last thing, expect reset command sent
    //
	it('Download full test', function(done) {
		winston.info({message: 'TEST: full download:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    programNode.on('programNode', function (data) {
			downloadData = data;
			winston.warn({message: 'TEST: full download: ' + JSON.stringify(downloadData)});
    });	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/CANACC5_v2v.HEX');
		programNode.program(300, 1, 3, intelHexString);
		setTimeout(function(){
      //
      // expect first message to be BOOTM
      var firstMsg = cbusLib.decode(mock_jsonServer.messagesIn[0])
			winston.debug({message: 'TEST: full download: first message: ' + firstMsg.text});
      expect(firstMsg.ID_TYPE).to.equal('S', 'first message ID_TYPE');
      expect(firstMsg.opCode).to.equal('5C', 'first message BOOTM 5C');
      //
      // verify checksum when process is signalled as complete
      expect(downloadData.status).to.equal('Success', 'Download event');
      expect(downloadData.text).to.equal('Success: programing completed', 'Download event');
      //
      // check last message is a reset command
      var lastMsg = cbusLib.decode(mock_jsonServer.messagesIn[mock_jsonServer.messagesIn.length - 1])
      winston.debug({message: 'TEST: full download: last message: ' + lastMsg.text});
      expect(lastMsg.ID_TYPE).to.equal('X', 'last message ID_TYPE');
      expect(lastMsg.type).to.equal('CONTROL', 'last message control type');
      expect(lastMsg.SPCMD).to.equal(1, 'last message reset command');
      winston.info({message: 'TEST: END full download:'});
			done();
		}, 15000);
	});


    //
    // test rejection of corrupted file
    // use shortened file to save time, as we've already tested parsing full hex file above
    //
    // expect: sequence to start with sending of BOOTM opcode
    // expect: next, Hex file loaded, parsed & downloaded - verify by testing checksum of downloaded file if 'Complete' event received
    // expect: Last thing, expect reset command sent
    //
	it('Download corrupt file test', function(done) {
		winston.debug({message: 'TEST: corrupt download:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    var corruptFileData
    programNode.on('programNode', function (data) {
      corruptFileData = data;
		  winston.warn({message: 'TEST: corrupt download: ' + JSON.stringify(corruptFileData)});
		});	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/corruptFile.HEX');
		programNode.program(300, 1, 3, intelHexString);
		setTimeout(function(){
      expect (mock_jsonServer.messagesIn.length).to.equal(0, "check sent messages")
      expect(corruptFileData.status).to.equal("Failure", 'Download event');
      expect(corruptFileData.text).to.equal("Failed: file parsing failed", 'Download event');
      done();
		}, 1000);
	});



    //
    // use wrong cpu type, and short file
    //
	it('Download wrong file test', function(done) {
		winston.debug({message: 'TEST: wrong file:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    programNode.on('programNode', function (data) {
			downloadData = data;
			winston.warn({message: 'TEST: wrong file: ' + JSON.stringify(downloadData)});
    });	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/paramsOnly.HEX');
		programNode.program(300, 0, 0, intelHexString);
		setTimeout(function(){
      expect(downloadData.status).to.equal('Failure', 'Download event');
      expect(downloadData.text).to.equal('CPU mismatch', 'Download event');
			done();
		}, 500);
	});


    //
    // use wrong cpu type, and short file
    //
	it('Download ignore CPUTYPE test', function(done) {
		winston.debug({message: 'TEST: ignore CPUTYPE:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    downloadDataArray = []
    programNode.on('programNode', function (data) {
			downloadDataArray.push(data);
			winston.warn({message: 'TEST: ignore CPUTYPE: ' + JSON.stringify(data)});
    });	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/shortFile.HEX');
		programNode.program(300, 99, 4, intelHexString);
		setTimeout(function(){
      expect(downloadDataArray[1].text).to.equal('CPUTYPE ignored', 'Download event');
      expect(downloadDataArray[downloadDataArray.length-1].status).to.equal('Success', 'Download event');
      expect(downloadDataArray[downloadDataArray.length-1].text).to.equal('Success: programing completed', 'Download event');
			done();
		}, 1000);
	});



    //
    // test sequence of operations on program boot mode
    // use shortened file to save time, as we've already tested parsing full hex file above
    //
    // expect: module is already in boot mode, so doesn't need boot command, and onlt expects firmware, so won't respond to any other opcodes
    // expect: next, Hex file loaded, parsed & downloaded - verify by testing checksum of downloaded file if 'Complete' event received
    // expect: Last thing, expect reset command sent
    //
	it('programBootMode short test', function(done) {
		winston.debug({message: 'TEST: programBootMode:'});
    mock_jsonServer.firmware = []   // don't have a change to boot mode to reset captured firmware
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    programNode.on('programNode', function (data) {
			downloadData = data;
			winston.warn({message: 'TEST: programBootMode: ' + JSON.stringify(downloadData)});
    });	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/shortFile.HEX');
		programNode.programBootMode(1, 3, intelHexString);
		setTimeout(function(){
      //
      // verify process is signalled as complete & checksum correct
      expect(downloadData.status).to.equal("Success", 'programBootMode: expected event');
      expect(downloadData.text).to.equal('Success: programing completed', 'Download event');
      expect(mock_jsonServer.firmwareChecksum).to.equal('C68E', 'Checksum');
      //
      // check last message is a reset command
      var lastMsg = cbusLib.decode(mock_jsonServer.messagesIn[mock_jsonServer.messagesIn.length - 1])
			winston.debug({message: 'TEST: programBootMode: last message: ' + lastMsg.text});
      expect(lastMsg.ID_TYPE).to.equal('X', 'last message ID_TYPE');
      expect(lastMsg.type).to.equal('CONTROL', 'last message control type');
      expect(lastMsg.SPCMD).to.equal(1, 'last message reset command');
			done();
		}, 2000);
	});


    //
    // test corrupted file on program boot mode
    //
    // expect: module is already in boot mode, so doesn't need boot command, and onlt expects firmware, so won't respond to any other opcodes
    // expect: next, Hex file loaded, parsed & downloaded - verify by testing checksum of downloaded file if 'Complete' event received
    // expect: Last thing, expect reset command sent
    //
	it('programBootMode corrupt file test', function(done) {
		winston.debug({message: 'TEST: programBootMode: corrupt file test:'});
    const programNode = require('../VLCB-server/programNodeMMC.js')(NET_ADDRESS, NET_PORT)
    programNode.on('programNode', function (data) {
			downloadData = data;
			winston.warn({message: 'TEST: programBootMode: corrupt file test: ' + JSON.stringify(downloadData)});
    });	        
    var intelHexString = fs.readFileSync('./unit_tests/test_firmware/corruptFile.HEX');
		programNode.programBootMode(1, 3, intelHexString);
		setTimeout(function(){
      expect (mock_jsonServer.messagesIn.length).to.equal(0, "programBootMode: check sent messages")
      expect(downloadData.status).to.equal("Failure", 'programBootMode: expected event');
      expect(downloadData.text).to.equal('Failed: file parsing failed', 'programBootMode: expected event');
			done();
		}, 200);
	});



})