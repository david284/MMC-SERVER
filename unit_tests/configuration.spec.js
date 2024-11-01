const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: configuration.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');
const fs = require('fs');
const jsonfile = require('jsonfile')
var path = require('path');

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared

const testSystemConfigPath = "./unit_tests/test_output/config"
const testUserConfigPath = "./unit_tests/test_output/test_user"

// delete existing configs..
winston.info({message: 'Deleting output path ' + testSystemConfigPath});
fs.rmSync(path.join(testSystemConfigPath, "config.json"), { recursive: true, force: true });
winston.info({message: 'Deleting test modules ' + testSystemConfigPath});
fs.rmSync(path.join(testSystemConfigPath, 'modules'), { recursive: true, force: true });
winston.info({message: 'Deleting user path ' + testUserConfigPath});
fs.rmSync(path.join(testUserConfigPath), { recursive: true, force: true });

const config = require('../VLCB-server/configuration.js')(testSystemConfigPath, testUserConfigPath)

describe('configuration tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ configuration tests ------------------------------'});
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
  // test backup - does both read & write
  //
  it("Backup test", function (done) {
    winston.info({message: 'unit_test: BEGIN Backup test '})
    var layoutName = 'test_backup_layout'
    var nodeConfig = {config: 1}
    var layoutData = {layout: 1} 
    var timestamp = Date.now()
    var fileName = "backup_" + timestamp
    layoutData["verification"] =  timestamp
    config.writeBackup(layoutName, fileName, layoutData, nodeConfig)
    var result = config.readBackup(layoutName, fileName)
    var list = config.getListOfBackups(layoutName)
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      winston.info({message: 'unit_test: END Backup test'})
      expect(result).to.have.property('systemConfig')
      expect(result).to.have.property('nodeConfig')
      expect(JSON.stringify(result.layoutData)).to.equal(JSON.stringify(layoutData));
      expect(result.layoutData.verification).to.equal(timestamp);
      expect (list).to.include(fileName)
      done();
		}, 50);
  })


  //
  // test writeBusTraffic
  //
  it("writeBusTraffic test", function (done) {
    winston.info({message: 'unit_test: BEGIN writeBusTraffic test '})
    config.writeBusTraffic("test data 1")
    config.writeBusTraffic("test data 2")
    config.writeBusTraffic("test data 3")
    setTimeout(function(){
      done();
      winston.info({message: 'unit_test: END writeBusTraffic test '})
		}, 50);
  })


  //
  // test createDirectory
  //
  it("createDirectory test", function (done) {
    winston.info({message: 'unit_test: BEGIN createDirectory test '})
    var layout = 'test_createDirectory_' + Date.now()
    config.createDirectory(path.join(testUserConfigPath, 'layouts', layout) )
    var layout_list = config.getListOfLayouts()
    setTimeout(function(){
      winston.info({message: 'layout_list: ' + JSON.stringify(layout_list)})
      expect(layout_list).to.include(layout)
      done();
		}, 50);
  })

  //
  it("currentLayoutFolder test", function () {
    winston.info({message: 'unit_test: BEGIN currentLayoutFolder test '})
    var layout = 'test_currentLayout_' + Date.now()
    result = config.setCurrentLayoutFolder(layout)
    winston.info({message: 'result: ' + config.getCurrentLayoutFolder()})
    expect(config.getCurrentLayoutFolder()).to.equal(layout)
    winston.info({message: 'unit_test: END currentLayoutFolder test'})
  })



  //
  it("eventBus test", function (done) {
    winston.info({message: 'unit_test: BEGIN eventBus test '});
    var result = false
    config.eventBus.once('test', function () {
      result = true
    })
    config.eventBus.emit('test')
    setTimeout(function(){
      winston.info({message: 'result: ' + result})
      expect(result).to.equal(true);
      winston.info({message: 'unit_test: END test test'})
        done();
		}, 50);
  })


  //
  it("configPath test", function () {
    winston.info({message: 'unit_test: BEGIN configPath test '});
    result = config.getConfigPath();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(testSystemConfigPath);
    winston.info({message: 'unit_test: END configPath test'});
  })


  //
  it("readLayoutData", function (done) {
    winston.info({message: 'unit_test: BEGIN readLayoutData test '})
    result = config.readLayoutData()
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      expect(result).to.have.property('layoutDetails')
      winston.info({message: 'unit_test: END readLayoutData test'})
        done();
		}, 50);
  })

  function GetTestCase_layout() {
    var arg1, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = "write_test1"}
      if (a == 2) {arg1 = "write_test2"}
      if (a == 3) {arg1 = "write_test3"}
      testCases.push({'layout':arg1});
    }
    return testCases;
  }

  //
  itParam("writeLayoutData test ${JSON.stringify(value)}", GetTestCase_layout(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN writeLayoutData test '})
    var data = {
      "layoutDetails": {
        "title": value.layout + " layout",
        "subTitle": "layout auto created",
        "baseNodeNumber": 800
      },
      "nodeDetails": {},
      "eventDetails": {}
    }
    result = config.setCurrentLayoutFolder("write_test")
    config.writeLayoutData(data)
    result = config.readLayoutData()
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      expect(result.layoutDetails.title).to.equal(value.layout + " layout");
      winston.info({message: 'unit_test: END writeLayoutData test'})
        done();
		}, 50);
  })


  function GetTestCase_node(){
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
  itParam("writeNodeConfig test ${JSON.stringify(value)}", GetTestCase_node(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN writeNodeConfig test '})
    var data = {
      "nodes": {
        "301": {
          "nodeNumber": value.nodeNumber
        }
      }
    }
    config.writeNodeConfig(data)
    result = config.readNodeConfig()
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      expect(result.nodes["301"].nodeNumber).to.equal(value.nodeNumber);
      winston.info({message: 'unit_test: END writeNodeConfig test'})
        done();
		}, 50);
  })

  //
  it("readMergConfig test", function (done) {
    winston.info({message: 'unit_test: BEGIN readMergConfig test '})
    var result = config.readMergConfig()
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      expect(result).to.have.property('modules')
      winston.info({message: 'unit_test: END readMergConfig test'})
        done();
		}, 50);
  })


  //
  it("readServiceDefinitions test", function (done) {
    winston.info({message: 'unit_test: BEGIN readServiceDefinitions test '})
    var result = config.readServiceDefinitions()
    setTimeout(function(){
      winston.info({message: 'result length: ' + JSON.stringify(result).length})
      expect(JSON.stringify(result).length).to.be.greaterThan(3)
      winston.info({message: 'unit_test: END readServiceDefinitions test'})
        done();
		}, 50);
  })


  function GetTestCase_readModuleDescriptor() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = "test#1", arg2 = 'pass', arg3 = 1}
      if (a == 2) {arg1 = "test#2", arg2 = 'pass', arg3 = 2}
      if (a == 3) {arg1 = "test#3", arg2 = 'fail', arg3 = 3}
      testCases.push({'file':arg1, 'result':arg2, 'testNumber':arg3});
    }
    return testCases;
  }

  // test Aims
  // add test file #1 to test 'user' module folder
  // retrieve said file & check it's the same
  // add test file #2 to 'system' module folder (but not 'user' folder)
  // retrieve said file & check it's the same
  // attempt to retrieve non-existant file and chek it fails
  //
  itParam("readModuleDescriptor test ${JSON.stringify(value)}", GetTestCase_readModuleDescriptor(), function (done, value) {
    winston.info({message: 'unit_test: BEGIN readModuleDescriptor test ' + JSON.stringify(value)})
    var testPattern = {"testNumber":value.testNumber}
    if (value.testNumber == 1){
      // ensure 'user' modules directory exists
      config.createDirectory(path.join(config.userConfigPath, "modules"))
      jsonfile.writeFileSync(
        path.join(config.userConfigPath, "modules", value.file),
        testPattern,
        {spaces: 2, EOL: '\r\n'})
    }
    if (value.testNumber == 2){
      // ensure 'system' modules directory exists
      config.createDirectory(path.join(config.systemConfigPath, "modules"))
      jsonfile.writeFileSync(
        path.join(config.systemConfigPath, "modules", value.file),
        testPattern,
        {spaces: 2, EOL: '\r\n'})
    }
    var moduleDescriptor = config.readModuleDescriptor(value.file)
    setTimeout(function(){
      if (moduleDescriptor) {
        winston.info({message: 'unit_test: result length: ' + JSON.stringify(moduleDescriptor).length})
        expect(JSON.stringify(moduleDescriptor).length).to.be.greaterThan(3)
        expect(value.result).to.be.equal('pass')
        expect (moduleDescriptor.testNumber).to.be.equal(testPattern.testNumber)
      } else {
        expect(value.result).to.be.equal('fail')
      }
      winston.info({message: 'unit_test: END readModuleDescriptor test'})
      done();
		}, 50);
  })

  // test Aims
  // ensure test 'user' module folder exists
  // ensure test file is deleted
  // write module - should be written to test 'user' module folder
  // read file & check it contains the written data
  //
  it("writeModuleDescriptor test", function (done) {
    winston.info({message: 'unit_test: BEGIN writeModuleDescriptor test '})
    // ensure 'user' modules directory exists
    config.createDirectory(config.userConfigPath + "/modules")
    var testFilePath = config.userConfigPath + "/modules/writeTest.json"
    // delete test file if it already exists
    if (fs.existsSync(testFilePath)){
      fs.unlinkSync(testFilePath)
    }
    // now check it's not there
    if (fs.existsSync(testFilePath)){
      winston.info({message: 'unit_test: ERROR: test file not deleted: test aborted'})
    } else {
      winston.info({message: 'unit_test: test file deleted'})
      // continue with test
      var testPattern = {"test":"writeModuleDescriptor test",
                        "moduleDescriptorFilename":"writeTest.json"}
      config.writeModuleDescriptor(testPattern)
    }
    setTimeout(function(){
      file = jsonfile.readFileSync(testFilePath)
      winston.info({message: 'unit_test: result length: ' + JSON.stringify(file).length})
      expect(JSON.stringify(file).length).to.be.greaterThan(3)
      expect (file.toString()).to.be.equal(testPattern.toString())
      expect (JSON.stringify(file)).to.be.equal(JSON.stringify(testPattern))
      winston.info({message: 'unit_test: file: ' + JSON.stringify(file)})
      winston.info({message: 'unit_test: END writeModuleDescriptor test'})
      done();
		}, 50);
  })

  //
  it("getModuleDescriptorFileList test", function (done) {
    winston.info({message: 'unit_test: BEGIN getModuleDescriptorFileList test '})
    // user files
    var testFilePath = path.join(config.userConfigPath, "modules/CANABC-AAFF-1q.json")
    jsonfile.writeFileSync(testFilePath, "testPattern")
    testFilePath = path.join(config.userConfigPath, "modules/CANABC-BBFF-2q.json")
    jsonfile.writeFileSync(testFilePath, "testPattern")
    // system files
    testFilePath = path.join(config.systemConfigPath, "modules/CAN-ABC-AAFF-3q.json")
    jsonfile.writeFileSync(testFilePath, "testPattern")
    testFilePath = path.join(config.systemConfigPath, "modules/CANABC-CCFF-4q.json")
    jsonfile.writeFileSync(testFilePath, "testPattern")
    //
    var result = config.getModuleDescriptorFileList("AAFF")
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      expect (result.length).to.be.equal(2)
      winston.info({message: 'unit_test: END getModuleDescriptorFileList test'})
        done();
		}, 50);
  })



  //
  it("getLayoutList test ${JSON.stringify(value)}", function () {
    winston.info({message: 'unit_test: BEGIN getLayoutList test '})
    // ensure 'layouts' folder exists in 'test' user directory
		config.createDirectory(config.userConfigPath + '/layouts/')
    result = config.getListOfLayouts()
    winston.info({message: 'result: ' + result})
//    expect(config.getCurrentLayoutFolder()).to.equal(testFolder)
    winston.info({message: 'unit_test: END getLayoutList test'})
  })


  function GetTestCase_port() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 3; a++) {
      if (a == 1) {arg1 = 0}
      if (a == 2) {arg1 = 1}
      if (a == 3) {arg1 = 65535}
      testCases.push({'port':arg1});
    }
    return testCases;
  }

  //
  itParam("cbusServerPort test ${JSON.stringify(value)}", GetTestCase_port(), function (value) {
    winston.info({message: 'unit_test: BEGIN cbusServerPort test '});
    config.setCbusServerPort(value.port);
    result = config.getCbusServerPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.port);
    winston.info({message: 'unit_test: END cbusServerPort test'});
  })

  //
  itParam("jsonServerPort test ${JSON.stringify(value)}", GetTestCase_port(), function (value) {
    winston.info({message: 'unit_test: BEGIN jsonServerPort test '});
    config.setJsonServerPort(value.port);
    result = config.getJsonServerPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.port);
    winston.info({message: 'unit_test: END jsonServerPort test'});
  })

  //
  itParam("socketServerPort test ${JSON.stringify(value)}", GetTestCase_port(), function (value) {
    winston.info({message: 'unit_test: BEGIN socketServerPort test '});
    config.setSocketServerPort(value.port);
    result = config.getSocketServerPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.port);
    winston.info({message: 'unit_test: END socketServerPort test'});
  })

  //
  it("serialPort test}", function () {
    winston.info({message: 'unit_test: BEGIN serialPort test '});
    config.setSerialPort('COM4');
    result = config.getSerialPort();
    winston.info({message: 'result: ' + result});
    expect(result).to.equal('COM4');
    winston.info({message: 'unit_test: END serialPort test'});
  })



})