const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: socketServer.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');
const fs = require('fs');
const net = require('net')
//import io from 'socket.io-client'
const { io } = require("socket.io-client")
const cbusLib = require('cbuslibrary')
const utils = require('./../VLCB-server/utilities.js');


const socketServer = require('../VLCB-server/socketServer.js')

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const testSystemConfigPath = "./unit_tests/test_output/config"
const testUserConfigPath = "./unit_tests/test_output/test_user"
const config = require('../VLCB-server/configuration.js')(testSystemConfigPath, testUserConfigPath)

// set config items
config.setServerAddress("localhost")
config.setCbusServerPort(5570);
config.setJsonServerPort(5571);
config.setSocketServerPort(5572);


const mock_jsonServer = new (require('./mock_jsonServer'))(config.getJsonServerPort())


let status = {"busConnection":{
  "state":true
  }
}

const cbusServer = require('../VLCB-server/cbusServer')
const node = require('./../VLCB-server/mergAdminNode.js')(config)
const programNode = require('../VLCB-server/programNodeMMC.js')

node.connect('localhost', config.getJsonServerPort())
node.inUnitTest = true
socketServer.socketServer(config, node, mock_jsonServer, cbusServer, programNode, status)


function stringToHex(string) {
  // expects UTF-8 string
  var bytes = new TextEncoder().encode(string);
  return Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
}

function hexToString(hex) {
    // returns UTF-8 string
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i !== bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new TextDecoder().decode(bytes);
}

const name = 'unit_test: socketServer'

describe('socketServer tests', async function(){


  const socket = io(`http://${config.getServerAddress()}:${config.getSocketServerPort()}`)

  // Add a connect listener
  socket.on('connect', function (socket) {
    winston.info({message: 'socketserver: web socket Connected!'})
  });

  var layoutData = {}
  socket.on('LAYOUT_DATA', function (data) {
    layoutData = data;
//    winston.debug({message: ' layoutData : ' + JSON.stringify(layoutData)});
    });	

	before(async function() {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ socketServer tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
        
    await utils.sleep(200)
    //
    // Use local 'user' directory for tests...
    config.userConfigPath = "./unit_tests/test_output/test_user"
	});

	beforeEach(function() {
    winston.info({message: ' '});   // blank line to separate tests
    winston.info({message: ' '});   // blank line to separate tests
        // ensure expected CAN header is reset before each test run
	});

	after(function(done) {
		winston.info({message: ' '});   // blank line to separate tests
    // bit of timing to ensure all winston messages get sent before closing tests completely
    setTimeout(function(){
      done();
    }, 100);
	});																										


  //****************************************************************************************** */
  //
  // Actual tests after here...
  //
  //****************************************************************************************** */  

  function GetTestCase_boolean() {
    var testCases = [];
    testCases.push({'boolean':true});
    testCases.push({'boolean':false});
    return testCases;
  }

  function GetTestCase_nodeNumber() {
    var arg1, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      testCases.push({'nodeNumber':arg1});
    }
    return testCases;
  }

  function GetTestCase_event() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 4; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      if (a == 4) {arg1 = undefined}
      for (var b = 1; b<= 4; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 65535}
        if (b == 4) {arg2 = undefined}
        testCases.push({'nodeNumber':arg1, 'eventNumber': arg2});
      }
    }
    return testCases;
  }


  itParam("ACCESSORY_LONG_OFF test ${JSON.stringify(value)}", GetTestCase_event(), function (done, value) {
    winston.info({message: name +': BEGIN ACCESSORY_LONG_OFF test  ' + JSON.stringify(value)});
    mock_jsonServer.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_LONG_OFF')
    } else {
      socket.emit('ACCESSORY_LONG_OFF', {
        "nodeNumber": value.nodeNumber,
        "eventNumber": value.eventNumber
      })
    }
    //
    setTimeout(function(){
      if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        winston.info({message: name + ': raw result ' + mock_jsonServer.messagesIn[0]});
        CbusMsg = mock_jsonServer.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ACOF");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.eventNumber).to.equal(value.eventNumber);
      } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_jsonServer.messagesIn.length).to.equal(0);
      }
      winston.info({message: name + ': END ACCESSORY_LONG_OFF test'});
			done();
		}, 50);
  })


  itParam("ACCESSORY_LONG_ON test ${JSON.stringify(value)}", GetTestCase_event(), function (done, value) {
    winston.info({message: name + ': BEGIN ACCESSORY_LONG_ON test ' + JSON.stringify(value)});
    mock_jsonServer.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_LONG_ON')
    } else {
      socket.emit('ACCESSORY_LONG_ON', {
        "nodeNumber": value.nodeNumber,
        "eventNumber": value.eventNumber
      })
    }
    //
    setTimeout(function(){
      if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        winston.info({message: name + ': raw result ' + mock_jsonServer.messagesIn[0]});
        CbusMsg = mock_jsonServer.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ACON");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.eventNumber).to.equal(value.eventNumber);
      } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_jsonServer.messagesIn.length).to.equal(0);
      }
      winston.info({message: name +': END ACCESSORY_LONG_ON test'});
			done();
		}, 50);
  })


  itParam("ACCESSORY_SHORT_OFF test ${JSON.stringify(value)}", GetTestCase_event(), function (done, value) {
    winston.info({message: name +': BEGIN ACCESSORY_SHORT_OFF test  ' + JSON.stringify(value)});
    mock_jsonServer.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_SHORT_OFF')
    } else {
      socket.emit('ACCESSORY_SHORT_OFF', {
        "nodeNumber": value.nodeNumber,
        "deviceNumber": value.eventNumber
      })
    }
    //
    setTimeout(function(){
      if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        winston.info({message: name + ': raw result ' + mock_jsonServer.messagesIn[0]});
        CbusMsg = mock_jsonServer.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ASOF");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.deviceNumber).to.equal(value.eventNumber);
      } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_jsonServer.messagesIn.length).to.equal(0);
      }
      winston.info({message: name + ': END ACCESSORY_SHORT_OFF test'});
			done();
		}, 50);
  })


  itParam("ACCESSORY_SHORT_ON test ${JSON.stringify(value)}", GetTestCase_event(), function (done, value) {
    winston.info({message: name +': BEGIN ACCESSORY_SHORT_ON test  ' + JSON.stringify(value)});
    mock_jsonServer.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_SHORT_ON')
    } else {
      socket.emit('ACCESSORY_SHORT_ON', {
        "nodeNumber": value.nodeNumber,
        "deviceNumber": value.eventNumber
      })
    }
    //
    setTimeout(function(){
      if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        winston.info({message: name + ': raw result ' + mock_jsonServer.messagesIn[0]});
        CbusMsg = mock_jsonServer.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ASON");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.deviceNumber).to.equal(value.eventNumber);
      } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_jsonServer.messagesIn.length).to.equal(0);
      }
      winston.info({message: name + ': END ACCESSORY_SHORT_ON test'});
			done();
		}, 50);
  })


  //
  it("request_layout_list test", function (done) {
    winston.info({message: 'unit_test: BEGIN request_layout_list test '});
    //
    socket.once('LAYOUTS_LIST', function (data) {
			var layouts_list = data;
			winston.info({message: ' LAYOUTS_LIST : ' + JSON.stringify(layouts_list)});
			});	
    socket.emit('REQUEST_LAYOUTS_LIST')
    //
    setTimeout(function(){
      winston.info({message: 'unit_test: END request_layout_list test'});
			done();
		}, 100);
  })


  function GetTestCase_layout() {
    var arg1, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = "unit_test1 layout"}
      if (a == 2) {arg1 = "unit_test2 layout"}
      if (a == 3) {arg1 = "unit_test3 layout"}
      testCases.push({'layout':arg1});
    }
    return testCases;
  }


  //
  itParam("change_layout test ${JSON.stringify(value)}", GetTestCase_layout(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN change_layout test '});
    socket.emit('CHANGE_LAYOUT', value.layout)
    //
    setTimeout(function(){
      winston.info({message: ' layoutData : ' + JSON.stringify(layoutData)});
      expect(layoutData.layoutDetails.title).to.equal(value.layout);
      winston.info({message: 'unit_test: END change_layout test'});
			done();
		}, 30);
  })

  //
  it("request_version test", function (done) {
    winston.info({message: 'unit_test: BEGIN request_version test '});
    //
    socket.once('VERSION', function (data) {
			var version = data;
			winston.info({message: ' VERSION : ' + JSON.stringify(version)});
			});	
    socket.emit('REQUEST_VERSION')
    //
    setTimeout(function(){
      winston.info({message: 'unit_test: END request_version test'});
			done();
		}, 100);
  })


  itParam("SET_CAN_ID test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN SET_CAN_ID test - nodeNumber ' + value.nodeNumber});
    mock_jsonServer.messagesIn = []
    var data = {
      nodeNumber:value.nodeNumber,
      CAN_ID: 1
    }
    socket.emit('SET_CAN_ID', data)

    setTimeout(function(){
      CbusMsg = mock_jsonServer.messagesIn[0]
      winston.info({message: 'unit_test: result ' + JSON.stringify(CbusMsg)});
      expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber)
      expect(CbusMsg.CAN_ID).to.equal(1)
      winston.info({message: 'unit_test: END SET_CAN_ID test'});
			done();
		}, 200);
  })


  itParam("SET_NODE_NUMBER test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN SET_NODE_NUMBER test - nodeNumber ' + value.nodeNumber});
    mock_jsonServer.messagesIn = []
    socket.emit('SET_NODE_NUMBER', value.nodeNumber)

    setTimeout(function(){
      CbusMsg = mock_jsonServer.messagesIn[0]
      winston.info({message: 'unit_test: result ' + JSON.stringify(CbusMsg)});
      expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END SET_NODE_NUMBER test'});
			done();
		}, 200);
  })


  //
  //
  //
  itParam("REQUEST_NODE_NUMBER test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN REQUEST_NODE_NUMBER test '});
    var testMessage = cbusLib.encodeNAME("ABCDEFGH")
    mock_jsonServer.messagesIn = []
    nodeTraffic = []
    node.rqnnPreviousNodeNumber = value.nodeNumber
    var receivedNodeNumber = undefined
    var receivedNAME = undefined
    socket.once('REQUEST_NODE_NUMBER', function (nodeNumber, name) {
      receivedNodeNumber = nodeNumber
      receivedNAME = name
      winston.debug({message: 'unit_test: node.once - REQUEST_NODE_NUMBER ' + nodeNumber});
    })
    mock_jsonServer.inject(testMessage)
    setTimeout(function(){
      expect(receivedNodeNumber).to.equal(value.nodeNumber)
      expect(receivedNAME).to.equal("ABCDEFG")
      winston.info({message: 'unit_test: END REQUEST_NODE_NUMBER test'});
			done();
		}, 100);
  })


  //
  itParam("bus_connection_state test ${JSON.stringify(value)}", GetTestCase_boolean(), function (done, value) {
//    it("bus_connection_state test", function (done) {
    winston.info({message: name + ': BEGIN bus_connection_state test - boolean ' + value.boolean});
    config.eventBus.emit('bus_connection_state', value.boolean)
    //
    setTimeout(function(){
      winston.info({message: name + ': status.busConnection.state ' + status.busConnection.state});
      expect (status.busConnection.state).to.equal(value.boolean)
      winston.info({message: name + ': END bus_connection_state test'});
			done();
		}, 100);
  })


  it("REQUEST_BUS_CONNECTION test", function (done) {
    winston.info({message: name + ': BEGIN REQUEST_BUS_CONNECTION test '});
    var result = false
    socket.once('BUS_CONNECTION', function (data) {
      result = true
    })
    socket.emit('REQUEST_BUS_CONNECTION')
    //
    setTimeout(function(){
      winston.info({message: name + ': result ' + result});
      expect (result).to.equal(true)
      winston.info({message: name + ': END REQUEST_BUS_CONNECTION test'});
			done();
		}, 200);
  })


  function GetTestCase_teach_event() {
    var argA, argB, argC, argD, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = "00000000"}
        if (b == 2) {argB = "00000001"}
        if (b == 3) {argB = "FFFFFFFF"}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          for (var d = 1; d<= 3; d++) {
            if (d == 1) {argD = 0}
            if (d == 2) {argD = 1}
            if (d == 3) {argD = 255}
              testCases.push({'nodeNumber':argA, 'eventIdentifier': argB, "eventVariableIndex":argC, "eventVariableValue":argD});
          }
        }
      }
    }
    return testCases;
  }


  itParam("EVENT_TEACH_BY_IDENTIFIER test ${JSON.stringify(value)}", GetTestCase_teach_event(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN EVENT_TEACH_BY_IDENTIFIER test '});
    mock_jsonServer.messagesIn = []
    node.nodeConfig.nodes = {}          // start with clean slate
    var data = {"nodeNumber": value.nodeNumber,
      "eventIdentifier": value.eventIdentifier,
      "eventVariableIndex": value.eventVariableIndex,
      "eventVariableValue": value.eventVariableValue
    }
    node.updateEventInNodeConfig(value.nodeNumber, value.eventIdentifier, 1)
    socket.emit('EVENT_TEACH_BY_IDENTIFIER', data)

    setTimeout(function(){
      for (let i = 0; i < mock_jsonServer.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_jsonServer.messagesIn[i])});
      }
      expect(mock_jsonServer.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_jsonServer.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn[3].mnemonic).to.equal("REVAL")
      winston.info({message: 'unit_test: END EVENT_TEACH_BY_IDENTIFIER test'});
			done();
		}, 300);
  })




})


