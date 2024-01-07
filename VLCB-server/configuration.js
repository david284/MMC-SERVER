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


class configuration {

  constructor(path) {
    this.config= {}
    this.configPath = path
		//                        0123456789012345678901234567890123456789
		winston.debug({message:  '------------ configuration Constructor - ' + this.configPath});
		this.createDirectory(this.configPath)
    this.createConfigFile(this.configPath)
    this.config = jsonfile.readFileSync(this.configPath + 'config.json')
    // also ensure 'layouts' folder exists
		this.createDirectory(this.configPath + 'layouts/')
    // and default layout exists (creates directory if not there also)
    this.createLayoutFile("default")
	}

  // this value set by constructor, so no need for a 'set' method
  // 
  getConfigPath(){ 
    // check if directory exists
    if (fs.existsSync(this.configPath)) {
      winston.info({message: `configuration: getConfigPath: ` + this.configPath});
    } else {
      winston.error({message: `configuration: getConfigPath: Directory does not exist ` + this.configPath});
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
		if (this.createDirectory(this.configPath + 'layouts/' + this.config.currentLayoutFolder)) {
      // if freshly created, create blank layout file & directory, using folder name as layout name
      this.createLayoutFile(this.config.currentLayoutFolder)
    }
    jsonfile.writeFileSync(this.configPath + 'config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getListOfLayouts(){
    winston.debug({message: `configuration: get_layout_list:`});
    var list = fs.readdirSync(this.configPath + 'layouts/').filter(function (file) {
      return fs.statSync(this.configPath + 'layouts/' +file).isDirectory();
    },(this));
    winston.debug({message: `configuration: get_layout_list: ` + list});
    return list
  }

  // reads/writes layoutDetails file from/to current layout folder
  //
  readLayoutDetails(){
    var filePath = this.configPath + 'layouts/' + this.config.currentLayoutFolder + "/"
    return jsonfile.readFileSync(filePath + "layoutDetails.json")
  }
  writeLayoutDetails(data){
    var filePath = this.configPath + 'layouts/' + this.config.currentLayoutFolder + "/layoutDetails.json"
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
  

  // static file, so use fixed location
  //
  readModuleDescriptor(filename){
    var filePath = "./VLCB-server/config/modules/" + filename
    return jsonfile.readFileSync(filePath)
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
        winston.info({message: `socketServer: checkLayoutExists: ` + directory + ` Directory exists`});
        result = false
      } else {
        winston.info({message: `socketServer: checkLayoutExists: ` + directory + ` Directory not found - creating new one`});
        fs.mkdirSync(directory, { recursive: true })
        result = true
    } 
    return result
  }

  // return true if config file freshly created
  // false if it already existed
  createConfigFile(path){
    var result = false
    if (fs.existsSync(path + 'config.json')) {
      winston.debug({message: `configuration: config file exists`});
      result = false
    } else {
        winston.debug({message: `configuration: config file not found - creating new one`});
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
    var layoutPath = this.configPath + 'layouts/' + name + '/'
    this.createDirectory(layoutPath)
    if (fs.existsSync(layoutPath + 'layoutDetails.json')) {
      winston.debug({message: `configuration: layoutDetails file exists`});
      result = false
    } else {
        winston.debug({message: `configuration: config file not found - creating new one`});
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



//module.exports = new configuration();
module.exports = ( path ) => { return new configuration(path) }
//module.exports = new configuration(path)
