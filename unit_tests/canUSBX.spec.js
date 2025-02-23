const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: canUSBX.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');
const net = require('net')

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const canUSBX = require('../VLCB-server/canUSBX')

const name = 'unit_test: canUSBX'

describe('canUSBX tests', function(){

  let messageIn = null

  canUSBX.on('canUSBX', function (data) {
    winston.info({message: name + `: emitted:  ${JSON.stringify(data)}`})
    messageIn = data
  })
  

	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------- canUSBX tests -------------------------------'});
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

  //
  //
  it("canUSBX_RX test ", function (done) {
    winston.info({message: 'unit_test: BEGIN canUSBX_RX test '});
    canUSBX.connect("MOCK_PORT")

    setTimeout(function(){
      // emulate some data being received on serialPort
      let testPattern = ":SB780N0D;"
      canUSBX.serialPort.port.emitData(testPattern)

      setTimeout(function(){
        expect(messageIn).to.equal(testPattern)
        winston.info({message: name +': END canUSBX_RX test'});
        done();
      }, 10);
    }, 10);

  })

  //
  //
  it("canUSBX_TX test ", function (done) {
    winston.info({message: 'unit_test: BEGIN canUSBX_TX test '});
    canUSBX.connect("MOCK_PORT")
    let testPattern = ":SB780N0D;"
    setTimeout(function(){
      canUSBX.write(testPattern)
      setTimeout(function(){        
        winston.info({message: name +`: END serial TX ${canUSBX.serialPort.port.recording}`});
        expect(canUSBX.serialPort.port.recording.toString()).to.equal(testPattern)
        winston.info({message: name +': END canUSBX_TX test'});
        done();
      }, 10);
    }, 10);
  })

  //
  // this will fail if there is a CANUSB connected
  //
  it("getCANUSBx test ", async function () {
    winston.info({message: 'unit_test: BEGIN getCANUSBx test '});
    let result = await canUSBX.getCANUSBx()
    winston.info({message: name +`: result ${result}`});
    expect(result).to.equal(undefined)
    winston.info({message: name +': END getCANUSBx test'});
  })

})