const expect = require('chai').expect;
const itParam = require('mocha-param');
const winston = require('./config/winston_test.js')

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

	after(function() {
   		winston.info({message: ' '});   // blank line to separate tests
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




})