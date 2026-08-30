const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: socketServer.spec.js'});
const path = require('path');
const expect = require('chai').expect;
const itParam = require('mocha-param');
const fs = require('fs');
//import io from 'socket.io-client'
const { io } = require("socket.io-client")
const cbusLib = require('cbuslibrary')
const utils = require('./../VLCB-server/utilities.js');


const socketServer = require('../VLCB-server/socketServer.js')

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const testSystemDirectory = "./unit_tests/test_output"
const testUserConfigPath = "./unit_tests/test_output/test_user"
const testAppStoragePath = "./unit_tests/test_output"
const logsPath = path.join(process.cwd(), "unit_tests", "logs")
const config = require('../VLCB-server/configuration.js')(testSystemDirectory, logsPath)
// override direectories set in configuration constructor
config.singleUserDirectory = testUserConfigPath
config.currentUserDirectory = config.singleUserDirectory
config.appStorageDirectory =  testAppStoragePath

// set config items
config.setSocketServerPort(0);


const mock_messageRouter = require('./mock_messageRouter')(config)


let status = {"busConnection":{
  "state":true
  }
}

const cbusServer = require('../VLCB-server/cbusServer')(config, 9998)
const node = require('./../VLCB-server/mergAdminNode.js')(config)
const programNode = require('../VLCB-server/programNodeMMC.js')(config)

node.inUnitTest = true
let testSocketServer
let exitProcess
let sleepForTest

const name = 'unit_test: socketServer'

describe('socketServer tests', async function(){

  let socket

	before(async function() {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ socketServer tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
        
    testSocketServer = socketServer.socketServer(
      config,
      node,
      mock_messageRouter,
      cbusServer,
      programNode,
      status,
      {
        exitProcess: () => exitProcess(),
        sleep: (milliseconds) => sleepForTest(milliseconds)
      }
    )
    const address = await testSocketServer.listening
    socket = io(`http://localhost:${address.port}`, {autoConnect: false})
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
      socket.connect()
    })
    //
    // Use local 'user' directory for tests...
    config.singleUserConfigPath = "./unit_tests/test_output/test_user"
	});

	beforeEach(function() {
    winston.info({message: ' '});   // blank line to separate tests
    winston.info({message: ' '});   // blank line to separate tests
        // ensure expected CAN header is reset before each test run
		exitProcess = () => {}
		sleepForTest = async () => {}
	});

	after(async function() {
		winston.info({message: ' '});   // blank line to separate tests
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
    }
    if (testSocketServer) {
      await testSocketServer.close()
    }
    await cbusServer.close()
    node.dispose()
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

  function waitForSocketEvent(eventName, action) {
    return new Promise((resolve) => {
      socket.once(eventName, resolve)
      action()
    })
  }

  function emitWithAck(eventName, ...args) {
    return new Promise((resolve, reject) => {
      socket.timeout(2000).emit(eventName, ...args, (error, response) => {
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
      })
    })
  }

  async function withStubs(stubs, action) {
    const originals = stubs.map(([target, property]) => ({
      target,
      property,
      hadOwnProperty: Object.hasOwn(target, property),
      value: target[property]
    }))

    for (const [target, property, value] of stubs) {
      target[property] = value
    }

    try {
      return await action()
    } finally {
      for (const original of originals) {
        if (original.hadOwnProperty) {
          original.target[original.property] = original.value
        } else {
          delete original.target[original.property]
        }
      }
    }
  }

  async function waitForSocketBarrier() {
    await waitForSocketEvent('BUS_CONNECTION', () => socket.emit('REQUEST_BUS_CONNECTION'))
  }

  async function waitForCBUSMessages(expectedCount, timeoutMs = 2000) {
    const timeout = Date.now() + timeoutMs
    while ((node.CBUS_Queue.length > 0 || mock_messageRouter.messagesIn.length < expectedCount) && Date.now() < timeout) {
      await utils.sleep(1)
    }
    expect(node.CBUS_Queue.length).to.equal(0)
    expect(mock_messageRouter.messagesIn.length).to.equal(expectedCount)
  }

  function GetTestCase_event() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 4; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      if (a == 4) {arg1 = undefined}
      for (var b = 1; b<= 4; b++) {
        if (b == 1) {arg2 = 0}
        if (b == 2) {arg2 = 1}
        if (b == 3) {arg2 = 65535}
        if (b == 4) {arg2 = undefined}
        testCases.push({'nodeNumber':arg1, 'eventNumber': arg2});
      }
    }
    return testCases;
  }


  itParam("ACCESSORY_LONG_OFF test ${JSON.stringify(value)}", GetTestCase_event(), async function (value) {
    winston.info({message: name +': BEGIN ACCESSORY_LONG_OFF test  ' + JSON.stringify(value)});
    mock_messageRouter.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_LONG_OFF')
    } else {
      socket.emit('ACCESSORY_LONG_OFF', {
        "nodeNumber": value.nodeNumber,
        "eventNumber": value.eventNumber
      })
    }
    await waitForSocketBarrier()
    if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        await waitForCBUSMessages(1)
        winston.info({message: name + ': raw result ' + mock_messageRouter.messagesIn[0]});
        const CbusMsg = mock_messageRouter.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ACOF");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.eventNumber).to.equal(value.eventNumber);
    } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_messageRouter.messagesIn.length).to.equal(0);
    }
    winston.info({message: name + ': END ACCESSORY_LONG_OFF test'});
  })


  itParam("ACCESSORY_LONG_ON test ${JSON.stringify(value)}", GetTestCase_event(), async function (value) {
    winston.info({message: name + ': BEGIN ACCESSORY_LONG_ON test ' + JSON.stringify(value)});
    mock_messageRouter.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_LONG_ON')
    } else {
      socket.emit('ACCESSORY_LONG_ON', {
        "nodeNumber": value.nodeNumber,
        "eventNumber": value.eventNumber
      })
    }
    await waitForSocketBarrier()
    if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        await waitForCBUSMessages(1)
        winston.info({message: name + ': raw result ' + mock_messageRouter.messagesIn[0]});
        const CbusMsg = mock_messageRouter.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ACON");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.eventNumber).to.equal(value.eventNumber);
    } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_messageRouter.messagesIn.length).to.equal(0);
    }
    winston.info({message: name +': END ACCESSORY_LONG_ON test'});
  })


  itParam("ACCESSORY_SHORT_OFF test ${JSON.stringify(value)}", GetTestCase_event(), async function (value) {
    winston.info({message: name +': BEGIN ACCESSORY_SHORT_OFF test  ' + JSON.stringify(value)});
    mock_messageRouter.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_SHORT_OFF')
    } else {
      socket.emit('ACCESSORY_SHORT_OFF', {
        "nodeNumber": value.nodeNumber,
        "deviceNumber": value.eventNumber
      })
    }
    await waitForSocketBarrier()
    if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        await waitForCBUSMessages(1)
        winston.info({message: name + ': raw result ' + mock_messageRouter.messagesIn[0]});
        const CbusMsg = mock_messageRouter.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ASOF");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.deviceNumber).to.equal(value.eventNumber);
    } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_messageRouter.messagesIn.length).to.equal(0);
    }
    winston.info({message: name + ': END ACCESSORY_SHORT_OFF test'});
  })


  itParam("ACCESSORY_SHORT_ON test ${JSON.stringify(value)}", GetTestCase_event(), async function (value) {
    winston.info({message: name +': BEGIN ACCESSORY_SHORT_ON test  ' + JSON.stringify(value)});
    mock_messageRouter.messagesIn = []
    if ((value.nodeNumber == undefined) && (value.eventNumber == undefined)){
      // special case - don't send any arguments
      socket.emit('ACCESSORY_SHORT_ON')
    } else {
      socket.emit('ACCESSORY_SHORT_ON', {
        "nodeNumber": value.nodeNumber,
        "deviceNumber": value.eventNumber
      })
    }
    await waitForSocketBarrier()
    if((value.nodeNumber != undefined) && (value.eventNumber != undefined)) {
        await waitForCBUSMessages(1)
        winston.info({message: name + ': raw result ' + mock_messageRouter.messagesIn[0]});
        const CbusMsg = mock_messageRouter.messagesIn[0]
        winston.info({message: name + ': result ' + JSON.stringify(CbusMsg)});
        expect(CbusMsg.mnemonic).to.equal("ASON");
        expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber);
        expect(CbusMsg.deviceNumber).to.equal(value.eventNumber);
    } else {
        // if either parameter is undefined, then no message should be generated
        expect(mock_messageRouter.messagesIn.length).to.equal(0);
    }
    winston.info({message: name + ': END ACCESSORY_SHORT_ON test'});
  })

  //
  //
  it("request_layout_list test", async function () {
    winston.info({message: 'unit_test: BEGIN request_layout_list test '});
    //
    const layoutsList = await waitForSocketEvent('LAYOUTS_LIST', () => socket.emit('REQUEST_LAYOUTS_LIST'))
    winston.info({message: ' LAYOUTS_LIST : ' + JSON.stringify(layoutsList)});
    winston.info({message: 'unit_test: END request_layout_list test'});
  })


  function GetTestCase_layout() {
    var arg1, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = "unit_test1 layout"}
      if (a == 2) {arg1 = "unit_test2 layout"}
      if (a == 3) {arg1 = "unit_test3 layout"}
      testCases.push({'layout':arg1});
    }
    return testCases;
  }


  //
  itParam("change_layout test ${JSON.stringify(value)}", GetTestCase_layout(), async function (value) {
    winston.info({message: 'unit_test: BEGIN change_layout test '});
    const layoutData = await waitForSocketEvent('LAYOUT_DATA', () => {
      socket.emit('CHANGE_LAYOUT', {"layoutName": value.layout.toUpperCase()})
    })
    winston.info({message: ' layoutData : ' + JSON.stringify(layoutData)});
    expect(layoutData.layoutDetails.title).to.equal(value.layout.toUpperCase());
    winston.info({message: 'unit_test: END change_layout test'});
  })

  /*

  //
  itParam("change_layout_alt test ${JSON.stringify(value)}", GetTestCase_layout(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN change_layout_alt test '});
    socket.emit('CHANGE_LAYOUT', {"userPath": "./unit_tests/test_output/test_user_alt", "layoutName": value.layout})
    //
    setTimeout(function(){
      winston.info({message: ' layoutData : ' + JSON.stringify(layoutData)});
      expect(layoutData.layoutDetails.title).to.equal(value.layout);
      winston.info({message: 'unit_test: END change_layout_alt test'});
			done();
		}, 30);
  })
*/

  //
  it("request_version test", async function () {
    winston.info({message: 'unit_test: BEGIN request_version test '});
    //
    const version = await waitForSocketEvent('VERSION', () => socket.emit('REQUEST_VERSION'))
    winston.info({message: ' VERSION : ' + JSON.stringify(version)});
    winston.info({message: 'unit_test: END request_version test'});
  })


  itParam("SET_CAN_ID test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN SET_CAN_ID test - nodeNumber ' + value.nodeNumber});
    mock_messageRouter.messagesIn = []
    var data = {
      nodeNumber:value.nodeNumber,
      CAN_ID: 1
    }
    socket.emit('SET_CAN_ID', data)
    await waitForSocketBarrier()
    await waitForCBUSMessages(1)
    const CbusMsg = mock_messageRouter.messagesIn[0]
    winston.info({message: 'unit_test: result ' + JSON.stringify(CbusMsg)});
    expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber)
    expect(CbusMsg.CAN_ID).to.equal(1)
    winston.info({message: 'unit_test: END SET_CAN_ID test'});
  })


  itParam("SET_NODE_NUMBER test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN SET_NODE_NUMBER test - nodeNumber ' + value.nodeNumber});
    mock_messageRouter.messagesIn = []
    socket.emit('SET_NODE_NUMBER', value.nodeNumber)
    await waitForSocketBarrier()
    await waitForCBUSMessages(1)
    const CbusMsg = mock_messageRouter.messagesIn[0]
    winston.info({message: 'unit_test: result ' + JSON.stringify(CbusMsg)});
    expect(CbusMsg.nodeNumber).to.equal(value.nodeNumber)
    winston.info({message: 'unit_test: END SET_NODE_NUMBER test'});
  })


  //
  //
  itParam("REQUEST_NODE_NUMBER test ${JSON.stringify(value)}", GetTestCase_nodeNumber(), async function (value) {
    winston.info({message: 'unit_test: BEGIN REQUEST_NODE_NUMBER test '});
    var testMessage = cbusLib.encodeRQNN(value.nodeNumber)
    mock_messageRouter.messagesIn = []
    node.rqnnPreviousNodeNumber = value.nodeNumber
    //node.createNodeConfig(value.nodeNumber)    // create node config for node we're testing
    const response = new Promise((resolve) => {
      socket.once('REQUEST_NODE_NUMBER', function (nodeNumber, name) {
        resolve({nodeNumber, name})
      })
    })
    mock_messageRouter.inject(testMessage)
    const received = await response
    expect(received.nodeNumber).to.equal(value.nodeNumber)
    expect(received.name).to.equal("")   // won't get a name for this test
    winston.info({message: 'unit_test: END REQUEST_NODE_NUMBER test'});
  })


  it("REQUEST_BUS_CONNECTION test", async function () {
    winston.info({message: name + ': BEGIN REQUEST_BUS_CONNECTION test '});
    await waitForSocketEvent('BUS_CONNECTION', () => socket.emit('REQUEST_BUS_CONNECTION'))
    winston.info({message: name + ': END REQUEST_BUS_CONNECTION test'});
  })


  function GetTestCase_teach_event() {
    var argA, argB, argC, argD, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {argA = 0}
      if (a == 2) {argA = 1}
      if (a == 3) {argA = 65535}
      for (var b = 1; b<= 3; b++) {
        if (b == 1) {argB = "00000000"}
        if (b == 2) {argB = "00000001"}
        if (b == 3) {argB = "FFFFFFFF"}
        for (var c = 1; c<= 3; c++) {
          if (c == 1) {argC = 0}
          if (c == 2) {argC = 1}
          if (c == 3) {argC = 255}
          for (var d = 1; d<= 3; d++) {
            if (d == 1) {argD = 0}
            if (d == 2) {argD = 1}
            if (d == 3) {argD = 255}
              testCases.push({'nodeNumber':argA, 'eventIdentifier': argB, "eventVariableIndex":argC, "eventVariableValue":argD});
          }
        }
      }
    }
    return testCases;
  }


  itParam("EVENT_TEACH_BY_IDENTIFIER test ${JSON.stringify(value)}", GetTestCase_teach_event(), async function (value) {
    winston.info({message: 'unit_test: BEGIN EVENT_TEACH_BY_IDENTIFIER test '});
    mock_messageRouter.messagesIn = []
    node.nodeConfig.nodes = {}          // start with clean slate
    var data = {"nodeNumber": value.nodeNumber,
      "eventIdentifier": value.eventIdentifier,
      "eventVariableIndex": value.eventVariableIndex,
      "eventVariableValue": value.eventVariableValue
    }
    node.updateEventInNodeConfig(value.nodeNumber, value.eventIdentifier, 1)
    socket.emit('EVENT_TEACH_BY_IDENTIFIER', data)
    await waitForSocketBarrier()
    await waitForCBUSMessages(4)
    for (let i = 0; i < mock_messageRouter.messagesIn.length; i++) {
      winston.info({message: 'unit_test: messagesIn ' + JSON.stringify(mock_messageRouter.messagesIn[i])});
    }
    expect(mock_messageRouter.messagesIn[0].mnemonic).to.equal("NNLRN")
    expect(mock_messageRouter.messagesIn[1].mnemonic).to.equal("EVLRN")
    expect(mock_messageRouter.messagesIn[2].mnemonic).to.equal("NNULN")
    expect(mock_messageRouter.messagesIn[3].mnemonic).to.equal("REVAL")
    winston.info({message: 'unit_test: END EVENT_TEACH_BY_IDENTIFIER test'});
  })

  //
  //
  it("SAVE_SETTING test", async function () {
    winston.info({message: 'unit_test: BEGIN SAVE_SETTING test '});
    //
    socket.emit('SAVE_SETTING',{"lastUsedExportFolder":"xxxx"})
    await waitForSocketBarrier()
    expect(config.appSettings.lastUsedExportFolder).to.equal("xxxx")
    winston.info({message: 'unit_test: END SAVE_SETTING test'});
  })

  //
  //
  it("REQUEST_FIRMWARE_INFO test", async function () {
    winston.info({message: name + ': BEGIN REQUEST_FIRMWARE_INFO test '});
    let filename = './unit_tests/test_firmware/CANACC5_v2v.hex'
    winston.info({message: 'UNIT_TEST: REQUEST_FIRMWARE_INFO test: Filename: ' + filename});
    var intelHexString = fs.readFileSync(filename);
    //    
    const returnData = await waitForSocketEvent('FIRMWARE_INFO', () => {
      socket.emit('REQUEST_FIRMWARE_INFO', intelHexString)
    })
    winston.info({message: name + `: data ${JSON.stringify(returnData)}`});
    expect (returnData.valid).to.equal(true)
    expect (returnData.moduleID).to.equal(2)
    expect (returnData.targetCpuType).to.equal(1)
    winston.info({message: name + ': END REQUEST_FIRMWARE_INFO test'});
  })



  //
  //
  it("REQUEST_LIST_OF_BACKUPS_FOR_ALL_NODES test", async function () {
    winston.info({message: name + ': BEGIN REQUEST_LIST_OF_BACKUPS_FOR_ALL_NODES test '});
    const returnData = await waitForSocketEvent('LIST_OF_BACKUPS_FOR_ALL_NODES', () => {
      socket.emit('REQUEST_LIST_OF_BACKUPS_FOR_ALL_NODES', {"layoutName":'test_backup_layout'})
    })
    winston.info({message: name + `: data ${JSON.stringify(returnData)}`});
    winston.info({message: name + ': END REQUEST_LIST_OF_BACKUPS_FOR_ALL_NODES test'});
  })


  //
  //
  it("REQUEST_LOG_FILE test", async function () {
    winston.info({message: name + ': BEGIN REQUEST_LOG_FILE test '});
    let targetData = {fileName:"bustraffic.txt"}
    const data = await waitForSocketEvent('LOG_FILE', () => socket.emit('REQUEST_LOG_FILE', targetData))
    const text = atob(data.logFile)
    expect (text.length).to.be.above(0)
    winston.info({message: name + ': END REQUEST_LOG_FILE test'});
  })

  describe('management command completion', function() {
    it('DELETE_ALL_EVENTS awaits deletion and refresh', async function() {
      const calls = []
      await withStubs([
        [node, 'delete_all_events', async () => calls.push('delete')],
        [node, 'removeNodeEvents', () => calls.push('remove')],
        [node, 'request_all_node_events', async () => calls.push('refresh')]
      ], async () => {
        const response = await emitWithAck('DELETE_ALL_EVENTS', {nodeNumber: 42})
        expect(response).to.deep.equal({success: true})
        expect(calls).to.deep.equal(['delete', 'remove', 'refresh'])
      })
    })

    it('DELETE_ALL_EVENTS reports rejected deletion', async function() {
      await withStubs([
        [node, 'delete_all_events', async () => { throw new Error('delete failed') }]
      ], async () => {
        const response = await emitWithAck('DELETE_ALL_EVENTS', {nodeNumber: 42})
        expect(response).to.deep.equal({success: false, error: 'delete failed'})
      })
    })

    it('EVENT_TEACH_BY_INDEX awaits teaching and linked-variable reads', async function() {
      const calls = []
      await withStubs([
        [node, 'event_teach_by_index', async () => calls.push('teach')],
        [node, 'requestEventVariableByIndex', async (nodeNumber, eventIndex, variableIndex) => calls.push(`read:${variableIndex}`)]
      ], async () => {
        const response = await emitWithAck('EVENT_TEACH_BY_INDEX', {
          nodeNumber: 42,
          eventIdentifier: '00000001',
          eventIndex: 3,
          eventVariableIndex: 1,
          eventVariableValue: 2,
          linkedVariableList: [4, 5]
        })
        expect(response).to.deep.equal({success: true})
        expect(calls).to.deep.equal(['teach', 'read:4', 'read:5'])
      })
    })

    it('EVENT_TEACH_BY_INDEX reports rejected teaching', async function() {
      await withStubs([
        [node, 'event_teach_by_index', async () => { throw new Error('teach failed') }]
      ], async () => {
        const response = await emitWithAck('EVENT_TEACH_BY_INDEX', {nodeNumber: 42})
        expect(response).to.deep.equal({success: false, error: 'teach failed'})
      })
    })

    it('PROGRAM_NODE acknowledges only after post-programming work', async function() {
      const calls = []
      sleepForTest = async (milliseconds) => calls.push(`sleep:${milliseconds}`)
      await withStubs([
        [programNode, 'program', async () => calls.push('program')],
        [node, 'createNodeConfig', () => calls.push('createConfig')],
        [node, 'set_FCU_compatibility', () => calls.push('compatibility')],
        [node, 'sendRQNPN', () => calls.push('parameters')],
        [node, 'sendRQEVN', () => calls.push('events')]
      ], async () => {
        const response = await emitWithAck('PROGRAM_NODE', {nodeNumber: 42})
        expect(response).to.deep.equal({success: true})
        expect(calls).to.deep.equal([
          'program',
          'createConfig',
          'sleep:5000',
          'compatibility',
          'parameters',
          'events'
        ])
      })
    })

    it('PROGRAM_NODE reports programming failure without post-processing', async function() {
      const calls = []
      await withStubs([
        [programNode, 'program', async () => { throw new Error('program failed') }],
        [node, 'createNodeConfig', () => calls.push('createConfig')]
      ], async () => {
        const response = await emitWithAck('PROGRAM_NODE', {nodeNumber: 42})
        expect(response).to.deep.equal({success: false, error: 'program failed'})
        expect(calls).to.deep.equal([])
      })
    })

    it('PROGRAM_NODE rejects overlap and accepts a later request', async function() {
      let releaseProgramming
      let signalStarted
      const started = new Promise((resolve) => { signalStarted = resolve })
      const blocked = new Promise((resolve) => { releaseProgramming = resolve })
      let programmingCalls = 0
      await withStubs([
        [programNode, 'program', async () => {
          programmingCalls += 1
          if (programmingCalls == 1) {
            signalStarted()
            await blocked
          }
        }],
        [node, 'createNodeConfig', () => {}],
        [node, 'set_FCU_compatibility', () => {}],
        [node, 'sendRQNPN', () => {}],
        [node, 'sendRQEVN', () => {}]
      ], async () => {
        const firstResponse = emitWithAck('PROGRAM_NODE', {nodeNumber: 42})
        await started

        const overlappingResponse = await emitWithAck('PROGRAM_NODE', {nodeNumber: 43})
        expect(overlappingResponse).to.deep.equal({
          success: false,
          error: 'Node programming is already in progress'
        })

        releaseProgramming()
        expect(await firstResponse).to.deep.equal({success: true})
        expect(await emitWithAck('PROGRAM_NODE', {nodeNumber: 44})).to.deep.equal({success: true})
        expect(programmingCalls).to.equal(2)
      })
    })

    it('REMOVE_EVENT awaits unlearning and event refresh', async function() {
      const calls = []
      await withStubs([
        [node, 'event_unlearn', async () => calls.push('unlearn')],
        [node, 'removeNodeEvent', () => calls.push('remove')],
        [node, 'request_all_node_events', async () => calls.push('refresh')]
      ], async () => {
        const response = await emitWithAck('REMOVE_EVENT', {nodeNumber: 42, eventName: 'event'})
        expect(response).to.deep.equal({success: true})
        expect(calls).to.deep.equal(['unlearn', 'remove', 'refresh'])
      })
    })

    it('REMOVE_EVENT reports rejected unlearning', async function() {
      await withStubs([
        [node, 'event_unlearn', async () => { throw new Error('unlearn failed') }]
      ], async () => {
        const response = await emitWithAck('REMOVE_EVENT', {nodeNumber: 42, eventName: 'event'})
        expect(response).to.deep.equal({success: false, error: 'unlearn failed'})
      })
    })

    for (const request of [
      ['REQUEST_ALL_EVENT_VARIABLES_FOR_NODE', 'requestAllEventVariablesForNode'],
      ['REQUEST_ALL_NODE_PARAMETERS', 'request_all_node_parameters'],
      ['REQUEST_ALL_NODE_VARIABLES', 'request_all_node_variables']
    ]) {
      const [eventName, methodName] = request

      it(`${eventName} awaits successful completion`, async function() {
        const calls = []
        await withStubs([
          [node, methodName, async (nodeNumber) => calls.push(nodeNumber)]
        ], async () => {
          const response = await emitWithAck(eventName, {nodeNumber: 42})
          expect(response).to.deep.equal({success: true})
          expect(calls).to.deep.equal([42])
        })
      })

      it(`${eventName} reports rejected requests`, async function() {
        await withStubs([
          [node, methodName, async () => { throw new Error('request failed') }]
        ], async () => {
          const response = await emitWithAck(eventName, {nodeNumber: 42})
          expect(response).to.deep.equal({success: false, error: 'request failed'})
        })
      })
    }

    it('SAVE_LOGS_ARCHIVE awaits archive completion', async function() {
      const calls = []
      await withStubs([
        [config, 'archiveLogs', async () => calls.push('archive')]
      ], async () => {
        const response = await emitWithAck('SAVE_LOGS_ARCHIVE')
        expect(response).to.deep.equal({success: true})
        expect(calls).to.deep.equal(['archive'])
      })
    })

    it('SAVE_LOGS_ARCHIVE reports archive failure', async function() {
      await withStubs([
        [config, 'archiveLogs', async () => { throw new Error('archive failed') }]
      ], async () => {
        const response = await emitWithAck('SAVE_LOGS_ARCHIVE')
        expect(response).to.deep.equal({success: false, error: 'archive failed'})
      })
    })

    it('START_CONNECTION awaits router and node initialization', async function() {
      const calls = []
      status.busConnection.state = true
      status.mode = 'STARTUP'
      await withStubs([
        [mock_messageRouter, 'connect', async () => calls.push('router')],
        [node, 'onConnect', async () => calls.push('node')]
      ], async () => {
        const response = await emitWithAck('START_CONNECTION', {mode: 'Network', host: 'localhost', hostPort: 5550})
        expect(response).to.deep.equal({success: true, status: true})
        expect(calls).to.deep.equal(['router', 'node'])
        expect(status.mode).to.equal('RUNNING')
      })
    })

    it('START_CONNECTION reports connection failure and does not initialize the node', async function() {
      const calls = []
      status.busConnection.state = true
      status.mode = 'STARTUP'
      await withStubs([
        [mock_messageRouter, 'connect', async () => { throw new Error('connection failed') }],
        [node, 'onConnect', async () => calls.push('node')]
      ], async () => {
        const response = await emitWithAck('START_CONNECTION', {mode: 'Network', host: 'localhost', hostPort: 5550})
        expect(response).to.deep.equal({success: false, error: 'connection failed'})
        expect(calls).to.deep.equal([])
        expect(status.mode).to.equal('STARTUP')
      })
    })

    it('START_CONNECTION rejects an overlapping attempt', async function() {
      let releaseConnection
      let signalStarted
      const started = new Promise((resolve) => { signalStarted = resolve })
      const blocked = new Promise((resolve) => { releaseConnection = resolve })
      status.busConnection.state = true
      status.mode = 'STARTUP'
      await withStubs([
        [mock_messageRouter, 'connect', async () => {
          signalStarted()
          await blocked
        }],
        [node, 'onConnect', async () => {}]
      ], async () => {
        const firstResponse = emitWithAck('START_CONNECTION', {mode: 'Network', host: 'localhost', hostPort: 5550})
        await started

        const overlappingResponse = await emitWithAck('START_CONNECTION', {mode: 'Network', host: 'localhost', hostPort: 5550})
        expect(overlappingResponse).to.deep.equal({
          success: false,
          error: 'A connection attempt is already in progress'
        })

        releaseConnection()
        expect(await firstResponse).to.deep.equal({success: true, status: true})
      })
    })

    it('STOP_SERVER archives logs before invoking the injected exit', async function() {
      const calls = []
      exitProcess = () => calls.push('exit')
      await withStubs([
        [config, 'archiveLogs', async () => calls.push('archive')]
      ], async () => {
        const response = await emitWithAck('STOP_SERVER')
        expect(response).to.deep.equal({success: true})
        expect(calls).to.deep.equal(['archive', 'exit'])
      })
    })

    it('STOP_SERVER reports archive failure without exiting', async function() {
      const calls = []
      exitProcess = () => calls.push('exit')
      await withStubs([
        [config, 'archiveLogs', async () => { throw new Error('archive failed') }]
      ], async () => {
        const response = await emitWithAck('STOP_SERVER')
        expect(response).to.deep.equal({success: false, error: 'archive failed'})
        expect(calls).to.deep.equal([])
      })
    })

    it('UPDATE_LAYOUT_DATA awaits persistence before updating and emitting', async function() {
      const calls = []
      const layoutData = {nodeDetails: {42: {}}}
      await withStubs([
        [config, 'writeLayoutData', async () => calls.push('write')],
        [config, 'readLayoutData', () => {
          calls.push('read')
          return layoutData
        }],
        [node, 'addLayoutNodes', () => calls.push('add')]
      ], async () => {
        const emittedLayout = waitForSocketEvent('LAYOUT_DATA', () => {})
        const response = await emitWithAck('UPDATE_LAYOUT_DATA', layoutData)
        expect(response).to.deep.equal({success: true})
        expect(await emittedLayout).to.deep.equal(layoutData)
        expect(calls).to.deep.equal(['write', 'read', 'add'])
      })
    })

    it('UPDATE_LAYOUT_DATA reports persistence failure without updating nodes', async function() {
      const calls = []
      await withStubs([
        [config, 'writeLayoutData', async () => { throw new Error('write failed') }],
        [node, 'addLayoutNodes', () => calls.push('add')]
      ], async () => {
        const response = await emitWithAck('UPDATE_LAYOUT_DATA', {nodeDetails: {}})
        expect(response).to.deep.equal({success: false, error: 'write failed'})
        expect(calls).to.deep.equal([])
      })
    })
  })





})
