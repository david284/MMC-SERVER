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
config.setLayoutsPath("./unit_tests/test_output/layouts/")
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


  function GetTestCase_session() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 255}
      testCases.push({'session':arg1});
    }
    return testCases;
  }

  //
  itParam("QLOC test ${JSON.stringify(value)}", GetTestCase_session(), async function (value) {
    winston.info({message: 'unit_test: BEGIN QLOC test ' + JSON.stringify(value)});
    var result = node.QLOC(value.session)
    winston.info({message: 'unit_test: result ' + JSON.stringify(result)});
    expect(result.mnemonic).to.equal('QLOC');
    expect(result.session).to.equal(value.session);
    winston.info({message: 'unit_test: END QLOC test'});
  })


  //
  itParam("DKEEP test ${JSON.stringify(value)}", GetTestCase_session(), async function (done, value) {
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

