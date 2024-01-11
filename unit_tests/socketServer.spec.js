const expect = require('chai').expect;
const itParam = require('mocha-param');
const winston = require('./config/winston_test.js')
const fs = require('fs');
const net = require('net')
//import io from 'socket.io-client'
const { io } = require("socket.io-client")
const cbusLib = require('cbuslibrary')

const socketServer = require('../VLCB-server/socketServer.js')


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const config = require('../VLCB-server/configuration.js')('./unit_tests/test_output/config/')

// set config items
config.setServerAddress("localhost")
config.setCbusServerPort(5560);
config.setJsonServerPort(5561);
config.setSocketServerPort(5562);


const mock_jsonServer = new (require('./mock_jsonServer'))(config.getJsonServerPort())
socketServer.socketServer(config)


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


describe('socketServer tests', function(){

  const socket = io(`http://${config.getServerAddress()}:${config.getSocketServerPort()}`)

  // Add a connect listener
  socket.on('connect', function (socket) {
    winston.info({message: 'socketserver: web socket Connected!'})
  });

  var layoutDetails = {}
  socket.on('layoutDetails', function (data) {
    layoutDetails = data;
//    winston.debug({message: ' layoutDetails : ' + JSON.stringify(layoutDetails)});
    });	

	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ socketServer tests ------------------------------'});
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



  //
  it("request_layout_list test", function (done) {
    winston.info({message: 'unit_test: BEGIN request_layout_list test '});
    //
    socket.on('LAYOUTS_LIST', function (data) {
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
      if (a == 1) {arg1 = "unit_test1"}
      if (a == 2) {arg1 = "unit_test2"}
      if (a == 3) {arg1 = "unit_test3"}
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
      winston.info({message: ' layoutDetails : ' + JSON.stringify(layoutDetails)});
      expect(layoutDetails.layoutDetails.title).to.equal(value.layout + " layout");
      winston.info({message: 'unit_test: END change_layout test'});
			done();
		}, 30);
  })

  //
  it("request_version test", function (done) {
    winston.info({message: 'unit_test: BEGIN request_version test '});
    //
    socket.on('VERSION', function (data) {
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



})


