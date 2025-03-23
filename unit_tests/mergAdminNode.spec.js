const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: mergAdminNode.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');

const cbusLib = require('cbuslibrary')
const utils = require('./../VLCB-server/utilities.js');

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const testSystemConfigPath = "./unit_tests/test_output/config"
const testUserConfigPath = "./unit_tests/test_output/test_user"
const config = require('../VLCB-server/configuration.js')(testSystemConfigPath)
// override direectories set in configuration constructor
config.singleUserDirectory = testUserConfigPath
config.currentUserDirectory = config.singleUserDirectory

// set config items
config.setCurrentLayoutFolder() // use default layout


const LAYOUT_PATH="./unit_tests/test_output/layouts/default/"

const mock_messageRouter = require('./mock_messageRouter')(config)
const node = require('./../VLCB-server/mergAdminNode.js')(config)

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
node.on('nodeTraffic', function (data) {
  nodeTraffic.push(data)
  winston.debug({message: `mergAdminNode test: nodeTraffic:  ${JSON.stringify(data)}`})
})



describe('mergAdminNode tests', function(){


	before(async function() {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '----------------------------- mergAdminNode tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
    await utils.sleep(100)    

    node.inUnitTest = true

	});

	beforeEach(function() {
   		winston.info({message: ' '});   // blank line to separate tests
      mock_messageRouter.messagesIn = []
  });

	after(function(done) {
 		winston.info({message: ' '});   // blank line to separate tests
    // bit of timing to ensure all winston messages get sent before closing tests completely
    setTimeout(function(){
      done();
    }, 100);
	});																										


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


  function GetTestCase_nodeNumberAndOneByte() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 255}
        testCases.push({'nodeNumber':arg1, 'param1': arg2});
      }
    }
    return testCases;
  }

  
  function GetTestCase_eventIdentifier() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {arg2 = '00000001'}
        if (b == 2) {arg2 = '00010002'}
        if (b == 3) {arg2 = 'FFFFFFFF'}
        testCases.push({'nodeNumber':arg1, 'eventIdentifier': arg2});
      }
    }
    return testCases;
  }

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
  it("query_all_nodes test ", function (done) {
    winston.info({message: 'unit_test: BEGIN query_all_nodes test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.query_all_nodes()
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('QNN')
      winston.info({message: 'unit_test: END query_all_nodes test'});
      done();
    }, 10);
  })

  // 0x11 RQMN
  // see RQNN

  // 0x42 sendSNN
  //
  itParam("sendSNN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN sendSNN test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendSNN(value.nodeNumber)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('SNN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END sendSNN test'});
      done();
    }, 10);
  })

  // 0x5D sendENUM
  //
  itParam("sendENUM test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN sendENUM test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendENUM(value.nodeNumber)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('ENUM')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END sendENUM test'});
      done();
    }, 10);
  })

  // 0x5E sendNNRST
  //
  itParam("sendNNRST test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN sendNNRST test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendNNRST(value.nodeNumber)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NNRST')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END sendNNRST test'});
      done();
    }, 10);
  })

  // 0x73 sendRQNPN
  //
  it("sendRQNPN test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendRQNPN test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendRQNPN(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].parameterIndex).to.equal(2)
      winston.info({message: 'unit_test: END sendRQNPN test'});
      done();
    }, 10);
  })

  // 0x75 sendCANID
  //
  it("sendCANID test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendCANID test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendCANID(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('CANID')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].CAN_ID).to.equal(2)
      winston.info({message: 'unit_test: END sendCANID test'});
      done();
    }, 10);
  })

  // 0x75 sendRQSD
  //
  it("sendRQSD test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendRQSD test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendRQSD(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('RQSD')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].ServiceIndex).to.equal(2)
      winston.info({message: 'unit_test: END sendRQSD test'});
      done();
    }, 10);
  })

  // 0x87 sendRDGN
  //
  it("sendRDGN test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendRDGN test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendRDGN(1, 2, 3)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('RDGN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].ServiceIndex).to.equal(2)
      expect(mock_messageRouter.messagesIn[0].DiagnosticCode).to.equal(3)
      winston.info({message: 'unit_test: END sendRDGN test'});
      done();
    }, 10);
  })

  // 0x90 sendACON
  //
  it("sendACON test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendACON test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendACON(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('ACON')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].eventNumber).to.equal(2)
      winston.info({message: 'unit_test: END sendACON test'});
      done();
    }, 10);
  })

  // 0x91 sendACOF
  //
  it("sendACOF test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendACOF test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendACOF(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('ACOF')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].eventNumber).to.equal(2)
      winston.info({message: 'unit_test: END sendACOF test'});
      done();
    }, 10);
  })

  // 0x96 sendNVSET
  //
  it("sendNVSET test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendNVSET test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendNVSET(1, 2, 3)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NVSET')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].nodeVariableIndex).to.equal(2)
      expect(mock_messageRouter.messagesIn[0].nodeVariableValue).to.equal(3)
      winston.info({message: 'unit_test: END sendNVSET test'});
      done();
    }, 10);
  })

  // 0x98 sendASON
  //
  it("sendASON test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendASON test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendASON(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('ASON')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].deviceNumber).to.equal(2)
      winston.info({message: 'unit_test: END sendASON test'});
      done();
    }, 10);
  })

  // 0x99 sendASOF
  //
  it("sendASOF test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendASOF test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendASOF(1, 2)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('ASOF')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].deviceNumber).to.equal(2)
      winston.info({message: 'unit_test: END sendASOF test'});
      done();
    }, 10);
  })

  // 0x9C sendREVAL
  //
  it("sendREVAL test", function (done) {
    winston.info({message: 'unit_test: BEGIN sendREVAL test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    var result = node.sendREVAL(1, 2, 3)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('REVAL')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[0].eventIndex).to.equal(2)
      expect(mock_messageRouter.messagesIn[0].eventVariableIndex).to.equal(3)
      winston.info({message: 'unit_test: END sendREVAL test'});
      done();
    }, 10);
  })

  //****************************************************************************************** */
  //****************************************************************************************** */
  // incoming messages
  //****************************************************************************************** */
  //****************************************************************************************** */

/*
  // 0x23 DKEEP
  //
  itParam("DKEEP test ${JSON.stringify(value)}", GetTestCase_session(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN DKEEP test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeDKEEP(value.session)
    mock_messageRouter.messagesIn = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      var result = mock_messageRouter.messagesIn[0]
      winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
      expect(result.mnemonic).to.equal("QLOC")
      expect(result.session).to.equal(value.session)
      winston.info({message: 'unit_test: END DKEEP test'});
			done();
		}, 50);
  })
*/

  // 0x50 RQNN
  //
  itParam("RQNN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN RQNN test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeRQNN(value.nodeNumber)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      for (let i = 0; i < nodeTraffic.length; i++) {
        winston.info({message: 'unit_test: nodeTraffic: ' + JSON.stringify(nodeTraffic[i])});
      }
      expect(nodeTraffic[0].json.mnemonic).to.equal("RQNN")
      let found_RQMN = false
      for (let index in nodeTraffic) {
        if (nodeTraffic[index].json.mnemonic == "RQMN"){ found_RQMN = true }
      }
      expect(found_RQMN).to.equal(true)
      expect(node.rqnnPreviousNodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END RQNN test'});
			done();
		}, 300);
  })


  // 0x59 WRACK
  //
  itParam("WRACK test ${JSON.stringify(value)}", GetTestCase_session(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN WRACK test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeWRACK(1)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("WRACK")
      winston.info({message: 'unit_test: END WRACK test'});
			done();
		}, 50);
  })


  // 0x74 NUMEV
  // should be received ok
  // and then should trigger a NERD to be sent, as no event count set for target nodeNumber
  //
  itParam("NUMEV test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN NUMEV test ' + JSON.stringify(value)});
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    var testMessage = cbusLib.encodeNUMEV(value.nodeNumber, 1)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("NUMEV")
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("NNEVN")
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal("NERD")
      winston.info({message: 'unit_test: END NUMEV test'});
			done();
		}, 200);
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
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("GRSP")
      winston.info({message: 'unit_test: END GRSP test'});
			done();
		}, 30);
  })

  // 0xAC SD
  //
  it("SD test", function (done) {
    winston.info({message: 'unit_test: BEGIN SD test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    // nodeNumber, serviceIndex, serviceType, serviceVersion
    var testMessage = cbusLib.encodeSD(1, 2, 3, 4)
    mock_messageRouter.inject(testMessage)

    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[3])}`});
      expect(nodeTraffic[0].json.mnemonic).to.equal("SD")
      let found = false
      mock_messageRouter.messagesIn.forEach(msg => {
        if (msg.mnemonic == 'RQSD') { 
          found = true
          expect(msg.nodeNumber).to.equal(1)
          expect(msg.ServiceIndex).to.equal(2)
        }
      })
      expect(found).to.equal(true)
/*
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[3].mnemonic).to.equal('RQSD')
      expect(mock_messageRouter.messagesIn[3].nodeNumber).to.equal(1)
      expect(mock_messageRouter.messagesIn[3].ServiceIndex).to.equal(2)
*/      
      winston.info({message: 'unit_test: END SD test'});
      done();
    }, 300);
  })


  // 0xB5 NEVAL
  //
  itParam("NEVAL test ${JSON.stringify(value)}", GetTestCase_event_by_index(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN NEVAL test ' + JSON.stringify(value)});
    // ensure event does exist with correct eventIndex
    var eventIdentifier = "00000001"
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    node.nodeConfig.nodes[value.nodeNumber].storedEventsNI = {}
    node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[eventIdentifier] ={"eventIndex":value.eventIndex, "eventIdentifier":eventIdentifier}

    var testMessage = cbusLib.encodeNEVAL(value.nodeNumber, value.eventIndex, value.eventVariableIndex, value.eventVariableValue)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("NEVAL")
      winston.info({message: 'unit_test: nodeConfig ' + JSON.stringify(node.nodeConfig.nodes[value.nodeNumber])});
      expect(node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[eventIdentifier].eventIndex).to.equal(value.eventIndex)
      expect(node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[eventIdentifier].variables[value.eventVariableIndex]).to.equal(value.eventVariableValue)
      winston.info({message: 'unit_test: END NEVAL test'});
			done();
		}, 30);
  })


  // 0xB6 PNN
  // PNN should be received ok
  // then should trigger a RQEVN command for that node
  //
  itParam("PNN test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN PNN test '});
    var testMessage = cbusLib.encodePNN(value.nodeNumber, 2, 3, 4)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("PNN")
      winston.info({message: 'unit_test: output ' + JSON.stringify(mock_messageRouter.messagesIn)});
      if (value.nodeNumber > 0){
        expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("RQEVN")
        expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      } else {
        // node 0 should be ignored
        expect(mock_messageRouter.messagesIn.length).to.equal(0)
      }
      winston.info({message: 'unit_test: END PNN test'});
			done();
		}, 100);
  })


  function GetTestCase_DGN() {
    var argA, argB, argC, argD, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 2; b++) {
        if (b == 1) {argB = 1}      // service index starts at 1
        if (b == 2) {argB = 255}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          for (var d = 1; d<= 3; d++) {
            if (d == 1) {argD = 0}
            if (d == 2) {argD = 1}
            if (d == 3) {argD = 255}
              testCases.push({'nodeNumber':argA, 'ServiceIndex': argB, "DiagnosticCode":argC, "DiagnosticValue":argD});
          }
        }
      }
    }
    return testCases;
  }

  // 0xC7 DGN
  //
  itParam("DGN test ${JSON.stringify(value)}", GetTestCase_DGN(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN DGN test ' + JSON.stringify(value)});
    //     encodeDGN(nodeNumber, ServiceIndex, DiagnosticCode, DiagnosticValue) {
    var testMessage = cbusLib.encodeDGN(value.nodeNumber, value.ServiceIndex, value.DiagnosticCode, value.DiagnosticValue)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    // create entry for service index
    node.nodeConfig.nodes[value.nodeNumber].services[value.ServiceIndex] = {
      "ServiceIndex": value.ServiceIndex,
      "diagnostics": {}
    }
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.debug({message: 'unit_test: nodeConfig ' + JSON.stringify(node.nodeConfig.nodes[value.nodeNumber].services[value.ServiceIndex])});      
      expect(nodeTraffic[0].json.mnemonic).to.equal("DGN")
      expect(node.nodeConfig.nodes[value.nodeNumber].services[value.ServiceIndex].diagnostics[value.DiagnosticCode].DiagnosticValue).to.equal(value.DiagnosticValue)
      winston.info({message: 'unit_test: END DGN test'});
			done();
		}, 30);
  })


  function GetTestCase_event_by_identifier() {
    var argA, argB, argC, argD, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = 0}
        if (b == 2) {argB = 1}
        if (b == 3) {argB = 65535}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          for (var d = 1; d<= 3; d++) {
            if (d == 1) {argD = 0}
            if (d == 2) {argD = 1}
            if (d == 3) {argD = 255}
              testCases.push({'nodeNumber':argA, 'eventNumber': argB, "eventVariableIndex":argC, "eventVariableValue":argD});
          }
        }
      }
    }
    return testCases;
  }


  // 0xD3 EVANS
  // syntax:  encodeEVANS(nodeNumber, eventNumber, eventVariableIndex, eventVariableValue) 
  //
  itParam("EVANS test ${JSON.stringify(value)}", GetTestCase_event_by_identifier(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN EVANS test ' + JSON.stringify(value)});
    var nodeUnderTest = 1
    node.createNodeConfig(nodeUnderTest)    // create node config for node we're testing
    node.nodeConfig.nodes[nodeUnderTest].storedEventsNI = {}

    node.nodeNumberInLearnMode = nodeUnderTest    // tell MMC that nodeUnderTest is in learn mode

    var testMessage = cbusLib.encodeEVANS(value.nodeNumber, value.eventNumber, value.eventVariableIndex, value.eventVariableValue)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    mock_messageRouter.inject(testMessage)
    const eventIdentifier = utils.decToHex(value.nodeNumber, 4) + utils.decToHex(value.eventNumber, 4)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      expect(nodeTraffic[0].json.mnemonic).to.equal("EVANS")
      winston.info({message: 'unit_test: nodeConfig ' + JSON.stringify(node.nodeConfig.nodes[nodeUnderTest])});
      expect(node.nodeConfig.nodes[nodeUnderTest].storedEventsNI[eventIdentifier].eventIndex).to.equal(value.eventIndex)
      expect(node.nodeConfig.nodes[nodeUnderTest].storedEventsNI[eventIdentifier].variables[value.eventVariableIndex]).to.equal(value.eventVariableValue)
      winston.info({message: 'unit_test: END EVANS test'});
			done();
		}, 30);
  })


  // 0xE2 NAME
  //
  itParam("NAME test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN NAME test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeNAME("ABCDEFG")
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    node.rqnnPreviousNodeNumber = value.nodeNumber
    var receivedNodeNumber = undefined
    var receivedNAME = undefined
    node.once('requestNodeNumber', function (nodeNumber, name) {
      receivedNodeNumber = nodeNumber
      receivedNAME = name
      winston.debug({message: 'unit_test: node.once - requestNodeNumber ' + nodeNumber});
    })
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      winston.info({message: 'unit_test: result ' + JSON.stringify(nodeTraffic[0])});
      for (let i = 0; i < nodeTraffic.length; i++) {
        winston.info({message: 'unit_test: ' + JSON.stringify(nodeTraffic[i])});
      }
      expect(nodeTraffic[0].json.mnemonic).to.equal("NAME")
      expect(receivedNodeNumber).to.equal(value.nodeNumber)
      expect(receivedNAME).to.equal("ABCDEFG")
      winston.info({message: 'unit_test: END NAME test'});
			done();
		}, 300);
  })

  // GetTestCase_eventIdentifier

  // 0xF2 ENRSP
  //
  itParam("ENRSP test ${JSON.stringify(value)}", GetTestCase_eventIdentifier(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN ENRSP test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeENRSP(value.nodeNumber, value.eventIdentifier, 1)
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    node.nodeConfig.nodes[value.nodeNumber]['ENRSP_request_variables'] = true
    mock_messageRouter.inject(testMessage)
    setTimeout(function(){
      expect(nodeTraffic[0].json.mnemonic).to.equal("ENRSP")
      winston.info({message: 'unit_test: END ENRSP test'});
			done();
		}, 300);
  })

  //****************************************************************************************** */
  //****************************************************************************************** */
  // Internal functions
  //****************************************************************************************** */
  //****************************************************************************************** */
  
  // clear_FCU_compatibility test
  //
  it("set_FCU_compatibility test", function (done) {
    winston.info({message: 'unit_test: BEGIN set_FCU_compatibility test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    node.set_FCU_compatibility(true)
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('MODE')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(0)
      expect(mock_messageRouter.messagesIn[0].ModeNumber).to.equal(0x10)
      winston.info({message: 'unit_test: END set_FCU_compatibility test'});
      done();
    }, 50);
  })

  // delete_all_events test
  //
  itParam("delete_all_events test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN delete_all_events test '});
    mock_messageRouter.messagesIn = []
    await node.delete_all_events(value.nodeNumber)
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal("NNCLR")
      expect(mock_messageRouter.messagesIn[1].nodeNumber).to.equal(value.nodeNumber)
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_messageRouter.messagesIn[2].nodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END delete_all_events test'});
			done();
		}, 50);
  })

  // event_unlearn test
  //
  it("event_unlearn test", function (done) {
    winston.info({message: 'unit_test: BEGIN event_unlearn test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    let nodeNumber = 1
    let eventIdentifier = '00000001'
    node.event_unlearn(nodeNumber, eventIdentifier)
    setTimeout(function(){
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NNLRN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal('EVULN')
      expect(mock_messageRouter.messagesIn[1].eventIdentifier).to.equal(eventIdentifier)
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal('NNULN')
      expect(mock_messageRouter.messagesIn[2].nodeNumber).to.equal(nodeNumber)
      winston.info({message: 'unit_test: END event_unlearn test'});
      done();
    }, 50);
  })

  // Read_EV_in_learn_mode test
  //
  it("Read_EV_in_learn_mode test", function (done) {
    winston.info({message: 'unit_test: BEGIN Read_EV_in_learn_mode test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    let nodeNumber = 1
    let eventIdentifier = '00000002'
    let eventVariableIndex = 3
    node.Read_EV_in_learn_mode(nodeNumber, eventIdentifier, eventVariableIndex)
    setTimeout(function(){
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NNLRN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal('REQEV')
      expect(mock_messageRouter.messagesIn[1].eventIdentifier).to.equal(eventIdentifier)
      expect(mock_messageRouter.messagesIn[1].eventVariableIndex).to.equal(eventVariableIndex)
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal('NNULN')
      expect(mock_messageRouter.messagesIn[2].nodeNumber).to.equal(nodeNumber)
      winston.info({message: 'unit_test: END Read_EV_in_learn_mode test'});
      done();
    }, 50);
  })

  //
  // Test to check requesting EV's by index
  // initial REVAL should return number of subsequent EV's which should then be requested
  // so check the number of REVAL's is correct - should be 3 in total
  // response to REVAL - NEVAL is tested elsewhere
  //
  itParam("requestAllEventVariablesByIndex test ${JSON.stringify(value)}", GetTestCase_event_variables_by_index(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN requestAllEventVariablesByIndex test ' + JSON.stringify(value)});
    // ensure event does exist with correct eventIndex
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    node.nodeConfig.nodes[value.nodeNumber].storedEventsNI = {}
    node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[value.eventIdentifier] ={"eventIndex":value.eventIndex, "eventIdentifier":value.eventidentifier}
    winston.info({message: 'unit_test: storedEventsNI ' + JSON.stringify(node.nodeConfig.nodes[value.nodeNumber].storedEventsNI)});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    node.requestAllEventVariablesByIndex(value.nodeNumber, value.eventIdentifier)
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('REVAL')
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal('REVAL')
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal('REVAL')
      winston.info({message: 'unit_test: END requestAllEventVariablesByIndex test '});
      done();
    }, 200);
  })

  // request_all_node_variables
  //
  it("request_all_node_variables test ", function (done) {
    winston.info({message: 'unit_test: BEGIN request_all_node_variables test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    let nodeNumber = 1
    node.createNodeConfig(1)    // create node config for node we're testing
    node.nodeConfig.nodes[nodeNumber].parameters[6] = 2
    var result = node.request_all_node_variables(nodeNumber)
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn.length).to.equal(2)
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NVRD')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[0].nodeVariableIndex).to.equal(1)
      expect(mock_messageRouter.messagesIn.length).to.equal(2)
      winston.info({message: 'unit_test: END request_all_node_variables test'});
      done();
    }, 300);
  })


  // request_all_node_variables_vlcb
  //
  it("request_all_node_variables_vlcb test ", function (done) {
    winston.info({message: 'unit_test: BEGIN request_all_node_variables_vlcb test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    let nodeNumber = 1
    node.createNodeConfig(1)    // create node config for node we're testing
    node.nodeConfig.nodes[nodeNumber].parameters[6] = 2
    node.nodeConfig.nodes[nodeNumber].VLCB = true
    var result = node.request_all_node_variables(nodeNumber)
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn.length).to.equal(3)
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NVRD')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[0].nodeVariableIndex).to.equal(0)
      winston.info({message: 'unit_test: END request_all_node_variables_vlcb test'});
      done();
    }, 100);
  })





  function GetTestCase_event_by_index() {
    var argA, argB, argC, argD, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = 0}
        if (b == 2) {argB = 1}
        if (b == 3) {argB = 255}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          for (var d = 1; d<= 3; d++) {
            if (d == 1) {argD = 0}
            if (d == 2) {argD = 1}
            if (d == 3) {argD = 255}
              testCases.push({'nodeNumber':argA, 'eventIndex': argB, "eventVariableIndex":argC, "eventVariableValue":argD});
          }
        }
      }
    }
    return testCases;
  }


  // Function used when NEVAL is returned
  // NEVAL uses eventIndex, not eventIdentifier
  // So event must already exist in storedEventsNI, so it can find it
  //
  itParam("storeEventVariableByIndex test ${JSON.stringify(value)}", GetTestCase_event_by_index(), async function (value) {
    winston.info({message: 'unit_test: BEGIN storeEventVariableByIndex test ' + JSON.stringify(value)});
    // ensure event does exist with correct eventIndex
    var eventidentifier = "00000001"
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    node.nodeConfig.nodes[value.nodeNumber].storedEventsNI = {}
    node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[eventidentifier] ={"eventIndex":value.eventIndex, "eventIdentifier":eventidentifier}
  
    node.storeEventVariableByIndex(value.nodeNumber, value.eventIndex, value.eventVariableIndex, value.eventVariableValue)
    winston.info({message: 'unit_test: nodeConfig ' + JSON.stringify(node.nodeConfig.nodes[value.nodeNumber])});
    expect(node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[eventidentifier].eventIndex).to.equal(value.eventIndex)
    expect(node.nodeConfig.nodes[value.nodeNumber].storedEventsNI[eventidentifier].variables[value.eventVariableIndex]).to.equal(value.eventVariableValue)
    winston.info({message: 'unit_test: END storeEventVariableByIndex test '});
  })


  function GetTestCase_event_variables_by_index() {
    var argA, argB, argC, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = '00000000'}
        if (b == 2) {argB = '00000001'}
        if (b == 3) {argB = 'FFFFFFFF'}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          testCases.push({'nodeNumber':argA, 'eventIdentifier': argB, "eventIndex":argC});
        }
      }
    }
    return testCases;
  }

  // updateNodeStatus
  // use node number that doesn't exist
  //
  it("updateNodeStatus test", function (done) {
    winston.info({message: 'unit_test: BEGIN updateNodeStatus test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    let nodeNumber = 3
    node.updateNodeStatus(nodeNumber)
    setTimeout(function(){
      winston.info({message: `unit_test: result ${JSON.stringify(mock_messageRouter.messagesIn[0])}`});
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[0].parameterIndex).to.equal(8)
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[1].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[1].parameterIndex).to.equal(1)
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal('RQNPN')
      expect(mock_messageRouter.messagesIn[2].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[2].parameterIndex).to.equal(3)
      winston.info({message: 'unit_test: END updateNodeStatus test'});
      done();
    }, 300);
  })


  // update_node_variable_in_learnMode test
  //
  it("update_node_variable_in_learnMode test", function (done) {
    winston.info({message: 'unit_test: BEGIN update_node_variable_in_learnMode test '});
    mock_messageRouter.messagesIn = []
    nodeTraffic = []
    let nodeNumber = 1
    let nodeVariableIndex = 2
    let nodeVariableValue = 3
    node.update_node_variable_in_learnMode(nodeNumber, nodeVariableIndex, nodeVariableValue)
    setTimeout(function(){
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal('NNLRN')
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal('NVSET')
      expect(mock_messageRouter.messagesIn[1].nodeVariableIndex).to.equal(nodeVariableIndex)
      expect(mock_messageRouter.messagesIn[1].nodeVariableValue).to.equal(nodeVariableValue)
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal('NNULN')
      expect(mock_messageRouter.messagesIn[2].nodeNumber).to.equal(nodeNumber)
      winston.info({message: 'unit_test: END update_node_variable_in_learnMode test'});
      done();
    }, 50);
  })



  //****************************************************************************************** */
  //****************************************************************************************** */
  // functions called by socket server
  //****************************************************************************************** */
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

  function GetTestCase_event_read() {
    var argA, argB, argC, testCases = [];
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
            testCases.push({'nodeNumber':argA, 'eventIdentifier': argB, "eventVariableIndex":argC});
        }
      }
    }
    return testCases;
  }


  //
  //
  //
  itParam("event_teach_by_identifier test ${JSON.stringify(value)}", GetTestCase_teach_event(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN event_teach_by_identifier test '});
    mock_messageRouter.messagesIn = []
    // create node config for node we're testing
    node.createNodeConfig(value.nodeNumber)
    // ensure event does exist, so shouldn't refresh events, but will just refresh variable
    node.updateEventInNodeConfig(value.nodeNumber, value.eventIdentifier, 1)
    //
    node.event_teach_by_identifier(value.nodeNumber, value.eventIdentifier, value.eventVariableIndex, value.eventVariableValue )
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_messageRouter.messagesIn[1].eventidentifier).to.equal(value.eventidentifier)
      expect(mock_messageRouter.messagesIn[1].eventVariableIndex).to.equal(value.eventVariableIndex)
      expect(mock_messageRouter.messagesIn[1].eventVariableValue).to.equal(value.eventVariableValue)
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_messageRouter.messagesIn[2].nodeNumber).to.equal(value.nodeNumber)
      expect(mock_messageRouter.messagesIn[3].mnemonic).to.equal("REVAL")
      expect(mock_messageRouter.messagesIn.length).to.equal(4)
      winston.info({message: 'unit_test: END event_teach_by_identifier test'});
			done();
		}, 180);
  })


  //
  //
  //
  it("new_event_teach_2_by_identifier test", function (done) {
    winston.info({message: 'unit_test: BEGIN new_event_teach_2_by_identifier test'});
    mock_messageRouter.messagesIn = []
    // ensure event doesn't exist, so should always refresh all events
    node.createNodeConfig(1)
    //
    node.event_teach_by_identifier(1, "12345678", 1, 0 )
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("NNLRN")
      expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal("EVLRN")
      expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal("NNULN")
      expect(mock_messageRouter.messagesIn[3].mnemonic).to.equal("RQEVN")
      winston.info({message: 'unit_test: END new_event_teach_2_by_identifier test'});
			done();
		}, 150);
  })




  //
  //
  //
  itParam("requestEventVariableByIdentifier test ${JSON.stringify(value)}", GetTestCase_event_read(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN requestEventVariableByIdentifier test: ' + JSON.stringify(value) });
    
    mock_messageRouter.messagesIn = []
    node.nodeConfig.nodes = {}          // start with clean slate
    var data = {"nodeNumber": value.nodeNumber,
      "eventName": value.eventIdentifier,
      "eventIndex": 1,
      "eventVariableId": value.eventVariableIndex,
      "eventVariableValue": 255
    }
    node.updateEventInNodeConfig(value.nodeNumber, value.eventIdentifier, 1)
    await node.requestEventVariableByIdentifier(value.nodeNumber, value.eventIdentifier, value.eventVariableIndex) 
  
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("REVAL")
      winston.info({message: 'unit_test: END requestEventVariableByIdentifier test'});
			done();
		}, 100);

  })

  // request_all_node_events test
  //
  itParam("request_all_node_events test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN request_all_node_events test: ' + JSON.stringify(value) });
    
    mock_messageRouter.messagesIn = []

    await node.request_all_node_events(value.nodeNumber) 
  
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("RQEVN")
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      winston.info({message: 'unit_test: END request_all_node_events test'});
			done();
		}, 30);

  })

  // request_all_node_parameters test
  //
  it("request_all_node_parameters test", function (done) {
    winston.info({message: 'unit_test: BEGIN request_all_node_parameters test: '});
    mock_messageRouter.messagesIn = []
    let nodeNumber = 1
    node.request_all_node_parameters(nodeNumber) 
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("RQNPN")
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(nodeNumber)
      expect(mock_messageRouter.messagesIn[0].parameterIndex).to.equal(0)
      winston.info({message: 'unit_test: END request_all_node_parameters test'});
			done();
		}, 30);
  })


  function GetTestCase_events() {
    var arg1, arg2, arg3, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 1, arg3="long"}
      if (a == 2) {arg1 = 65535, arg3 = 'long'}
      if (a == 3) {arg1 = 65535, arg3 = 'short'}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 65535}
        testCases.push({'nodeNumber':arg1, 'eventNumber': arg2, 'type': arg3});
      }
    }
    return testCases;
  }


  //
  //
  //
  itParam("eventSend test ${JSON.stringify(value)}", GetTestCase_events(), function (value) {
    winston.info({message: 'unit_test: BEGIN eventSend test '});
    node.nodeConfig.events = []
    var busIdentifier = utils.decToHex(value.nodeNumber, 4) + utils.decToHex(value.eventNumber, 4)
    if (value.type == 'long'){
      busIdentifier = 'L' + busIdentifier
    } else {
      busIdentifier = 'S' + busIdentifier
    }
    node.eventSend(value.nodeNumber, value.eventNumber, 'on', value.type)
    winston.info({message: 'unit_test: node.nodeConfig.events ' + JSON.stringify(node.nodeConfig.events[busIdentifier])});
    expect(node.nodeConfig.events[busIdentifier].nodeNumber).to.equal(value.nodeNumber)
    expect(node.nodeConfig.events[busIdentifier].eventNumber).to.equal(value.eventNumber)
    winston.info({message: 'unit_test: END eventSend test'});
  })


  //
  // This test focuses just on bus events
  // should remove both long and short events just for the target node
  //
  itParam("removeNodeBusEvents test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), function (value) {
    winston.info({message: 'unit_test: BEGIN removeNodeBusEvents test '});
    node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    node.nodeConfig.events = []
    // use eventSend to create busEvents...
    node.eventSend(value.nodeNumber, 1, 'on', 'short')      // expect to be deleted
    node.eventSend(value.nodeNumber, 65535, 'on', 'short')  // expect to be deleted
    node.eventSend(value.nodeNumber, 1, 'on', 'long')       // expect to be deleted
    node.eventSend(value.nodeNumber, 65535, 'on', 'long')   // expect to be deleted
    node.eventSend(55, 1, 'on', 'short')                    // expect to remain
    node.eventSend(55, 1, 'on', 'long')                     // expect to remain
    expect (Object.keys(node.nodeConfig.events).length).to.equal(6)   // check all pressent
    node.removeNodeEvents(value.nodeNumber)
    for (const key of Object.keys(node.nodeConfig.events)) {
      winston.info({message: 'unit_test: Event ' + key});
    }
    expect (Object.keys(node.nodeConfig.events).length).to.equal(2)   // check expected number remaining
    winston.info({message: 'unit_test: END removeNodeBusEvents test'});
  })


  //
  //
  //
  itParam("request_node_variable test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (done, value) {
    winston.info({message: 'unit_test: BEGIN request_node_variable test: ' + JSON.stringify(value) });
    mock_messageRouter.messagesIn = []
    await node.request_node_variable(value.nodeNumber, 2) 
    setTimeout(function(){
      for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
        winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
      }
      expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("NVRD")
      expect(mock_messageRouter.messagesIn[0].nodeNumber).to.equal(value.nodeNumber)
      expect(mock_messageRouter.messagesIn[0].nodeVariableIndex).to.equal(2)
      winston.info({message: 'unit_test: END request_node_variable test'});
			done();
		}, 300);

  })



})

