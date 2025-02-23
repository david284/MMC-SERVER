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

canUSBX.on('canUSBX', function (data) {
  winston.info({message: name + `: emitted:  ${JSON.stringify(data)}`})
})

  
describe('canUSBX tests', function(){

  let NetworkMessage = ''
  let network = null

  let server = net.createServer(function (socket) {
    network = socket
    socket.setKeepAlive(true, 60000)
    winston.info({message: name + `: network Connection received`})

    socket.on('data', function (data) {
      winston.info({message: name + `: network data ${data}`})
      NetworkMessage += data.toString();
    }.bind(this));

    socket.on('end', function () {
        winston.info({message: name + `: Client Disconnected`})
    }.bind(this))

    socket.on("error", (err) => {
      winston.info({message: name + `: socket error:`})
    })

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
    server.listen(5550, () => {
      winston.info({message: name + ': connect: listner bound '})
    })
    canUSBX.connect("MOCK_PORT", 5550, "127.0.0.1")

    setTimeout(function(){
      // emulate some data being received on serialPort
      let testPattern = ":SB780N0D;"
      canUSBX.serialPort.port.emitData(testPattern)

      setTimeout(function(){
        winston.info({message: name +`: NetworkMessage ${NetworkMessage}`});
        expect(NetworkMessage).to.equal(testPattern)
        server.close()
        winston.info({message: name +': END canUSBX_RX test'});
        done();
      }, 100);
    }, 100);

  })

  //
  //
  it("canUSBX_TX test ", function (done) {
    winston.info({message: 'unit_test: BEGIN canUSBX_TX test '});
    server.listen(5550, () => {
      winston.info({message: name + ': connect: listner bound '})
    })
    canUSBX.connect("MOCK_PORT", 5550, "127.0.0.1")
    let testPattern = ":SB780N0D;"
    setTimeout(function(){
      network.write(testPattern)
      setTimeout(function(){        
        winston.info({message: name +`: END serial TX ${canUSBX.serialPort.port.recording}`});
        expect(canUSBX.serialPort.port.recording.toString()).to.equal(testPattern)
        server.close()
        winston.info({message: name +': END canUSBX_TX test'});
        done();
      }, 100);
    }, 100);
  })


  //
  //
  it("canUSBX_write test ", function (done) {
    winston.info({message: 'unit_test: BEGIN canUSBX_write test '});
    server.listen(5550, () => {
      winston.info({message: name + ': connect: listner bound '})
    })
    canUSBX.connect("MOCK_PORT", 5550, "127.0.0.1")
    let testPattern = ":SB780N0D;"
    setTimeout(function(){
      canUSBX.write(testPattern)
//      network.write(testPattern)
      setTimeout(function(){        
        winston.info({message: name +`: END serial TX ${canUSBX.serialPort.port.recording}`});
        expect(canUSBX.serialPort.port.recording.toString()).to.equal(testPattern)
        server.close()
        winston.info({message: name +': END canUSBX_write test'});
        done();
      }, 100);
    }, 100);
  })


  /*
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
  */  

})