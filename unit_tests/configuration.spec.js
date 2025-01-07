const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: configuration.spec.js'});
const expect = require('chai').expect;
const itParam = require('mocha-param');
const fs = require('fs');
const jsonfile = require('jsonfile')
var path = require('path');
const utils = require('../VLCB-server/utilities.js');


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

config.singleUserDirectory = testUserConfigPath
config.currentUserDirectory = config.singleUserDirectory

async function createTestFiles(){
  var testContent = {"timestamp":Date.now()}

  // ensure the following files exist
  //                            System:  User:   tests
  // MDFTEST-YYYY-1a--P11.json      Y       Y     select from user, version case, processor
  // MDFTEST-YYYY-1b.json           Y       Y     select from user, version case, no processor
  // MDFTEST-YYYY-1c--p11.json      N       Y     select from user, version case, processor case
  // MDFTEST-YYYY-2a.json           Y       N     select from system, version case, no processor
  // MDFTEST-YYYY-2a--p11.json      Y       N     select from system, version case, processor case
  //

  // ensure 'system' modules directory exists
  config.createDirectory(path.join(config.systemDirectory, "modules"))
  // write test files
  testFilePath = path.join(config.systemDirectory, "modules", "MDFTEST-YYYY-1a--P11.json")
  jsonfile.writeFileSync(testFilePath, testContent)
  testFilePath = path.join(config.systemDirectory, "modules", "MDFTEST-YYYY-1b.json")
  jsonfile.writeFileSync(testFilePath, testContent)
  testFilePath = path.join(config.systemDirectory, "modules", "MDFTEST-YYYY-2a.json")
  jsonfile.writeFileSync(testFilePath, testContent)
  testFilePath = path.join(config.systemDirectory, "modules", "MDFTEST-YYYY-2a--p11.json")
  jsonfile.writeFileSync(testFilePath, testContent)

  // ensure 'user' modules directory exists
  config.createDirectory(path.join(config.singleUserDirectory, "modules"))
  // write test files
  testFilePath = path.join(config.singleUserDirectory, "modules", "MDFTEST-YYYY-1a--P11.json")
  jsonfile.writeFileSync(testFilePath, testContent)
  testFilePath = path.join(config.singleUserDirectory, "modules", "MDFTEST-YYYY-1b.json")
  jsonfile.writeFileSync(testFilePath, testContent)
  testFilePath = path.join(config.singleUserDirectory, "modules", "MDFTEST-YYYY-1c--p11.json")
  jsonfile.writeFileSync(testFilePath, testContent)
}

describe('configuration tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '================================================================================'});
    //                      12345678901234567890123456789012345678900987654321098765432109876543210987654321
		winston.info({message: '------------------------------ configuration tests ------------------------------'});
		winston.info({message: '================================================================================'});
		winston.info({message: ' '});
    //
    createTestFiles()
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
    config.currentUserDirectory = testUserConfigPath
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
  // ensure test 'user' module folder exists
  // ensure test file is deleted
  // write module - should be written to test 'user' module folder
  // read file & check it contains the written data
  //
  it("writeModuleDescriptor test", function (done) {
    winston.info({message: 'unit_test: BEGIN writeModuleDescriptor test '})
    // ensure 'user' modules directory exists
    config.currentUserDirectory = testUserConfigPath
    config.createDirectory(path.join(config.currentUserDirectory, "modules"))
    var testFilePath = path.join(config.currentUserDirectory, "modules", "writeTest.json")
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
  //
  //
  it("getModuleDescriptorFileList test", function (done) {
    winston.info({message: 'unit_test: BEGIN getModuleDescriptorFileList test '})
    //
    winston.info({message: 'currentUserDirectory: ' + config.currentUserDirectory})
    var result = config.getModuleDescriptorFileList("YYYY")
    setTimeout(function(){
      winston.info({message: 'result: ' + JSON.stringify(result)})
      expect (result.length).to.be.equal(3)
      winston.info({message: 'unit_test: END getModuleDescriptorFileList test'})
        done();
		}, 50);
  })


  function GetTestCase_getMatchingMDFList() {
    var arg1, arg2, testCases = [];
    for (var a = 1; a<= 2; a++) {
      if (a == 1) {arg1 = "system"}
      if (a == 2) {arg1 = "user"}
      testCases.push({'location':arg1});
    }
    return testCases;
  }


  //
  // Relies on at least 3 files already written to system module folder
  // There could be more files due to other tests
  //
  itParam("getMatchingMDFList test ${JSON.stringify(value)}", GetTestCase_getMatchingMDFList(), async function (value) {
    winston.info({message: 'unit_test: BEGIN getMatchingMDFList test ' + JSON.stringify(value)})
    //
    var result = config.getMatchingMDFList(value.location, "MDFTEST-YYYY")
    winston.info({message: 'result: ' + JSON.stringify(result)})
    expect (result.length).to.be.above(0)
    winston.info({message: 'unit_test: END getMatchingMDFList test'})
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


  // ensure the following files exist - created at beginning of module
  //                            System:  User:   tests
  // MDFTEST-YYYY-1a--p11.json      Y       Y     select from user, version case, processor
  // MDFTEST-YYYY-1b.json           Y       Y     select from user, version case, no processor
  // MDFTEST-YYYY-1c--p11.json      N       Y     select from user, version case, processor case
  // MDFTEST-YYYY-2a.json           Y       N     select from system, version case, no processor
  // MDFTEST-YYYY-2a--p11.json      Y       N     select from system, version case, processor case
  //


  function GetTestCase_MDF() {
    var arg1, arg2, arg3, arg4, arg5, testCases = [];
    for (var a = 1; a<= 7; a++) {
      // complete match
      if (a == 1) {arg1 = "YYYY", arg2 = "1a", arg3 = "P11", arg4 = "MDFTEST-YYYY-1a--P11.json", arg5 = "USER"}
      // filename, no processorType
      if (a == 2) {arg1 = "YYYY", arg2 = "1b", arg3 = "", arg4 = "MDFTEST-YYYY-1b.json", arg5 = "USER"}
      // filename, no processorType - version case wrong
      if (a == 3) {arg1 = "YYYY", arg2 = "1B", arg3 = "P13", arg4 = "MDFTEST-YYYY-1b.json", arg5 = "USER"}
      // processor type lower case processor
      if (a == 4) {arg1 = "YYYY", arg2 = "1c", arg3 = "P11", arg4 = "MDFTEST-YYYY-1c--p11.json", arg5 = "USER"}
      // processor type lower case p - version case wrong
      if (a == 4) {arg1 = "YYYY", arg2 = "1C", arg3 = "P11", arg4 = "MDFTEST-YYYY-1c--p11.json", arg5 = "USER"}
      // processor type lower case p - version case wrong, system only
      if (a == 5) {arg1 = "YYYY", arg2 = "2A", arg3 = "P11", arg4 = "MDFTEST-YYYY-2a--p11.json", arg5 = "SYSTEM"}
      // wrong processor type, system only
      if (a == 6) {arg1 = "YYYY", arg2 = "2a", arg3 = "P31", arg4 = "MDFTEST-YYYY-2a.json", arg5 = "SYSTEM"}
      // no file found
      if (a == 7) {arg1 = "YYYY", arg2 = "9u", arg3 = "P13", arg4 = undefined}
      testCases.push({'moduleIdentifier':arg1, 'version':arg2, 'processorType':arg3, 'result':arg4, "location":arg5});
    }
    return testCases;
  }

/*
  //
  itParam("getMatchingModuleDescriptorFileOLD test ${JSON.stringify(value)}", GetTestCase_MDF(), async function (value) {
    winston.info({message: 'unit_test: BEGIN getMatchingModuleDescriptorFileOLD test '});

    result = config.getMatchingModuleDescriptorFileOLD(value.moduleIdentifier, value.version, value.processorType);
    winston.info({message: 'result: ' + result});
    expect(result).to.equal(value.result);
    winston.info({message: 'unit_test: END getMatchingModuleDescriptorFileOLD test'});
  })
*/

  //
  itParam("getMatchingModuleDescriptorFile test ${JSON.stringify(value)}", GetTestCase_MDF(), async function (value) {
    winston.info({message: 'unit_test: BEGIN getMatchingModuleDescriptorFile test ' + JSON.stringify(value)});

    result = config.getMatchingModuleDescriptorFile(value.moduleIdentifier, value.version, value.processorType);
    winston.info({message: 'result: ' + JSON.stringify(result)})
    if (value.result != undefined){
      expect(result.moduleDescriptorFilename).to.equal(value.result)
      expect(result.moduleDescriptorLocation).to.equal(value.location)
    } else {
      // not expecting a result for this test
      expect(result).to.equal(undefined)
    }
    winston.info({message: 'unit_test: END getMatchingModuleDescriptorFile test'})
  })


})