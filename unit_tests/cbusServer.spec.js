const expect = require('chai').expect;
const itParam = require('mocha-param');
const winston = require('./config/winston_test.js')

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const CbusServer = require('../VLCB-server/cbusServer')

const name = 'unit_test: cbusServer'

describe('cbusServer tests', function(){

  let cbusServer = new CbusServer();


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------- cbusServer tests -------------------------------'});
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

  function GetTestCase_connect() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = "MOCK_PORT", arg2 = true}
      if (a == 2) {arg1 = "COM99", arg2 = false}
      if (a == 3) {arg1 = "", arg2 = false}
      testCases.push({'targetSerial':arg1, 'result':arg2});
    }
    return testCases;
  }


  itParam("connect test ${JSON.stringify(value)}", GetTestCase_connect(), async function (done, value) {

    winston.info({message: name + ': BEGIN connect test: ' + JSON.stringify(value)});
    var result = await cbusServer.connect(9999, value.targetSerial)

    setTimeout(function(){
      winston.info({message: name +': connect test: result ' + result});
      cbusServer.close()
      expect(result).to.equal(value.result);
      winston.info({message: name +': END connect test'});
			done();
		}, 20);


  })

})