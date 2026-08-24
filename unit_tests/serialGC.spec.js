const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: canUSBX.spec.js'});
const expect = require('chai').expect;

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

  async function connectMockSerialPort() {
    await serialGC.connect("MOCK_PORT")
    if (!serialGC.serialPort.isOpen) {
      await new Promise((resolve, reject) => {
        serialGC.serialPort.once('open', resolve)
        serialGC.serialPort.once('error', reject)
      })
    }
  }

  function dataHandler(data) {
    winston.info({message: name + `: emitted:  ${JSON.stringify(data)}`})
    messageIn = data
  }
  serialGC.on('data', dataHandler)
  

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

	after(function() {
 		winston.info({message: ' '});   // blank line to separate tests
    serialGC.removeListener('data', dataHandler)
	});																										

	afterEach(async function() {
    await serialGC.close()
	});


  //****************************************************************************************** */
  //
  // Actual tests after here...
  //
  //****************************************************************************************** */  

  //
  //
  it("serialGC_RX test ", async function () {
    winston.info({message: 'unit_test: BEGIN serialGC_RX test '});
    await connectMockSerialPort()
    let testPattern = ":SB780N0D;"
    const receivedData = new Promise((resolve) => serialGC.once('data', resolve))
    serialGC.serialPort.port.emitData(testPattern)
    await receivedData
    expect(messageIn).to.equal(testPattern)
    winston.info({message: name +': END serialGC_RX test'});

  })

  //
  //
  it("serialGC_TX test ", async function () {
    winston.info({message: 'unit_test: BEGIN serialGC_TX test '});
    await connectMockSerialPort()
    let testPattern = ":SB780N0D;"
    serialGC.write(testPattern)
    await new Promise((resolve, reject) => {
      serialGC.serialPort.drain((error) => error ? reject(error) : resolve())
    })
    winston.info({message: name +`: END serial TX ${serialGC.serialPort.port.recording}`});
    expect(serialGC.serialPort.port.recording.toString()).to.equal(testPattern)
    winston.info({message: name +': END serialGC_TX test'});
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
