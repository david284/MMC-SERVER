'use strict';
const winston = require('winston');		// use config from root instance
const fs = require('fs');
const jsonfile = require('jsonfile')
var path = require('path');
const EventEmitter = require('events').EventEmitter;
const name = 'configuration'
const os = require("os");


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block sscope (like let), and can't be changed through reassigment or redeclared


//
// Modules are stored in two directories
// module descriptors published in the distribution are found in <this.systemDirectory>/modules
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


  // In normal use, the singleUserDirectory is NOT supplied - i.e. only supply systemDirectory
  // the code will create a system specific user directory
  //
  // singleUserDirectory is intended to be supplied when unit testing
  // to avoid polluting the user directory

class configuration {

  constructor(systemDirectory, singleUserDirectory) {
    //                        012345678901234567890123456789987654321098765432109876543210
		winston.debug({message:  '----------------- configuration Constructor ----------------'});
		winston.debug({message:  '--- system path: ' + systemDirectory});
		winston.debug({message:  '--- user path: ' + singleUserDirectory});
    this.busTrafficLogStream = fs.createWriteStream(busTrafficPath, {flags: 'a+'});
    this.eventBus = new EventEmitter();
    this.userModuleDescriptorFileList = []
    this.systemModuleDescriptorFileList = []
    this.createDirectories(systemDirectory, singleUserDirectory)
    winston.debug({message:  name + ': appSettings: '+ JSON.stringify(this.appSettings)});
	} // end constructor

  //
  // Attempt to create all directories needed
  // should only create (& populate if appropriate) if directory doesn't exist
  //
  createDirectories(systemDirectory, singleUserDirectory){
    // create a single user directory, based on OS platform
    try{
      this.createSingleUserDirectory(singleUserDirectory)
      // Create appStorage & create appSettings file is either don't exist
      // will set appStorageDirectory
      this.createAppStorage()
      this.createAppSettingsFile(this.appStorageDirectory)
      // now read appSettings from AppStorage, as its content may affect subsequent actions
      this.readAppSettings()
      //
      this.systemDirectory = systemDirectory
      this.createDirectory(systemDirectory)
      // decide which directory to use for 'USER' content
      if (this.appSettings.userDataMode == 'CUSTOM' ){ this.currentUserDirectory = this.appSettings.customUserDirectory }
      else if (this.appSettings.userDataMode == 'USER' ){ this.currentUserDirectory = this.singleUserDirectory }
      else { this.currentUserDirectory = this.appStorageDirectory }    
      winston.info({message: className + `: currentUserDirectory: ` + this.currentUserDirectory});
      // and default layout exists (creates directory if not there also)
      this.createLayoutFile(this.currentUserDirectory, defaultLayoutData.layoutDetails.title)
    } catch (err){
      winston.error({message:  name + ': createDirectories: '+ err});
    }
  }


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // appSettings methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------

  readAppSettings(){
    winston.info({message: className + ` readAppSettings` });
    try{
      this.appSettings = jsonfile.readFileSync(path.join(this.appStorageDirectory, 'appSettings.json'))
      winston.info({message: className + ` readAppSettings ` + JSON.stringify(this.appSettings) });
    } catch(err){
      var text = "Failed to load " + path.join(this.appStorageDirectory, 'appSettings.json') + " - check file is valid JSON"
      winston.error({message: className + `: readAppSettings: ` + text})
      winston.error({message: className + `: readAppSettings: ` + err})
    }
  }

  // update current appSettings file
  writeAppSettings(){
    winston.debug({message: className + ` writeAppSettings` });
    // remove older redundant data
    delete this.appSettings.cbusServerPort
    delete this.appSettings.jsonServerPort
    delete this.appSettings.remoteAddress
    delete this.appSettings.serialPort
    delete this.appSettings.serverAddress
    delete this.appSettings.socketServerPort
    try{
      jsonfile.writeFileSync(path.join(this.appStorageDirectory, 'appSettings.json'), this.appSettings, {spaces: 2, EOL: '\r\n'})
    } catch(err){
      winston.info({message: className + `: writeAppSettings: ` + err});
    }
  }


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // backup methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------

  //
  // 
  readBackup(layoutName, filename){
    winston.info({message: className + ` readBackup ` + filename });
    var filePath = path.join(this.currentUserDirectory, 'layouts', layoutName, 'backups', filename)
    winston.debug({message: className + ` readBackup: ` + filePath });
    var file = null
    try{
      file = jsonfile.readFileSync(filePath)
    } catch(err){
      winston.info({message: className + `: readBackup: ` + err});
    }
    return file
  }

  //
  // 
  writeBackup(layoutName, fileName, layoutData, nodeConfig){
    winston.info({message: className + ` writeBackup: ` + fileName });
    var backupFolder = path.join(this.currentUserDirectory, 'layouts', layoutName, 'backups')
    // now create current backup folder if it doesn't exist
    this.createDirectory(backupFolder)
    var filePath = path.join(backupFolder, fileName)
    winston.debug({message: className + ` writeBackup: ` + filePath });
    try{
      var backup = { 
        timestamp: new Date().toISOString(),
        systemConfig: this.appSettings,
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
      if (this.currentUserDirectory){
        var backupFolder = path.join(this.currentUserDirectory, 'layouts', layoutName, 'backups')
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


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // busTraffic methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------


  writeBusTraffic(data){
    // use {flags: 'a'} to append and {flags: 'w'} to erase and write a new file
    var time = new Date()
    var timeStamp = String(time.getMinutes()).padStart(2, '0') + ':' 
      + String(time.getSeconds()).padStart(2, '0') + '.' 
      + String(time.getMilliseconds()).padStart(3, '0')
    this.busTrafficLogStream.write(timeStamp + ' ' + data + "\r\n");
  }



  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // Layout methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------


  //
  //
  getCurrentLayoutFolder(){return this.appSettings.currentLayoutFolder}
  setCurrentLayoutFolder(folder){
    if (this.currentUserDirectory){
      // check folder name not blank, set to default if so...
      if (folder == undefined) {folder = defaultLayoutData.layoutDetails.title}
      this.appSettings.currentLayoutFolder = folder
      // now create current layout folder if it doesn't exist
      if (this.createDirectory(this.currentUserDirectory + '/layouts/' + this.appSettings.currentLayoutFolder)) {
        // if freshly created, create blank layout file & directory, using folder name as layout name
        this.createLayoutFile(this.currentUserDirectory, this.appSettings.currentLayoutFolder)
      }
      this.writeAppSettings()
    }
  }


  // return true if default layout freshly created
  // false if it already existed
  createLayoutFile(directory, name){
    winston.debug({message: className + `: createLayoutFile: ` + directory + ' ' + name});      
    var result = false
    try{
      this.createDirectory(path.join(directory, 'layouts'))
      if (fs.existsSync(path.join(directory, 'layouts', name, 'layoutData.json'))) {
        winston.debug({message: className + `: layoutData file exists`});
        result = false
      } else {
          winston.debug({message: className + `: layoutData file not found - creating new one`});
          // use defaultLayoutDetails
          var newLayout = defaultLayoutData
          newLayout.layoutDetails.title = name
          jsonfile.writeFileSync(path.join(directory, 'layouts', name, 'layoutData.json'), newLayout, {spaces: 2, EOL: '\r\n'})
          result = true
      }
    } catch(err){
      winston.debug({message: className + `: createLayoutFile: ` + err});      
    }
    return result
  }


  //
  //
  getListOfLayouts(){
    winston.debug({message: className + `: get_layout_list: ` + this.currentUserDirectory});
    try{
      if (this.currentUserDirectory){
        var list = fs.readdirSync(path.join(this.currentUserDirectory, 'layouts')).filter(function (file) {
          return fs.statSync(path.join(this.currentUserDirectory, 'layouts', file)).isDirectory();
        },(this));
        winston.debug({message: className + `: get_layout_list: ` + list});
        return list
      }
    } catch(err){
      winston.error({message: className + `: get_layout_list: ` + err});
    }
  }
  deleteLayoutFolder(folder){
    winston.info({message: className + `: deleteLayoutFolder: ` + folder});
    try {
      if (this.currentUserDirectory){
        // check folder name not blank
        if (folder != undefined) {
          var folderPath = path.join(this.currentUserDirectory, '/layouts/', folder )
          fs.rmSync(folderPath, { recursive: true }) 
        }
        this.writeAppSettings()
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
    if (this.appSettings.currentLayoutFolder == undefined) {
      winston.info({message: className + `: readLayoutData: currentLayoutFolder undefined`});
      this.appSettings.currentLayoutFolder = defaultLayoutData.layoutDetails.title
      this.writeAppSettings()
    }
    if(this.currentUserDirectory){
      var filePath = path.join( this.currentUserDirectory, "layouts", this.appSettings.currentLayoutFolder)
      // does layoutData filse exist?
      if (!fs.existsSync(path.join(filePath, "layoutData.json"))){
        // doesn't exist, so create
        this.createLayoutFile(this.currentUserDirectory, this.appSettings.currentLayoutFolder)
      }
      // ok, folder & file should now exist - read it
      try{
        winston.info({message: className + `: readLayoutData: reading ` + path.join(filePath, "layoutData.json")});
        file = jsonfile.readFileSync(path.join(filePath, "layoutData.json"))
      } catch(e){
        winston.info({message: className + `: readLayoutData: Error reading ` + path.join(filePath, "layoutData.json")});
        // couldn't read the layout, so get the default layout instead...
        this.appSettings.currentLayoutFolder = defaultLayoutData.layoutDetails.title
        this.writeAppSettings()
        filePath = path.join(this.currentUserDirectory, 'layouts', this.appSettings.currentLayoutFolder)
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
      file.layoutDetails.title = this.appSettings.currentLayoutFolder
      file.layoutDetails.subTitle = "rebuilt data"
      file["eventDetails"] = {}
      file["nodeDetails"] = {}
    }
    return file
  }

  
  writeLayoutData(data){
    try{
      if(this.currentUserDirectory){
        var filePath = this.currentUserDirectory + '/layouts/' + this.appSettings.currentLayoutFolder + "/layoutData.json"
        winston.info({message: className + `: writeLayoutData: ` + filePath});
        jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
      }
    } catch (err){
      winston.info({message: className + `: writeLayoutData: ` + err });
    }
  }


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // nodeConfig methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------


  // reads/writes nodeConfig file to/from system directory
  //
  readNodeConfig(){
    var filePath = this.systemDirectory + "/nodeConfig.json"
    return jsonfile.readFileSync(filePath)
  }
  writeNodeConfig(data){
    var filePath = this.systemDirectory + "/nodeConfig.json"
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // Node Descriptor methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------


  // reads/writes the module descriptors currently in use for nodes to/from system directory
  //
  readNodeDescriptors(){
    var filePath = this.systemDirectory + "/nodeDescriptors.json"
    return jsonfile.readFileSync(filePath)
  }

  writeNodeDescriptors(data){
    var filePath = this.systemDirectory + "/nodeDescriptors.json"
    jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n'})
  }


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // Module Descriptor File methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------



  writeModuleDescriptor(data){
    if (this.currentUserDirectory){
      if (data.moduleDescriptorFilename){
        // don't want location in folder copy, in case it's copied
        delete data.moduleDescriptorLocation
        try {
          // always write to user directory - check it exists first
          if (this.createDirectory(path.join(this.currentUserDirectory, 'modules')))
          winston.info({message: className + ': writeModuleDescriptor ' + data.moduleDescriptorFilename})
          var filePath = path.join(this.currentUserDirectory, "modules", data.moduleDescriptorFilename)
          jsonfile.writeFileSync(filePath, data, {spaces: 2, EOL: '\r\n', flag:'w'})
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


  deleteMDF(filename){
    var filePath = this.currentUserDirectory + "/modules/" + filename
    winston.debug({message: className + `: deleteMDF: ` + filePath});
    try {
      fs.rmSync(filePath) 
    } catch(err){
      winston.info({message: className + `: deleteMDF: ` + err});
    }     
  }


  getMDF(location, filename){
    var moduleDescriptor
    var filePath = undefined
    if (location == 'SYSTEM'){
      filePath = this.systemDirectory + "/modules/" + filename
    }
    else if (location == 'USER'){
      filePath = this.currentUserDirectory + "/modules/" + filename
    }
    try {
      winston.debug({message: className + `: getMDF: ` + filePath});
      moduleDescriptor = jsonfile.readFileSync(filePath) 
      moduleDescriptor['moduleDescriptorFilename'] = filename
      moduleDescriptor['moduleDescriptorLocation'] = location
    } catch(err){
      winston.info({message: className + `: getMDF: ` + err});
    }     
    return moduleDescriptor
  }


  //
  // Get merged list of matching files from both USER & SYSTEM locations
  //
  getModuleDescriptorFileList(moduleDescriptor){
    winston.info({message: className + ': getModuleDescriptorFileList ' + moduleDescriptor})
    var result =[]
    try{
      if (this.currentUserDirectory){
        if (this.userModuleDescriptorFileList.length == 0){
          this.userModuleDescriptorFileList = fs.readdirSync(path.join(this.currentUserDirectory, 'modules'))
          winston.debug({message: className + ': getModuleDescriptorFileList ' + JSON.stringify(this.userModuleDescriptorFileList)})
        }
      }
      if (this.systemDirectory){
        if (this.systemModuleDescriptorFileList.length == 0){
          this.systemModuleDescriptorFileList = fs.readdirSync(path.join(this.systemDirectory, 'modules'))
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

  //
  // Get list of matching files from specified location only
  //
  getMatchingMDFList(location, match){
    var folder
    if (location.toUpperCase() == "SYSTEM"){
      folder = path.join(this.systemDirectory, 'modules')
    } else {
      folder = path.join(this.currentUserDirectory, 'modules')
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
  // Try to get a matching filename from either USER or SYSTEM locations
  // tries USER first, then SYSTEM
  // returns either filename or undefined
  //
  getMatchingModuleDescriptorFile(moduleIdentifier, version, processorType){
    winston.debug({message: className + ': getMatchingModuleDescriptorFile: ' + moduleIdentifier})
    var location
    //
    // first try USER location
    location = 'USER'
    var fileList = this.getMatchingMDFList(location, moduleIdentifier)
    winston.debug({message: className + ': getMatchingModuleDescriptorFile: ' + location + ': ' + JSON.stringify(fileList)})
    var fileName = this.getMatchingModuleDescriptorFilenameUsingList(moduleIdentifier, version, processorType, fileList)
    //
    // if no luck, try SYSTEM location
    if (fileName == undefined) {
      location = 'SYSTEM'
      fileList = this.getMatchingMDFList(location, moduleIdentifier)
      winston.debug({message: className + ': getMatchingModuleDescriptorFile: ' + location + ': ' + JSON.stringify(fileList)})
      fileName = this.getMatchingModuleDescriptorFilenameUsingList(moduleIdentifier, version, processorType, fileList)
    }
    //
    // ok, if we have actually found a matching file,then read it
    var moduleDescriptor
    if (fileName != undefined) {
      moduleDescriptor = this.getMDF(location, fileName)
    }
    return moduleDescriptor
  }

  // try to find a matching filename from the supplied filelist
  // tries with the processor type option first
  // but if no success, tries for match with files with no processor type
  // note conversions to uppercase so tolerant of lowercase in either supplied arguments or filename
  //
  getMatchingModuleDescriptorFilenameUsingList(moduleIdentifier, version, processorType, fileList){
    var filename = undefined
    winston.debug({message: className + ': processorType ' + '--' + processorType})
    for (let i=0; i< fileList.length; i++){
      // check for file with matching processor type first
      // note we convert both to upper case, so will match any combination
      if (fileList[i][0].toUpperCase().includes('--' + processorType.toUpperCase())){
        winston.debug({message: className + ': with processorType ' + JSON.stringify(fileList[i])})
        if (fileList[i][0].toUpperCase().includes(moduleIdentifier + '-' + version.toUpperCase())){
          filename = fileList[i][0]
          break
        }
      }
      // ok, check files that don't include the processor type
      // note that we turn the filename to upper case, so checks absence of both --p and --P
      if (!fileList[i][0].toUpperCase().includes('--P')){
        winston.debug({message: className + ': without processorType ' + JSON.stringify(fileList[i])})
        if (fileList[i][0].toUpperCase().includes(moduleIdentifier + '-' + version.toUpperCase())){
          filename = fileList[i][0]
          break
        }
      }
    }
    winston.debug({message: className + ': getMatchingModuleDescriptorFilenameUsingList: file: ' + filename})
    return filename
  }


  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------
  // Other methods
  //-----------------------------------------------------------------------------------------------
  //-----------------------------------------------------------------------------------------------


  // static file, so use fixed location
  //
  readMergConfig(){
    var filePath = this.systemDirectory + "/mergConfig.json"
    return jsonfile.readFileSync(filePath)
  }


  // static file, so use fixed location
  //
  readServiceDefinitions(){
    var filePath = this.systemDirectory + "/Service_Definitions.json"
    return jsonfile.readFileSync(filePath)
  }
  
  //
  //
  getJsonServerPort(){return (this.jsonServerPort != undefined) ? this.jsonServerPort : 5551}
  setJsonServerPort(port){
    this.jsonServerPort = port
  }


  //
  //
  getSocketServerPort(){return  (this.socketServerPort != undefined) ? this.socketServerPort : 5552}
  setSocketServerPort(port){  
    this.socketServerPort = port
  }


  // return true if directory freshly created
  // false if it already existed
  createDirectory(directory) {
    var result = false
    try {
      // check if directory exists
      if (fs.existsSync(directory)) {
          winston.debug({message: className + `: createDirectory: ` + directory + ` Directory exists`});
          result = false
        } else {
          winston.debug({message: className + `: createDirectory: ` + directory + ` Directory not found - creating new one`});
          fs.mkdirSync(directory, { recursive: true })
          result = true
      } 
    } catch (err){
      winston.error({message: className + `: createDirectory: ` + err});
    }
    return result
  }

  createAppStorage(){
    try{
      // create OS based user directories
      winston.info({message: className + ': createAppStorage: Platform: ' + os.platform()});
      switch (os.platform()) {
        case 'win32':
          this.appStorageDirectory = path.join("C:/ProgramData", "MMC-SERVER")
          // for backwards compatibility, copy from user directory if app storage doesn't yet exist
          try{
            if (fs.existsSync(this.appStorageDirectory) == false) {
              winston.info({message: className + ': no appStorage, look for existing singleUser: ' + this.singleUserDirectory});
              // try copying from singleUserDirectory 
              if (fs.existsSync(this.singleUserDirectory)) {
                fs.cpSync(this.singleUserDirectory, this.appStorageDirectory, {recursive: true} )
              }
            }
          } catch(err){
            winston.error({message: className + ': copy from singleUser: ' + err});
          }
          break;
        case 'linux':
          this.appStorageDirectory = path.join(os.homedir(), "MMC-SERVER")
          break;
        case 'darwin':    // MAC O/S
          this.appStorageDirectory = path.join(os.homedir(), "MMC-SERVER")
          break;
        default:
          this.appStorageDirectory = path.join("C:/ProgramData", "MMC-SERVER")
      }
      winston.info({message: className + ': createAppStorage: Directory: ' + this.appStorageDirectory});
      this.createDirectory(this.appStorageDirectory)
      winston.info({message: className + ': appStorageDirectory: ' + this.appStorageDirectory});
      // also ensure all the expected folders exists in user directory
      if (this.appStorageDirectory){
        this.createDirectory(path.join(this.appStorageDirectory, 'layouts'))
        this.createDirectory(path.join(this.appStorageDirectory, '/modules'))
        // and default layout exists (creates directory if not there also)
        this.createLayoutFile(this.appStorageDirectory, defaultLayoutData.layoutDetails.title)
      }
    } catch(err){
      winston.error({message: className + ': createAppStorage: ' + err});      
    }
  }

  createSingleUserDirectory(userDirectory){
    if (userDirectory){
      this.createDirectory(userDirectory)
    } else {
      // create OS based user directories
      const homePath = os.homedir()
      winston.info({message: className + ': Platform: ' + os.platform()});
      winston.info({message: className + ': User home directory: ' + homePath});

      switch (os.platform()) {
        case 'win32':
          this.singleUserDirectory = homePath + "/AppData/local/MMC-SERVER"
          break;
        case 'linux':
          this.singleUserDirectory = homePath + "/MMC-SERVER"
          break;
        case 'darwin':    // MAC O/S
          this.singleUserDirectory = homePath + "/MMC-SERVER"
          break;
        default:
          this.singleUserDirectory = homePath + "/MMC-SERVER"
        }
        this.createDirectory(this.singleUserDirectory)
    }
    winston.info({message: className + ': singleUserDirectory: ' + this.singleUserDirectory});
    // also ensure all the expected folders exists in user directory
    if (this.singleUserDirectory){
      this.createDirectory(this.singleUserDirectory + '/layouts')
      this.createDirectory(this.singleUserDirectory + '/modules')
      // and default layout exists (creates directory if not there also)
      this.createLayoutFile(this.singleUserDirectory, defaultLayoutData.layoutDetails.title)
    } 
  }

  //
  //
  createAppSettingsFile(directory){
    winston.info({message: className + `: createAppSettingsFile: ` + directory});
    var fileNeedsCreating = true
    try{
      var fullPath = path.join(directory, 'appSettings.json')
      if (fs.existsSync(fullPath)) {
        winston.debug({message: className + `: appSettings file exists`});
        // try to read it, to check it's valid
        try{
          this.appSettings = jsonfile.readFileSync(path.join(this.appStorageDirectory, 'appSettings.json'))
          fileNeedsCreating = false
        } catch {
          winston.error({message: className + `: ` + path.join(this.appStorageDirectory , "appSettings.json") + ` file invalid - create new one`});
          fileNeedsCreating = true 
        }
      } else {
        winston.debug({message: className + `: appSettings file not present - create new one`});
      }
      if(fileNeedsCreating) {
          winston.debug({message: className + `: creating new appSettings.json`});
          const appSettings = {
            "currentLayoutFolder": "default",
            "userDataMode": "APP",
            "customUserDirectory": null
          }
          this.appSettings = appSettings
          jsonfile.writeFileSync(fullPath, appSettings, {spaces: 2, EOL: '\r\n'})
      }
    } catch(err){
      winston.error({message: className + `: createAppSettingsFile: ` + err});
    }
  }


} // end class


module.exports = ( arg1, arg2 ) => { return new configuration(arg1, arg2) }
