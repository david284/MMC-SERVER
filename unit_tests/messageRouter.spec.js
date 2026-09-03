const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: messageRouter.spec.js'});
const path = require('path');
const expect = require('chai').expect;

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared
const testSystemDirectory = "./unit_tests/test_output"
const logsPath = path.join(process.cwd(), "unit_tests", "logs")
const config = require('../VLCB-server/configuration.js')(testSystemDirectory, logsPath)

const cbusServerPort = 9990

const mock_cbusServer = new (require('./mock_cbusServer'))(cbusServerPort)
const messageRouter = require('../VLCB-server/messageRouter.js')(config)

const name = 'unit_test: messageRouter'
  
describe('messageRouter tests', function(){

	before(async function() {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '----------------------------- messageRouter tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
    await mock_cbusServer.listening
    await messageRouter.connect('localhost', cbusServerPort)
	});

	beforeEach(function() {
    winston.info({message: ' '});   // blank line to separate tests
    winston.info({message: ' '});   // blank line to separate tests
        // ensure expected CAN header is reset before each test run
	});

	after(async function() {
 		winston.info({message: ' '});   // blank line to separate tests
    await messageRouter.close()
    await mock_cbusServer.close()
	});																										


  //****************************************************************************************** */
  //
  // Actual tests after here...
  //
  //****************************************************************************************** */  


  it("connect waits for the TCP connection", async function () {
    const testCbusServer = new (require('./mock_cbusServer'))(0)
    const testMessageRouter = require('../VLCB-server/messageRouter.js')(config)
    const address = await testCbusServer.listening

    try {
      await testMessageRouter.connect('localhost', address.port)
      expect(testMessageRouter.connected).to.equal(true)
    } finally {
      await testMessageRouter.close()
      await testCbusServer.close()
    }
  })

  it("reports a network failure when an established connection closes", async function () {
    const testConfig = require('./mock_configuration.js')()
    const testCbusServer = new (require('./mock_cbusServer'))(0)
    const testMessageRouter = require('../VLCB-server/messageRouter.js')(testConfig)
    const address = await testCbusServer.listening
    const failure = waitForEvent(testConfig.eventBus, 'NETWORK_CONNECTION_FAILURE')

    try {
      await testMessageRouter.connect('localhost', address.port)
      await testCbusServer.close()

      expect((await failure).message).to.equal('Network error - retrying connection')
      expect(testMessageRouter.connected).to.equal(false)
      expect(testMessageRouter.enableReconnect).to.equal(true)
    } finally {
      await testMessageRouter.close()
      await testCbusServer.close()
    }
  })

  it("does not duplicate a network failure notification when an error is followed by close", async function () {
    const testConfig = require('./mock_configuration.js')()
    const testCbusServer = new (require('./mock_cbusServer'))(0)
    const testMessageRouter = require('../VLCB-server/messageRouter.js')(testConfig)
    const address = await testCbusServer.listening
    const failures = []
    testConfig.eventBus.on('NETWORK_CONNECTION_FAILURE', (failure) => failures.push(failure))

    try {
      await testMessageRouter.connect('localhost', address.port)
      testMessageRouter.cbusClient.emit('error', new Error('test connection error'))
      testMessageRouter.cbusClient.emit('close')

      expect(failures).to.have.lengthOf(1)
      expect(failures[0].message).to.equal('Network error - retrying connection')
    } finally {
      await testMessageRouter.close()
      await testCbusServer.close()
    }
  })


  it("sendCbusMessage test", function (done) {
    winston.info({message: name + ': BEGIN sendCbusMessage test:'});
    let cbusTraffic = undefined
    config.eventBus.once('CBUS_TRAFFIC', function (data) {
      winston.info({message: name +': sendCbusMessage test: CBUS_TRAFFIC ' + JSON.stringify(data)});
      cbusTraffic = data
    })

    let testMessage = ":SB780N0D;"  // QNN
    messageRouter.sendCbusMessage(testMessage)

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

function waitForEvent(eventBus, event) {
  return new Promise((resolve) => eventBus.once(event, resolve))
}
