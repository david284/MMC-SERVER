const winston = require('./config/winston_test.js')
const expect = require('chai').expect;


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const config = require('./mock_configuration.js')()
const longMessage = require('../VLCB-server/longMessage.js')
const cbusLib = require('cbuslibrary')

const logPrefix = "UNIT_TEST"

describe('long message tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ long message tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
    //
    longMessage.setup(config)
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

  // LM_REQUEST (220)
  //
  it("LM_REQUEST test", function (done) {
    winston.info({message: logPrefix + ': BEGIN LM_REQUEST test:'});
    longMessage.channels = []   // clear channels
    let channel = 99
    let use = 2
    let option_flags = 3
    let testMessage = cbusLib.decode(cbusLib.encodeLM_REQUEST(channel, use, option_flags))
    winston.info({message: logPrefix +': testMessage ' + JSON.stringify(testMessage)});
    longMessage.processLongMessage(testMessage)
    setTimeout(function(){
      winston.info({message: logPrefix +': channel ' + JSON.stringify(longMessage.channels[channel])});
      expect(longMessage.channels[channel]).to.not.be.undefined
      winston.info({message: logPrefix +': END LM_REQUEST test'});
      done();
    }, 500);
  })

  // START_MESSAGE (239)
  //
  it("LM_START_MESSAGE test", function (done) {
    winston.info({message: logPrefix + ': BEGIN LM_START_MESSAGE test:'});
    longMessage.channels = []   // clear channels
    let channel = 99
    let use = 2
    let nodeNumber = 7
    let option_flags = 3
    let testMessage = cbusLib.decode(cbusLib.encodeLM_START_MESSAGE(channel, use, nodeNumber, option_flags))
    winston.info({message: logPrefix +': testMessage ' + JSON.stringify(testMessage)});
    longMessage.processLongMessage(testMessage)
    setTimeout(function(){
      winston.info({message: logPrefix +': channel ' + JSON.stringify(longMessage.channels[channel])});
      expect(longMessage.channels[channel]).to.not.be.undefined
      let currentMessage = longMessage.channels[channel].currentMessage
      expect(longMessage.channels[channel][currentMessage].use).to.equal(use)
      expect(longMessage.channels[channel][currentMessage].option_flags).to.equal(option_flags)
      winston.info({message: logPrefix +': END LM_START_MESSAGE test'});
      done();
    }, 500);
  })

  //
  //
  it("LM_PROPOSE_CHANNEL test", function (done) {
    winston.info({message: logPrefix + ': BEGIN LM_PROPOSE_CHANNEL test:'});
    longMessage.channels = []   // clear channels
    let channel = 99
    let testMessage = cbusLib.decode(cbusLib.encodeLM_PROPOSE_CHANNEL(channel))
    winston.info({message: logPrefix +': testMessage ' + JSON.stringify(testMessage)});
    longMessage.processLongMessage(testMessage)
    setTimeout(function(){
      winston.info({message: logPrefix +': channel ' + JSON.stringify(longMessage.channels[channel])});
      winston.info({message: logPrefix +': END LM_PROPOSE_CHANNEL test'});
      done();
    }, 500);
  })

  //
  //
  it("LM_CLAIM_CHANNEL test", function (done) {
    winston.info({message: logPrefix + ': BEGIN LM_CLAIM_CHANNEL test:'});
    longMessage.channels = []   // clear channels
    let channel = 99
    let testMessage = cbusLib.decode(cbusLib.encodeLM_CLAIM_CHANNEL(channel))
    winston.info({message: logPrefix +': testMessage ' + JSON.stringify(testMessage)});
    longMessage.processLongMessage(testMessage)
    setTimeout(function(){
      winston.info({message: logPrefix +': channel ' + JSON.stringify(longMessage.channels[channel])});
      winston.info({message: logPrefix +': END LM_CLAIM_CHANNEL test'});
      done();
    }, 500);
  })

  //
  //
  it("LM_DATA test", function (done) {
    winston.info({message: logPrefix + ': BEGIN LM_DATA test:'});
    longMessage.channels = []   // clear channels
    let channel = 99
    let testMessage = cbusLib.decode(cbusLib.encodeLM_DATA(channel, 1, 2, 3, 4, 5, 6))
    winston.info({message: logPrefix +': testMessage ' + JSON.stringify(testMessage)});
    longMessage.processLongMessage(testMessage)
    setTimeout(function(){
      winston.info({message: logPrefix +': channel ' + JSON.stringify(longMessage.channels[channel])});
      expect(longMessage.channels[channel]).to.not.be.undefined
      winston.info({message: logPrefix +': END LM_DATA test'});
      done();
    }, 500);
  })

  //
  //
  it("LM_END_MESSAGE test", function (done) {
    winston.info({message: logPrefix + ': BEGIN LM_END_MESSAGE test:'});
    longMessage.channels = []   // clear channels
    config.eventBus.once('SERVER_NOTIFICATION', function (data) {
      winston.info({message: logPrefix +': eventBus: SERVER_NOTIFICATION ' + JSON.stringify(data)});
    })
    let channel = 99
    let checksum = 777
    let testMessage = cbusLib.decode(cbusLib.encodeLM_END_MESSAGE(channel, checksum))
    winston.info({message: logPrefix +': testMessage ' + JSON.stringify(testMessage)});
    longMessage.processLongMessage(testMessage)
    setTimeout(function(){
      winston.info({message: logPrefix +': channel ' + JSON.stringify(longMessage.channels[channel])});
      expect(longMessage.channels[channel]).to.not.be.undefined
      let currentMessage = longMessage.channels[channel].currentMessage
      expect(longMessage.channels[channel][currentMessage].checksum).to.equal(checksum)
      winston.info({message: logPrefix +': END LM_END_MESSAGE test'});
      done();
    }, 500);
  })



})
