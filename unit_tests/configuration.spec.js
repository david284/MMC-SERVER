const expect = require('chai').expect;
const itParam = require('mocha-param');
const winston = require('./config/winston_test.js')
const fs = require('fs');


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const expectedConfigPath = "./unit_tests/test_output/config/"

const config = require('../VLCB-server/configuration.js')(expectedConfigPath)


describe('configuration tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ configuration tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
        
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

  //
  it("configPath test ${JSON.stringify(value)}", function () {
    winston.info({message: 'unit_test: BEGIN configPath test '});
    result = config.getConfigurationPath();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(expectedConfigPath);
    winston.info({message: 'unit_test: END configPath test'});
  })

  //
  it("layoutsPath test ${JSON.stringify(value)}", function () {
    winston.info({message: 'unit_test: BEGIN layoutsPath test '})
    var testPath = './unit_tests/test_output/layouts/'
    result = config.setLayoutsPath(testPath)
    winston.info({message: 'result: ' + config.getLayoutsPath()})
    expect(config.getLayoutsPath()).to.equal(testPath)
    winston.info({message: 'unit_test: END layoutsPath test'})
  })


  //
  it("currentLayoutFolder test ${JSON.stringify(value)}", function () {
    winston.info({message: 'unit_test: BEGIN currentLayoutFolder test '})
    var testFolder = 'new_layout'
    result = config.setCurrentLayoutFolder(testFolder)
    winston.info({message: 'result: ' + config.getCurrentLayoutFolder()})
    expect(config.getCurrentLayoutFolder()).to.equal(testFolder)
    winston.info({message: 'unit_test: END currentLayoutFolder test'})
  })


  //
  it("getLayoutList test ${JSON.stringify(value)}", function () {
    winston.info({message: 'unit_test: BEGIN getLayoutList test '})
    result = config.getListOfLayouts()
    winston.info({message: 'result: ' + result})
//    expect(config.getCurrentLayoutFolder()).to.equal(testFolder)
    winston.info({message: 'unit_test: END getLayoutList test'})
  })


  function GetTestCase_port() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      testCases.push({'port':arg1});
    }
    return testCases;
  }

  //
  itParam("cbusServerPort test ${JSON.stringify(value)}", GetTestCase_port(), function (value) {
    winston.info({message: 'unit_test: BEGIN cbusServerPort test '});
    config.setCbusServerPort(value.port);
    result = config.getCbusServerPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.port);
    winston.info({message: 'unit_test: END cbusServerPort test'});
  })

  //
  itParam("jsonServerPort test ${JSON.stringify(value)}", GetTestCase_port(), function (value) {
    winston.info({message: 'unit_test: BEGIN jsonServerPort test '});
    config.setJsonServerPort(value.port);
    result = config.getJsonServerPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.port);
    winston.info({message: 'unit_test: END jsonServerPort test'});
  })

  //
  itParam("socketServerPort test ${JSON.stringify(value)}", GetTestCase_port(), function (value) {
    winston.info({message: 'unit_test: BEGIN socketServerPort test '});
    config.setSocketServerPort(value.port);
    result = config.getSocketServerPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.port);
    winston.info({message: 'unit_test: END socketServerPort test'});
  })


})