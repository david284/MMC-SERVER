const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: jsonServer.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared
const testSystemConfigPath = "./unit_tests/test_output/config"
const config = require('../VLCB-server/configuration.js')(testSystemConfigPath)

const mock_cbusServer = new (require('./mock_cbusServer'))(9998)
const jsonServer = require('../VLCB-server/jsonServer.js')(9997, config)


const name = 'unit_test: jsonServer'


  
describe('jsonServer tests', function(){

  jsonServer.connect('localhost', 9998)

	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------- jsonServer tests -------------------------------'});
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


  it("sendCbusMessage test", function (done) {
    winston.info({message: name + ': BEGIN sendCbusMessage test:'});
    let cbusTraffic = undefined
    config.eventBus.once('CBUS_TRAFFIC', function (data) {
      winston.info({message: name +': sendCbusMessage test: CBUS_TRAFFIC ' + JSON.stringify(data)});
      cbusTraffic = data
    })

    let testMessage = ":SB780N0D;"  // QNN
    var result = jsonServer.sendCbusMessage(testMessage)

    setTimeout(function(){
      winston.info({message: name +': sendCbusMessage test: result ' + mock_cbusServer.messagesIn[0].toString()});
      expect(mock_cbusServer.messagesIn[0].toString()).to.equal(testMessage);
      expect(cbusTraffic.json.encoded).to.equal(testMessage);
      winston.info({message: name +': END sendCbusMessage test'});
			done();
		}, 500);
  })

  it("sendCbusMessageEvent test", function (done) {
    winston.info({message: name + ': BEGIN sendCbusMessageEvent test:'});
    let cbusTraffic = undefined
    config.eventBus.once('CBUS_TRAFFIC', function (data) {
      winston.info({message: name +': sendCbusMessageEvent test: CBUS_TRAFFIC ' + JSON.stringify(data)});
      cbusTraffic = data
    })

    let testMessage = ":SB780N0D;"  // QNN
    config.eventBus.emit ('GRID_CONNECT_SEND', testMessage)

    setTimeout(function(){
      winston.info({message: name +': sendCbusMessageEvent test: result ' + mock_cbusServer.messagesIn[0].toString()});
      expect(mock_cbusServer.messagesIn[0].toString()).to.equal(testMessage);
      expect(cbusTraffic.json.encoded).to.equal(testMessage);
      winston.info({message: name +': END sendCbusMessageEvent test'});
			done();
		}, 500);
  })

  it("receiveCbusMessage test", function (done) {
    winston.info({message: name + ': BEGIN receiveCbusMessage test:'});
    let gcRX = undefined
    config.eventBus.once('GRID_CONNECT_RECEIVE', function (data) {
      winston.info({message: name +': GRID_CONNECT_RECEIVE: ' + JSON.stringify(data)});
      gcRX = data
    })

    let testMessage = ":SB780N500101;"  // RQNN node 257
    mock_cbusServer.inject(testMessage)

    setTimeout(function(){
      winston.info({message: name +': sendCbusMessage test: result ' + gcRX});
      expect(gcRX).to.equal(testMessage);
      winston.info({message: name +': END receiveCbusMessage test'});
			done();
		}, 500);
  })


})