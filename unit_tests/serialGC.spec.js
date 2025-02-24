const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: canUSBX.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const serialGC = require('../VLCB-server/serialGC')

const name = 'unit_test: serialGC'

describe('serialGC tests', function(){

  let messageIn = null

  serialGC.on('data', function (data) {
    winston.info({message: name + `: emitted:  ${JSON.stringify(data)}`})
    messageIn = data
  })
  

	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '-------------------------------- serialGC tests --------------------------------'});
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
  it("serialGC_RX test ", function (done) {
    winston.info({message: 'unit_test: BEGIN serialGC_RX test '});
    serialGC.connect("MOCK_PORT")

    setTimeout(function(){
      // emulate some data being received on serialPort
      let testPattern = ":SB780N0D;"
      serialGC.serialPort.port.emitData(testPattern)

      setTimeout(function(){
        expect(messageIn).to.equal(testPattern)
        winston.info({message: name +': END serialGC_RX test'});
        done();
      }, 20);
    }, 20);

  })

  //
  //
  it("serialGC_TX test ", function (done) {
    winston.info({message: 'unit_test: BEGIN serialGC_TX test '});
    serialGC.connect("MOCK_PORT")
    let testPattern = ":SB780N0D;"
    setTimeout(function(){
      serialGC.write(testPattern)
      setTimeout(function(){        
        winston.info({message: name +`: END serial TX ${serialGC.serialPort.port.recording}`});
        expect(serialGC.serialPort.port.recording.toString()).to.equal(testPattern)
        winston.info({message: name +': END serialGC_TX test'});
        done();
      }, 10);
    }, 10);
  })

  //
  // this will fail if there is a CANUSB connected
  //
  it("getCANUSBx test ", async function () {
    winston.info({message: 'unit_test: BEGIN getCANUSBx test '});
    let result = await serialGC.getCANUSBx()
    winston.info({message: name +`: result ${result}`});
    expect(result).to.equal(undefined)
    winston.info({message: name +': END getCANUSBx test'});
  })

})