'use strict';
const winston = require('winston');		// use config from root instance
const fs = require('fs');
const jsonfile = require('jsonfile')
var path = require('path');
const EventEmitter = require('events').EventEmitter;
const name = 'configuration'

// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block sscope (like let), and can't be changed through reassigment or redeclared


//
// Modules are stored in two directories
// module descriptors published in the distribution are found in <this.systemConfigPath>/modules
// ( typically /VLCB-server/config/modules )
// User loaded module descriptors are kept in an OS specific folder
//

const className = "configuration"

const defaultLayoutData = {
  "layoutDetails": {
    "title": "default layout",
    "subTitle": "layout auto created",
    "baseNodeNumber": 256
  },
  "nodeDetails": {},
  "eventDetails": {}
  }

  const busTrafficPath = path.join(__dirname, "..//", "logs", "busTraffic.txt")


  // In normal use, the userConfigPath is NOT supplied - i.e. only supply systemConfigPath
  // the code will create a system specific user directory
  //
  // userConfigPath is intended to be supplied when unit testing
  // to avoid polluting the user directory

class configuration {

  constructor(systemConfigPath, userConfigPath) {
    //                        012345678901234567890123456789987654321098765432109876543210
		winston.debug({message:  '----------------- configuration Constructor ----------------'});
		winston.debug({message:  '--- system path: ' + systemConfigPath});
		winston.debug({message:  '--- user path: ' + userConfigPath});
    this.busTrafficLogStream = fs.createWriteStream(busTrafficPath, {flags: 'a+'});
    this.eventBus = new EventEmitter();
    this.config= {}
    this.systemConfigPath = systemConfigPath
    this.userConfigPath = userConfigPath
    this.userModuleDescriptorFileList = []
    this.systemModuleDescriptorFileList = []
		this.createDirectory(this.systemConfigPath)
    this.createConfigFile(this.systemConfigPath)
    this.config = jsonfile.readFileSync(this.systemConfigPath + '/config.json')
    winston.debug({message:  name + ': config: '+ JSON.stringify(this.config)});
    // create a user directory - will set userConfigPath
    this.createUserDirectory()
    if (this.userConfigPath){
      // also ensure all the expected folders exists in user directory
      this.createDirectory(this.userConfigPath + '/layouts')
      this.createDirectory(this.userConfigPath + '/modules')
      // and default layout exists (creates directory if not there also)
      this.createLayoutFile(defaultLayoutData.layoutDetails.title)
    } 
	}

  // this value set by constructor, so no need for a 'set' method
  // 
  getConfigPath(){ 
    // check if directory exists
    if (fs.existsSync(this.systemConfigPath)) {
      winston.info({message: className + `: getConfigPath: ` + this.systemConfigPath});
    } else {
      winston.error({message: className + `: getConfigPath: Directory does not exist ` + this.systemConfigPath});
    }
    return this.systemConfigPath
  }

  // update current config file
  writeConfig(){
    winston.debug({message: className + ` writeConfig` });
    try{
      jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
    } catch(e){
      winston.info({message: className + `: writeConfig: Error writing config.json`});
    }
  }

  //
  //
  getCurrentLayoutFolder(){return this.config.currentLayoutFolder}
  setCurrentLayoutFolder(folder){
    if (this.userConfigPath){
      // check folder name not blank, set to default if so...
      if (folder == undefined) {folder = defaultLayoutData.layoutDetails.title}
      this.config.currentLayoutFolder = folder
      // now create current layout folder if it doesn't exist
      if (this.createDirectory(this.userConfigPath + '/layouts/' + this.config.currentLayoutFolder)) {
        // if freshly created, create blank layout file & directory, using folder name as layout name
        this.createLayoutFile(this.config.currentLayoutFolder)
      }
      this.writeConfig()
    }
  }


  // update current config file
  readBackup(layoutName, filename){
    winston.info({message: className + ` readBackup ` + filename });
    var filePath = path.join(this.userConfigPath, 'layouts', layoutName, 'backups', filename)
    winston.debug({message: className + ` readBackup: ` + filePath });
    var file = null
    try{
      file = jsonfile.readFileSync(filePath)
    } catch(err){
      winston.info({message: className + `: readBackup: ` + err});
    }
    return file
  }


  // update current config file
  writeBackup(layoutName, fileName, layoutData, nodeConfig){
    winston.info({message: className + ` writeBackup: ` + fileName });
    var backupFolder = path.join(this.userConfigPath, 'layouts', layoutName, 'backups')
    // now create current backup folder if it doesn't exist
    this.createDirectory(backupFolder)
    var filePath = path.join(backupFolder, fileName)
    winston.debug({message: className + ` writeBackup: ` + filePath });
    try{
      var backup = { 
        timestamp: new Date().toISOString(),
        systemConfig: this.config,
        nodeConfig: nodeConfig,
        layoutData: layoutData
      }
      jsonfile.writeFileSync(filePath, backup, {spaces: 2, EOL: '\r\n'})
    } catch(err){
      winston.info({message: className + `: writeBackup: ` + err});
    }
  }

  //
  //
  getListOfBackups(layoutName){
    winston.debug({message: className + `: getListOfBackups:`});
    try{
      if (this.userConfigPath){
        var backupFolder = path.join(this.userConfigPath, 'layouts', layoutName, 'backups')
        if (!fs.existsSync(backupFolder)){
          // doesn't exist, so create
          this.createDirectory(backupFolder)      
        }
        var list = fs.readdirSync(backupFolder).filter(function (file) {
          return fs.statSync(path.join(backupFolder, file)).isFile();
        },(this));
        winston.debug({message: className + `: getListOfBackups: ` + list});
        return list
      }
    } catch (err){
      winston.error({message: className + `: getListOfBackups: ` + err});
    }
  }

  writeBusTraffic(data){
    // use {flags: 'a'} to append and {flags: 'w'} to erase and write a new file
    var time = new Date()
    var timeStamp = String(time.getMinutes()).padStart(2, '0') + ':' 
      + String(time.getSeconds()).padStart(2, '0') + '.' 
      + String(time.getMilliseconds()).padStart(3, '0')
    this.busTrafficLogStream.write(timeStamp + ' ' + data + "\r\n");
  }

  //
  //
  getListOfLayouts(){
    winston.debug({message: className + `: get_layout_list:`});
    if (this.userConfigPath){
      var list = fs.readdirSync(this.userConfigPath + '/layouts/').filter(function (file) {
        return fs.statSync(this.userConfigPath + '/layouts/' +file).isDirectory();
      },(this));
      winston.debug({message: className + `: get_layout_list: ` + list});
      return list
    }
  }
  deleteLayoutFolder(folder){
    winston.info({message: className + `: deleteLayoutFolder: ` + folder});
    try {
      if (this.userConfigPath){
        // check folder name not blank
        if (folder != undefined) {
          var folderPath = path.join(this.userConfigPath, '/layouts/', folder )
          fs.rmSync(folderPath, { recursive: true }) 
        }
        this.writeConfig()
      }
    } catch (err) {
      winston.error({message: className + ': deleteLayoutFolder: ' + err});
    }
  }




  // reads/writes layoutDetails file from/to current layout folder
  //
  readLayoutData(){
    var file = defaultLayoutData // preload with default in case read fails
    // does folder exist?
    if (this.config.currentLayoutFolder == undefined) {
      winston.info({message: className + `: readLayoutData: currentLayoutFolder undefined`});
      this.config.currentLayoutFolder = defaultLayoutData.layoutDetails.title
      this.writeConfig()
    }
    if(this.userConfigPath){
      var filePath = path.join( this.userConfigPath, "layouts", this.config.currentLayoutFolder)
      // does layoutData filse exist?
      if (!fs.existsSync(path.join(filePath, "layoutData.json"))){
        // doesn't exist, so create
        this.createLayoutFile(this.config.currentLayoutFolder)
      }
      // ok, folder & file should now exist - read it
      try{
        winston.info({message: className + `: readLayoutData: reading ` + path.join(filePath, "layoutData.json")});
        file = jsonfile.readFileSync(path.join(filePath, "layoutData.json"))
      } catch(e){
        winston.info({message: className + `: readLayoutData: Error reading ` + path.join(filePath, "layoutData.json")});
        // couldn't read the layout, so get the default layout instead...
        this.config.currentLayoutFolder = defaultLayoutData.layoutDetails.title
        this.writeConfig()
        filePath = path.join(this.userConfigPath, 'layouts', this.config.currentLayoutFolder)
        try {
          winston.info({message: className + `: readLayoutData: reading ` + path.join(filePath, "layoutData.json")});
          file = jsonfile.readFileSync(path.join(filePath, "layoutData.json"))
        } catch(e){
          // ok, totally failed, so load with defaults
          winston.info({message: className + `: readLayoutData: Error reading ` + path.join(filePath, "layoutData.json")});
          winston.info({message: className + `: readLayoutData: defaults loaded`});
          file = defaultLayoutData
        }
      }
    }
    if (file.layoutDetails == undefined){
      // essential element missing, so rebuild data
      file["layoutDetails"] = defaultLayoutData.layoutDetails
      file.layoutDetails.title = this.config.currentLayoutFolder
      file.layoutDetails.subTitle = "rebuilt data"
      file["eventDetails"] = {}
      file["nodeDetails"] = {}
    }
    return file
  }
  
  writeLayoutData(data){
    try{
      if(this.userConfigPath){
        var filePath = this.userConfigPath + '/layouts/' + this.config.currentLayoutFolder + "/layoutData.json"
        winston.info({message: className + `: writeLayoutData: ` + filePath});
        jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
      }
    } catch (err){
      winston.info({message: className + `: writeLayoutData: ` + err });
    }
  }


  // reads/writes nodeConfig file to/from config folder
  //
  readNodeConfig(){
    var filePath = this.systemConfigPath + "/nodeConfig.json"
    return jsonfile.readFileSync(filePath)
  }
  writeNodeConfig(data){
    var filePath = this.systemConfigPath + "/nodeConfig.json"
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }

  // reads/writes the module descriptors currently in use for nodes to/from config folder
  //
  readNodeDescriptors(){
    var filePath = this.systemConfigPath + "/nodeDescriptors.json"
    return jsonfile.readFileSync(filePath)
  }
  writeNodeDescriptors(data){
    var filePath = this.systemConfigPath + "/nodeDescriptors.json"
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }

  // static file, so use fixed location
  //
  readMergConfig(){
    var filePath = this.systemConfigPath + "/mergConfig.json"
    return jsonfile.readFileSync(filePath)
  }


  // static file, so use fixed location
  //
  readServiceDefinitions(){
    var filePath = this.systemConfigPath + "/Service_Definitions.json"
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
      var filePath = path.join(this.userConfigPath, "modules", filename)
      winston.debug({message: className + `: readModuleDescriptor: ` + filePath});
      moduleDescriptor =  jsonfile.readFileSync(filePath)
    } catch(e1){
      try{
        // fall back to project directory if not in user directory
        var filePath = path.join(this.systemConfigPath, "modules", filename)
        winston.debug({message: className + `: readModuleDescriptor: ` + filePath});
        moduleDescriptor =  jsonfile.readFileSync(filePath)
      } catch(e2) {
        winston.info({message: className + `: readModuleDescriptor: failed to read ` + filename});
      }
    }
    if(moduleDescriptor == undefined){
      // remove CPU type option
      filename = filename.slice(0, filename.indexOf("--P")) + '.json'
      try{
        // try to read user directory first
        var filePath = this.userConfigPath + "/modules/" + filename
        winston.debug({message: className + `: readModuleDescriptor: ` + filePath});
        moduleDescriptor =  jsonfile.readFileSync(filePath)
      } catch(e1){
        try{
          // fall back to project directory if not in user directory
          var filePath = this.systemConfigPath + "/modules/" + filename
          winston.debug({message: className + `: readModuleDescriptor: ` + filePath});
          moduleDescriptor =  jsonfile.readFileSync(filePath)
        } catch(e2) {
          winston.info({message: className + `: readModuleDescriptor: failed to read ` + filename});
        }
      }
    }
    // store the filename actually used
    if (moduleDescriptor){
      moduleDescriptor['moduleDescriptorFilename'] = filename
    }
    return moduleDescriptor
  }
  writeModuleDescriptor(data){
    if (this.userConfigPath){
      if (data.moduleDescriptorFilename){
        try {
          // always write to user directory - check it exists first
          if (this.createDirectory(path.join(this.userConfigPath, 'modules')))
          winston.info({message: className + ': writeModuleDescriptor ' + data.moduleDescriptorFilename})
          var filePath = path.join(this.userConfigPath, "modules", data.moduleDescriptorFilename)
          jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
          // clear cached file list so it gets re-read next time accessed
          this.userModuleDescriptorFileList = []
        } catch(e){
          winston.error({message: className + ': writeModuleDescriptor ' + data.moduleDescriptorFilename + ' ERROR ' + e})
        }
      } else{
        winston.error({message: className + ': writeModuleDescriptor - no moduleDescriptorName'})
      }
    }
  }

  getModuleDescriptorFileList(moduleDescriptor){
    winston.info({message: className + ': getModuleDescriptorFileList ' + moduleDescriptor})
    var result =[]
    try{
      if (this.userConfigPath){
        if (this.userModuleDescriptorFileList.length == 0){
          this.userModuleDescriptorFileList = fs.readdirSync(path.join(this.userConfigPath, 'modules'))
          winston.debug({message: className + ': getModuleDescriptorFileList ' + JSON.stringify(this.userModuleDescriptorFileList)})
        }
      }
      if (this.systemConfigPath){
        if (this.systemModuleDescriptorFileList.length == 0){
          this.systemModuleDescriptorFileList = fs.readdirSync(path.join(this.systemConfigPath, 'modules'))
          winston.debug({message: className + ': getModuleDescriptorFileList ' + JSON.stringify(this.systemModuleDescriptorFileList)})
        }
      }
    } catch (e) {
      winston.error({message: className + ': ERROR getModuleDescriptorFileList: ' + e})
    }
    // To get the module identifier segment, count backwards from the end
    // As the 'name' portion may contain the separater character, so increasing the array count
    this.userModuleDescriptorFileList.forEach(item => {
      var array = item.split('-')
      if (array[array.length-2]){
        if (array[array.length-2] == moduleDescriptor ){
          result.push(item)
        }
      }
    })
    this.systemModuleDescriptorFileList.forEach(item => {
      var array = item.split('-')
      if (array[array.length-2]){
        if (array[array.length-2] == moduleDescriptor ){
          result.push(item)
        }
      }
    })
    winston.debug({message: className + ': getModuleDescriptorFileList: result: ' + JSON.stringify(result)})
    return result
  }


  getMatchingMDFList(location, match){
    var folder
    if (location.toUpperCase() == "SYSTEM"){
      folder = path.join(this.systemConfigPath, 'modules')
    } else {
      folder = path.join(this.userConfigPath, 'modules')
    }
    winston.info({message: className + ': getMatchingMDFList: ' + folder + ' ' + match})
    var result =[]
    var fileList
    try{
      fileList = fs.readdirSync(folder)
      winston.debug({message: className + ': getMatchingMDFList ' + JSON.stringify(this.systemModuleDescriptorFileList)})
    } catch (e) {
      winston.error({message: className + ': ERROR getMatchingMDFList: ' + e})
    }
    try {
      fileList.forEach(item => {
        if (item.includes(match)){
          var filePath = path.join(folder, item)
          var moduleDescriptor = jsonfile.readFileSync(filePath)
          result.push([item, moduleDescriptor.timestamp])
        }
      })
    } catch(err){
          
    }
    winston.debug({message: className + ': getMatchingMDFList: result: ' + JSON.stringify(result)})
    return result
  }


  //
  //
  getSerialPort(){return this.config.serialPort}
  setSerialPort(port){
    this.config.serialPort = port
    jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getCbusServerPort(){return this.config.cbusServerPort}
  setCbusServerPort(port){
    this.config.cbusServerPort = port
    jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getJsonServerPort(){return this.config.jsonServerPort}
  setJsonServerPort(port){
    this.config.jsonServerPort = port
    jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getSocketServerPort(){return this.config.socketServerPort}
  setSocketServerPort(port){  
    this.config.socketServerPort = port
    jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }

  //
  //
  getServerAddress(){return this.config.serverAddress}
  setServerAddress(address){  
    this.config.serverAddress = address
    jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
  }


  //
  //
  getRemoteAddress(){return this.config.remoteAddress}
  setRemoteAddress(address){  
    this.config.remoteAddress = address
    jsonfile.writeFileSync(this.systemConfigPath + '/config.json', this.config, {spaces: 2, EOL: '\r\n'})
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

  createUserDirectory(){
    if (this.userConfigPath){
      // override supplied for user config directory
      this.createDirectory(this.userConfigPath)
    } else {
      // create OS based user directories
      const os = require("os");
      const homePath = os.homedir()
      winston.info({message: className + ': Platform: ' + os.platform()});
      winston.info({message: className + ': User home directory: ' + homePath});

      switch (os.platform()) {
        case 'win32':
          this.userConfigPath = homePath + "/AppData/local/MMC-SERVER"
          break;
        case 'linux':
          this.userConfigPath = homePath + "/MMC-SERVER"
          break;
        case 'darwin':    // MAC O/S
          this.userConfigPath = homePath + "/MMC-SERVER"
          break;
        default:
          this.userConfigPath = homePath + "/MMC-SERVER"
        }
        this.createDirectory(this.userConfigPath)
    }
    winston.info({message: className + ': VLCB_SERVER User config path: ' + this.userConfigPath});
  }

  // return true if config file freshly created
  // false if it already existed
  createConfigFile(path){
    var result = false
    var fullPath = path + '/config.json'
    if (fs.existsSync(fullPath)) {
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
        jsonfile.writeFileSync(fullPath, config, {spaces: 2, EOL: '\r\n'})
        result = true
    }
    return result
  }

  // return true if default layout freshly created
  // false if it already existed
  createLayoutFile(name){
    var result = false
    var layoutPath = this.userConfigPath + '/layouts/' + name + '/'
    this.createDirectory(layoutPath)
    if (fs.existsSync(layoutPath + 'layoutData.json')) {
      winston.debug({message: className + `: layoutData file exists`});
      result = false
    } else {
        winston.debug({message: className + `: config file not found - creating new one`});
        // use defaultLayoutDetails
        var newLayout = defaultLayoutData
        newLayout.layoutDetails.title = name
        jsonfile.writeFileSync(layoutPath + 'layoutData.json', newLayout, {spaces: 2, EOL: '\r\n'})
        result = true
    }
    return result
  }

}


module.exports = ( arg1, arg2 ) => { return new configuration(arg1, arg2) }
