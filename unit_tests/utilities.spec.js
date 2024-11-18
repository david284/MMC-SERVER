const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: utilities.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const utils = require('../VLCB-server/utilities.js')

describe('utilities tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------- utilities tests --------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
    //
		done();
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


  function GetTestCase_CANID() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 6; a++) {
      if (a == 1) {arg1 = ":S0000N;", arg2 = 0}
      if (a == 2) {arg1 = ":S0020N;", arg2 = 1}
      if (a == 3) {arg1 = ":S07E0N;", arg2 = 63}
      if (a == 4) {arg1 = ":S0FE0N;", arg2 = 127}
      if (a == 5) {arg1 = ":S0FF0N;", arg2 = 127}
      if (a == 6) {arg1 = ":SFFFFN;", arg2 = 127}
      testCases.push({'MGC':arg1, 'expectedResult': arg2});
    }
    return testCases;
  }

  //
  itParam("getMGCCANID test ${JSON.stringify(value)}", GetTestCase_CANID(), function (value) {
    winston.info({message: 'unit_test: BEGIN getMGCCANID test ' + JSON.stringify(value)})
    result = utils.getMGCCANID(value.MGC)
    winston.info({message: 'result: ' + JSON.stringify(result)})
    expect(result).to.equal(value.expectedResult);
    winston.info({message: 'unit_test: END getMGCCANID test'})
  })

  it("sleep test ", async function () {
    winston.info({message: 'unit_test: BEGIN sleep test '});
    await utils.sleep(1000)
    winston.info({message: 'unit_test: END sleep test'});
  })


  function GetTestCase_getEventTableIndex() {
    var argA, argB, argC, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = "00000000"}
        if (b == 2) {argB = "00000001"}
        if (b == 3) {argB = "FFFFFFFF"}
        for (var c = 1; c<= 2; c++) {
          if (c == 1) {argC = 1}
          if (c == 2) {argC = undefined}
            testCases.push({'nodeNumber':argA, 'eventIdentifier': argB, "result":argC});
        }
      }
    }
    return testCases;
  }

  itParam("getEventTableIndexNI test ${JSON.stringify(value)}", GetTestCase_getEventTableIndex(), function (value) {
    winston.info({message: 'unit_test: BEGIN getEventTableIndexNI test '});
    // create node with no matching events
    var node = {storedEventsNI:{}}
    if (value.result == 1){
      // event should exist, so populate it
      node.storedEventsNI[value.eventIdentifier] = {eventIndex: 1}
    }
    result = utils.getEventTableIndexNI(node, value.eventIdentifier )
    expect(result).to.equal(value.result)
    winston.info({message: 'unit_test: END getEventTableIndexNI test'});
  })


  itParam("getEventTableIndex test ${JSON.stringify(value)}", GetTestCase_getEventTableIndex(), function (value) {
    winston.info({message: 'unit_test: BEGIN getEventTableIndex test '});
    // create node with no matching events
    var node = {storedEvents:{0:{}}}
    if (value.result == 1){
      // event should exist, so populate it
      node.storedEvents[1] = {eventIdentifier: value.eventIdentifier}
    }
    result = utils.getEventTableIndex(node, value.eventIdentifier )
    expect(result).to.equal(value.result)
    winston.info({message: 'unit_test: END getEventTableIndex test'});
  })





})