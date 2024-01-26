'use strict';
const winston = require('winston');		// use config from root instance
const fs = require('fs');
const jsonfile = require('jsonfile')


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block sscope (like let), and can't be changed through reassigment or redeclared


//
// Modules are stored in two directories
// module descriptors published in the distribution are found in /VLCB-server/config/modules
// User loaded module descriptors are kept in an OS specific folder
//

const className = "configuration"

class configuration {

  constructor(path) {
    this.config= {}
    this.configPath = path
    this.userConfigPath =""
    //                        0123456789012345678901234567890123456789
		winston.debug({message:  '------------ configuration Constructor - ' + this.configPath});
		this.createDirectory(this.configPath)
    this.createConfigFile(this.configPath)
    this.config = jsonfile.readFileSync(this.configPath + 'config.json')
    // create a user directory
    this.createUserDirectories()
    // also ensure 'layouts' folder exists in user directory
		this.createDirectory(this.userConfigPath + 'layouts/')
    // and default layout exists (creates directory if not there also)
    this.createLayoutFile("default")
    //
  
	}

  // this value set by constructor, so no need for a 'set' method
  // 
  getConfigPath(){ 
    // check if directory exists
    if (fs.existsSync(this.configPath)) {
      winston.info({message: className + `: getConfigPath: ` + this.configPath});
    } else {
      winston.error({message: className + `: getConfigPath: Directory does not exist ` + this.configPath});
    }
    return this.configPath
  }

  //
  //
  getCurrentLayoutFolder(){return this.config.currentLayoutFolder}
  setCurrentLayoutFolder(folder){
    // check folder name not blank, set to default if so...
    if (folder.length == 0) {folder = 'default'}
    this.config.currentLayoutFolder = folder
    // now create current layout folder if it doesn't exist
		if (this.createDirectory(this.userConfigPath + '/layouts/' + this.config.currentLayoutFolder)) {
      // if freshly created, create blank layout file & directory, using folder name as layout name
      this.createLayoutFile(this.config.currentLayoutFolder)
    }
    jsonfile.writeFileSync(this.userConfigPath + 'config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getListOfLayouts(){
    winston.debug({message: className + `: get_layout_list:`});
    var list = fs.readdirSync(this.userConfigPath + '\\layouts\\').filter(function (file) {
      return fs.statSync(this.userConfigPath + '\\layouts\\' +file).isDirectory();
    },(this));
    winston.debug({message: className + `: get_layout_list: ` + list});
    return list
  }

  // reads/writes layoutDetails file from/to current layout folder
  //
  readLayoutDetails(){
    var filePath = this.userConfigPath + '\\layouts\\' + this.config.currentLayoutFolder + "/"
    var file = undefined
    try{
      file = jsonfile.readFileSync(filePath + "layoutDetails.json")
    } catch(e){
      winston.info({message: className + `: readLayoutDetails: Error reading ` + filePath + "layoutDetails.json"});
      this.config.currentLayoutFolder = "default"
      filePath = this.userConfigPath + '\\layouts\\' + this.config.currentLayoutFolder + "/"
      file = jsonfile.readFileSync(filePath + "layoutDetails.json")
    }
    return file
  }
  writeLayoutDetails(data){
    var filePath = this.userConfigPath + '\\layouts\\' + this.config.currentLayoutFolder + "/layoutDetails.json"
    winston.info({message: className + `: writeLayoutDetails: ` + filePath});
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }


  // reads/writes nodeConfig file to/from config folder
  //
  readNodeConfig(){
    var filePath = this.configPath + "/nodeConfig.json"
    return jsonfile.readFileSync(filePath)
  }
  writeNodeConfig(data){
    var filePath = this.configPath + "/nodeConfig.json"
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }

  // reads/writes the module descriptors currently in use for nodes to/from config folder
  //
  readNodeDescriptors(){
    var filePath = this.configPath + "/nodeDescriptors.json"
    return jsonfile.readFileSync(filePath)
  }
  writeNodeDescriptors(data){
    var filePath = this.configPath + "/nodeDescriptors.json"
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }

  // static file, so use fixed location
  //
  readMergConfig(){
    var filePath = "./VLCB-server/config/mergConfig.json"
    return jsonfile.readFileSync(filePath)
  }


  // static file, so use fixed location
  //
  readServiceDefinitions(){
    var filePath = "./VLCB-server/config/Service_Definitions.json"
    return jsonfile.readFileSync(filePath)
  }
  

  // uses two locations
  // first tries the user location (OS dependant)
  // and if not found, tries the fixed system location
  // Must return 'undefined' if file not found
  readModuleDescriptor(filename){
    var moduleDescriptor = undefined
    try{
      // try to read user directory first
      var filePath = this.userConfigPath + "\\modules\\" + filename
      winston.debug({message: className + `: readModuleDescriptor: ` + filePath});
      moduleDescriptor =  jsonfile.readFileSync(filePath)
    } catch(e1){
      try{
        // fall back to project directory if not in user directory
        var filePath = this.configPath + "\\modules\\" + filename
        winston.debug({message: className + `: readModuleDescriptor: ` + filePath});
        moduleDescriptor =  jsonfile.readFileSync(filePath)
      } catch(e2) {
        winston.info({message: className + `: readModuleDescriptor: failed to read ` + filename});
      }
    }
    return moduleDescriptor
  }
  writeModuleDescriptor(data){
    if (data.moduleDescriptorName){
      try {
        // always write to user directory
        winston.info({message: className + ': writeModuleDescriptor ' + data.moduleDescriptorName})
        var filePath = this.userConfigPath + "/modules/" + data.moduleDescriptorName + '.json'
        jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
      } catch(e){
        winston.error({message: className + ': writeModuleDescriptor ' + data.moduleDescriptorName + ' ERROR ' + e})
      }
    } else{
      winston.error({message: className + ': writeModuleDescriptor - no moduleDescriptorName'})
    }
  }

  

  //
  //
  getCbusServerPort(){return this.config.cbusServerPort}
  setCbusServerPort(port){
    this.config.cbusServerPort = port
    jsonfile.writeFileSync(this.configPath + 'config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getJsonServerPort(){return this.config.jsonServerPort}
  setJsonServerPort(port){
    this.config.jsonServerPort = port
    jsonfile.writeFileSync(this.configPath + 'config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getSocketServerPort(){return this.config.socketServerPort}
  setSocketServerPort(port){  
    this.config.socketServerPort = port
    jsonfile.writeFileSync(this.configPath + 'config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getServerAddress(){return this.config.serverAddress}
  setServerAddress(address){  
    this.config.serverAddress = address
    jsonfile.writeFileSync(this.configPath + 'config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }


  // return true if directory freshly created
  // false if it already existed
  createDirectory(directory) {
    var result = false
    // check if directory exists
    if (fs.existsSync(directory)) {
        winston.info({message: className + `: createDirectory: ` + directory + ` Directory exists`});
        result = false
      } else {
        winston.info({message: className + `: createDirectory: ` + directory + ` Directory not found - creating new one`});
        fs.mkdirSync(directory, { recursive: true })
        result = true
    } 
    return result
  }

  createUserDirectories(){
    // create user directories
    const os = require("os");
    const homePath = os.homedir()
    winston.info({message: className + ': Platform: ' + os.platform()});
    winston.info({message: className + ': User home directory: ' + homePath});

    //
    if (os.platform() == "win32"){
      this.userConfigPath = homePath + "\\AppData\\local\\MMC-SERVER"
      this.createDirectory(this.userConfigPath)
    }
    winston.info({message: className + ': VLCB_SERVER User config path: ' + this.userConfigPath});
  }

  // return true if config file freshly created
  // false if it already existed
  createConfigFile(path){
    var result = false
    if (fs.existsSync(path + 'config.json')) {
      winston.debug({message: className + `: config file exists`});
      result = false
    } else {
        winston.debug({message: className + `: config file not found - creating new one`});
        const config = {
          "serverAddress": "localhost",
          "cbusServerPort": 5550,
          "jsonServerPort": 5551,
          "socketServerPort": 5552,
          "currentLayoutFolder": "default"
        }
        this.config = config
        jsonfile.writeFileSync(path + "config.json", config, {spaces: 2, EOL: '\r\n'})
        result = true
    }
    return result
  }

  // return true if default layout freshly created
  // false if it already existed
  createLayoutFile(name){
    var result = false
    var layoutPath = this.userConfigPath + '\\layouts\\' + name + '\\'
    this.createDirectory(layoutPath)
    if (fs.existsSync(layoutPath + 'layoutDetails.json')) {
      winston.debug({message: className + `: layoutDetails file exists`});
      result = false
    } else {
        winston.debug({message: className + `: config file not found - creating new one`});
        const layoutDetails = {
          "layoutDetails": {
            "title": name + " layout",
            "subTitle": "layout auto created",
            "nextNodeId": 800
          },
          "nodeDetails": {},
          "eventDetails": {}
          }
        jsonfile.writeFileSync(layoutPath + 'layoutDetails.json', layoutDetails, {spaces: 2, EOL: '\r\n'})
        result = true
    }
    return result
  }

}


module.exports = ( path ) => { return new configuration(path) }
