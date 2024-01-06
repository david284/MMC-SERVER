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

const config = require('../VLCB-server/configuration.js')('./unit_tests/test_output/config/')

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
        // ensure expected CAN header is reset before each test run
	});

	after(function() {
   		winston.info({message: ' '});   // blank line to separate tests
	});																										

  //****************************************************************************************** */
  //
  // Actual tests after here...
  //
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


  //
  itParam("DKEEP test ${JSON.stringify(value)}", GetTestCase_session(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN DKEEP test ' + JSON.stringify(value)});
    var testMessage = cbusLib.encodeDKEEP(value.session)
    mock_jsonServer.messagesIn = []
    mock_jsonServer.inject(testMessage)
    setTimeout(function(){
      var result = JSON.parse(mock_jsonServer.messagesIn[0])
      expect(result.mnemonic).to.equal("QLOC")
      expect(result.session).to.equal(value.session)
      winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
			done();
		}, 10);
  })

})


