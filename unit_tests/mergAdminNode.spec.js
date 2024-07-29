const expect = require('chai').expect;
const itParam = require('mocha-param');
const winston = require('./config/winston_test.js')
const cbusLib = require('cbuslibrary')
const admin = require('./../VLCB-server/mergAdminNode.js')


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const config = require('../VLCB-server/configuration.js')('./unit_tests/test_output/config')

// set config items
config.setServerAddress("localhost")
config.setCbusServerPort(5550);
config.setJsonServerPort(5551);
config.setSocketServerPort(5552);
config.setCurrentLayoutFolder('default')


const LAYOUT_PATH="./unit_tests/test_output/layouts/default/"

const mock_jsonServer = new (require('./mock_jsonServer'))(config.getJsonServerPort())
const node = new admin.cbusAdmin(config)


function decToHex(num, len) {return parseInt(num & (2 ** (4*len) - 1)).toString(16).toUpperCase().padStart(len, '0');}

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


var nodeTraffic = []
node.on('cbusTraffic', function (data) {
  nodeTraffic.push(data)
  winston.debug({message: `mergAdminNode test: cbusTraffic:  ${JSON.stringify(data)}`})
})



describe('mergAdminNode tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '----------------------------- mergAdminNode tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
        
		done();
	});

	beforeEach(function() {
   		winston.info({message: ' '});   // blank line to separate tests
      mock_jsonServer.messagesIn = []
  });

	after(function() {
   		winston.info({message: ' '});   // blank line to separate tests
	});																										

  //****************************************************************************************** */
  //
  // Actual tests after here...
  //
  //****************************************************************************************** */  

  //****************************************************************************************** */
  // outgoing messages
  //****************************************************************************************** */

  // 0x0D QNN
  //
  it("QNN test ", async function () {
    winston.info({message: 'unit_test: BEGIN QNN test '});
    var result = node.QNN()
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('QNN');
    winston.info({message: 'unit_test: END QNN test'});
  })


  // 0x10 RQNP
  //
  it("RQNP test ", async function () {
    winston.info({message: 'unit_test: BEGIN RQNP test '});
    var result = node.RQNP()
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('RQNP');
    winston.info({message: 'unit_test: END RQNP test'});
  })


  function GetTestCase_session() {
    var arg1, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 255}
      testCases.push({'session':arg1});
    }
    return testCases;
  }

  // 0x22 QLOC
  //
  itParam("QLOC test ${JSON.stringify(value)}", GetTestCase_session(), async function (value) {
    winston.info({message: 'unit_test: BEGIN QLOC test ' + JSON.stringify(value)});
    var result = node.QLOC(value.session)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('QLOC');
    expect(result.session).to.equal(value.session);
    winston.info({message: 'unit_test: END QLOC test'});
  })


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

  // 0x42 SNN
  //
  itParam("SNN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN SNN test '});
    var result = node.SNN(value.nodeNumber)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('SNN');
    expect(result.nodeNumber).to.equal(value.nodeNumber)
    winston.info({message: 'unit_test: END SNN test'});
  })


  // 0x53 NNLRN
  //
  itParam("NNLRN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN NNLRN test '});
    var result = node.NNLRN(value.nodeNumber)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('NNLRN');
    expect(result.nodeNumber).to.equal(value.nodeNumber)
    winston.info({message: 'unit_test: END NNLRN test'});
  })


  // 0x54 NNULN
  //
  itParam("NNULN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN NNULN test '});
    var result = node.NNULN(value.nodeNumber)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('NNULN');
    expect(result.nodeNumber).to.equal(value.nodeNumber)
    winston.info({message: 'unit_test: END NNULN test'});
  })


  // 0x57 NERD
  //
  itParam("NERD test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN NERD test '});
    var result = node.NERD(value.nodeNumber)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('NERD');
    expect(result.nodeNumber).to.equal(value.nodeNumber)
    winston.info({message: 'unit_test: END NERD test'});
  })


  // 0x58 RQEVN
  //
  itParam("RQEVN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN RQEVN test '});
    var result = node.RQEVN(value.nodeNumber)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('RQEVN');
    expect(result.nodeNumber).to.equal(value.nodeNumber)
    winston.info({message: 'unit_test: END RQEVN test'});
  })


  function GetTestCase_NENRD() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 255}
        testCases.push({'nodeNumber':arg1, 'eventIndex': arg2});
      }
    }
    return testCases;
  }

  // 0x72 NENRD
  //
  itParam("NENRD test ${JSON.stringify(value)}", GetTestCase_NENRD(), async function (value) {
    winston.info({message: 'unit_test: BEGIN NENRD test '});
    var result = node.NENRD(value.nodeNumber, value.eventIndex)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('NENRD');
    expect(result.nodeNumber).to.equal(value.nodeNumber);
    expect(result.parameterIndex).to.equal(value.parameterIndex);
    winston.info({message: 'unit_test: END NENRD test'});
  })


  function GetTestCase_RQNPN() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 255}
        testCases.push({'nodeNumber':arg1, 'parameterIndex': arg2});
      }
    }
    return testCases;
  }

  // 0x73 RQNPN
  //
  itParam("RQNPN test ${JSON.stringify(value)}", GetTestCase_RQNPN(), async function (value) {
    winston.info({message: 'unit_test: BEGIN RQNPN test '});
    var result = node.RQNPN(value.nodeNumber, value.parameterIndex)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('RQNPN');
    expect(result.nodeNumber).to.equal(value.nodeNumber);
    expect(result.parameterIndex).to.equal(value.parameterIndex);
    winston.info({message: 'unit_test: END RQNPN test'});
  })


  function GetTestCase_RQSD() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 255}
        testCases.push({'nodeNumber':arg1, 'serviceIndex': arg2});
      }
    }
    return testCases;
  }

  
  // 0x78 RQSD
  //
  itParam("RQSD test ${JSON.stringify(value)}", GetTestCase_RQSD(), async function (value) {
    winston.info({message: 'unit_test: BEGIN RQSD test '});
    var result = node.RQSD(value.nodeNumber, value.serviceIndex)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('RQSD');
    expect(result.nodeNumber).to.equal(value.nodeNumber);
    expect(result.ServiceIndex).to.equal(value.serviceIndex);
    winston.info({message: 'unit_test: END RQSD test'});
  })


  //****************************************************************************************** */
  // incoming messages
  //****************************************************************************************** */


  // 0x23 DKEEP
  //
  itParam("DKEEP test ${JSON.stringify(value)}", GetTestCase_session(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN DKEEP test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeDKEEP(value.session)
    mock_jsonServer.messagesIn = []
    mock_jsonServer.inject(testMessage)
    setTimeout(function(){
      var result = mock_jsonServer.messagesIn[0]
      winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
      expect(result.mnemonic).to.equal("QLOC")
      expect(result.session).to.equal(value.session)
      winston.info({message: 'unit_test: END DKEEP test'});
			done();
		}, 30);
  })


  // 0x50 RQNN
  //
  itParam("RQNN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN RQNN test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeRQNN(value.nodeNumber)
    mock_jsonServer.messagesIn = []
    nodeTraffic = []
    var receivedNodeNumber = undefined
    node.once('requestNodeNumber', function (nodeNumber) {
      receivedNodeNumber = nodeNumber
      winston.debug({message: 'unit_test: node.once - requestNodeNumber ' + nodeNumber});
    })
    mock_jsonServer.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("RQNN")
      expect(receivedNodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END RQNN test'});
			done();
		}, 100);
  })


  // 0x59 WRACK
  //
  itParam("WRACK test ${JSON.stringify(value)}", GetTestCase_session(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN WRACK test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeWRACK(1)
    mock_jsonServer.messagesIn = []
    nodeTraffic = []
    mock_jsonServer.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("WRACK")
      winston.info({message: 'unit_test: END WRACK test'});
			done();
		}, 50);
  })


  function GetTestCase_GRSP() {
    var argA, argB, argC, argD, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = "00"}
        if (b == 2) {argB = "01"}
        if (b == 3) {argB = "FF"}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          for (var d = 1; d<= 3; d++) {
            if (d == 1) {argD = 0}
            if (d == 2) {argD = 1}
            if (d == 3) {argD = 255}
              testCases.push({'nodeNumber':argA, 'opCode': argB, "serviceIndex":argC, "result":argD});
          }
        }
      }
    }
    return testCases;
  }

  // 0xAF GRSP
  //
  itParam("GRSP test ${JSON.stringify(value)}", GetTestCase_GRSP(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN GRSP test '});
    var testMessage = cbusLib.encodeGRSP(value.nodeNumber, value.opCode, value.serviceIndex, value.result)
    mock_jsonServer.messagesIn = []
    nodeTraffic = []
    mock_jsonServer.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("GRSP")
      winston.info({message: 'unit_test: END GRSP test'});
			done();
		}, 30);
  })

  //****************************************************************************************** */
  // functions called by socket server
  //****************************************************************************************** */

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

/*
function GetTestCase_teach_event() {
  var argA = 1, argB = "00000002", argC = 3, argD = 4, testCases = [];
  testCases.push({'nodeNumber':argA, 'eventIdentifier': argB, "eventVariableIndex":argC, "eventVariableValue":argD});
  return testCases;
}
*/

  itParam("teach_event test ${JSON.stringify(value)}", GetTestCase_teach_event(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN teach_event test '});
    mock_jsonServer.messagesIn = []
    node.teach_event(value.nodeNumber, value.eventIdentifier, value.eventVariableIndex, value.eventVariableValue )
    setTimeout(function(){
      for (let i = 0; i < mock_jsonServer.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_jsonServer.messagesIn[i])});
      }
      expect(mock_jsonServer.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_jsonServer.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn[3].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn[4].mnemonic).to.equal("RQEVN")
      expect(mock_jsonServer.messagesIn[5].mnemonic).to.equal("NERD")
      winston.info({message: 'unit_test: END teach_event test'});
			done();
		}, 250);
  })

  itParam("update_event_variable test ${JSON.stringify(value)}", GetTestCase_teach_event(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN update_event_variable test '});
    mock_jsonServer.messagesIn = []
    var data = {"nodeNumber": value.nodeNumber,
      "eventName": value.eventIdentifier,
      "eventIndex": 1,
      "eventVariableId": value.eventVariableIndex,
      "eventVariableValue": value.eventVariableValue
    }
    node.update_event_variable(data) 
    setTimeout(function(){
      for (let i = 0; i < mock_jsonServer.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_jsonServer.messagesIn[i])});
      }
      expect(mock_jsonServer.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_jsonServer.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn[3].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[4].mnemonic).to.equal("REQEV")
      winston.info({message: 'unit_test: END update_event_variable test'});
			done();
		}, 400);
  })

  itParam("event_teach_by_identifier test ${JSON.stringify(value)}", GetTestCase_teach_event(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN event_teach_by_identifier test '});
    mock_jsonServer.messagesIn = []
    // ensure event doesn't exist, so should always refresh all events
    node.nodeConfig.nodes[value.nodeNumber] = {storedEvents:{0:{}}}
    node.event_teach_by_identifier(value.nodeNumber, value.eventIdentifier, value.eventVariableIndex, value.eventVariableValue )
    setTimeout(function(){
      for (let i = 0; i < mock_jsonServer.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_jsonServer.messagesIn[i])});
      }
      expect(mock_jsonServer.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_jsonServer.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn[3].mnemonic).to.equal("RQEVN")
      expect(mock_jsonServer.messagesIn[4].mnemonic).to.equal("NERD")
      expect(mock_jsonServer.messagesIn[5].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[6].mnemonic).to.equal("REQEV")
      expect(mock_jsonServer.messagesIn[7].mnemonic).to.equal("NNULN")
      winston.info({message: 'unit_test: END event_teach_by_identifier test'});
			done();
		}, 400);
  })

  function GetTestCase_teach_event2() {
    var argA, argB, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0, argB = 0}
      if (a == 2) {argA = 1, argB = 2}
      if (a == 3) {argA = 2, argB = 3}
      testCases.push({'test':argA, 'numberOfVariables': argB});
    }
    return testCases;
  }
  //
  // Test that if the event already exists, then the read all events isn't executed
  //
  itParam("event_teach_by_identifier2 test ${JSON.stringify(value)}", GetTestCase_teach_event2(), function (done, value) {
//    it("event_teach_by_identity2 test", function (done) {
    winston.info({message: 'unit_test: BEGIN event_teach_by_identifier2 test '});
    mock_jsonServer.messagesIn = []
    // create event so that it already exists
    node.nodeConfig.nodes[1] = {storedEvents:{0:{}}}
    node.nodeConfig.nodes[1].storedEvents[1] = {eventIdentifier: "00000002"}
    if(value.test == 1){
      // lets set the node parameter for number of event variables
      node.nodeConfig.nodes[1]["parameters"]={}
      node.nodeConfig.nodes[1].parameters[5] = value.numberOfVariables
    }
    if(value.test == 2){
      // lets set EV0 with the number of event variables      
      node.nodeConfig.nodes[1].storedEvents[1]["variables"] = {}
      node.nodeConfig.nodes[1].storedEvents[1].variables[0] = value.numberOfVariables
    }
    node.event_teach_by_identifier(1, "00000002", 1, 1 )
    setTimeout(function(){
      for (let i = 0; i < mock_jsonServer.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_jsonServer.messagesIn[i])});
      }
      expect(mock_jsonServer.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_jsonServer.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn[3].mnemonic).to.equal("NNLRN")
      expect(mock_jsonServer.messagesIn[4].mnemonic).to.equal("REQEV")
      expect(mock_jsonServer.messagesIn[5 + value.numberOfVariables].mnemonic).to.equal("NNULN")
      expect(mock_jsonServer.messagesIn.length).to.equal(6 + value.numberOfVariables)    // check events read wasn't triggered
      winston.info({message: 'unit_test: END event_teach_by_identifier2 test'});
			done();
		}, 400);
  })


})


