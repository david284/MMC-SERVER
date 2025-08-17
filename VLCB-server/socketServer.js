const winston = require('winston');		// use config from root instance
const name = 'socketServer'
const jsonfile = require('jsonfile');
const { isUndefined } = require('util');
const { sleep } = require('./utilities');
const packageInfo = require(process.cwd()+'/package.json')

const server = require('http').createServer()



const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});


exports.socketServer = function(config, node, messageRouter, cbusServer, programNode, status) {


  //*************************************************************************************** */
  //
  // events from web socket clients
  //
  //*************************************************************************************** */

  io.on('connection', function(socket){
    winston.info({message: 'socketServer:  a user connected'});
    send_SERVER_STATUS(config, status)
    io.emit('MODULE_NAMES', config.readMergConfig().modules)
    winston.info({message: name + `: sent MODULE_NAMES`});
    if (status.mode == "RUNNING"){
      // let the client know the current layout & nodes as we're already running
      io.emit('LAYOUT_DATA', config.readLayoutData())
      winston.info({message: name + `: sent LAYOUT_DATA`});
      node.query_all_nodes()
    }
    
    //
    //
    socket.on('ACCESSORY_LONG_OFF', function(data){
      try {
        winston.info({message: name + `: ACCESSORY_LONG_OFF ${JSON.stringify(data)}`});
        if (data) { 
          if((data.nodeNumber != undefined) && (data.eventNumber != undefined)){
            node.sendACOF(data.nodeNumber, data.eventNumber)
          } else { winston.warn({message: name + `: ACCESSORY_LONG_OFF - missing arguments`}); }
        } else {
          winston.warn({message: name + `: ACCESSORY_LONG_OFF - missing arguments`});
        }
      }catch(err){
        winston.error({message: name + `: ACCESSORY_LONG_OFF: ${err}`});
      }
    })

    //
    //
    socket.on('ACCESSORY_LONG_ON', function(data){
      try{
        winston.info({message: name + `: ACCESSORY_LONG_ON ${JSON.stringify(data)}`});
        if (data) { 
          if((data.nodeNumber != undefined) && (data.eventNumber != undefined)){
            node.sendACON(data.nodeNumber, data.eventNumber)
          } else { winston.warn({message: name + `: ACCESSORY_LONG_ON - missing arguments`}); }
        } else {
          winston.warn({message: name + `: ACCESSORY_LONG_ON - missing arguments`});
        }
      }catch(err){
        winston.error({message: name + `: ACCESSORY_LONG_ON: ${err}`});
      }
    })

    //
    //
    socket.on('ACCESSORY_SHORT_OFF', function(data){
      try{
        winston.info({message: `socketServer: ACCESSORY_SHORT_OFF ${JSON.stringify(data)}`});
        if (data) { 
          if((data.nodeNumber != undefined) && (data.deviceNumber != undefined)){
            node.sendASOF(data.nodeNumber, data.deviceNumber)
          } else { winston.warn({message: name + `: ACCESSORY_SHORT_OFF - missing arguments`}); }
        } else {
          winston.warn({message: name + `: ACCESSORY_SHORT_OFF - missing arguments`});
        }
      }catch(err){
        winston.error({message: name + `: ACCESSORY_SHORT_OFF: ${err}`});
      }
    })

    //
    //
    socket.on('ACCESSORY_SHORT_ON', function(data){
      try{
        winston.info({message: `socketServer: ACCESSORY_SHORT_ON ${JSON.stringify(data)}`});
        if (data) { 
          if((data.nodeNumber != undefined) && (data.deviceNumber != undefined)){
            node.sendASON(data.nodeNumber, data.deviceNumber)
          } else { winston.warn({message: name + `: ACCESSORY_SHORT_ON - missing arguments`}); }
        } else {
          winston.warn({message: name + `: ACCESSORY_SHORT_ON - missing arguments`});
        }
      }catch(err){
        winston.error({message: name + `: ACCESSORY_SHORT_ON: ${err}`});
      }
    })

    //
    //
    socket.on('CANID_ENUM', function(nodeNumber){
      try {
        winston.info({message: name + `:  CANID_ENUM ${nodeNumber}`});
        node.sendENUM(nodeNumber)
      }catch(err){
        winston.error({message: name + `: CANID_ENUM: ${err}`});
      }
    })

    //
    //
    socket.on('CHANGE_LAYOUT', function(data){
      try {
        winston.info({message: `socketServer: CHANGE_LAYOUT ` + JSON.stringify(data)});
        if (data.userPath){
          // change user path where all user entered data is stored
          config.createSingleUserDirectory(data.userPath)
        }
        if (data.layoutName){
          config.setCurrentLayoutFolder(data.layoutName)
        }
        io.emit('LAYOUT_DATA', config.readLayoutData())
      }catch(err){
        winston.error({message: name + `: CHANGE_LAYOUT: ${err}`});
      }
    })

    //
    //
    socket.on('CLEAR_CBUS_ERRORS', function(){
      try{
        winston.info({message: `socketServer: CLEAR_CBUS_ERRORS`});
        node.clearCbusErrors();
      }catch(err){
        winston.error({message: name + `: CLEAR_CBUS_ERRORS: ${err}`});
      }
    })
      
    //
    //
    socket.on('CLEAR_BUS_EVENTS', function(){
      try{
        winston.info({message: `socketServer: CLEAR_BUS_EVENTS`});
        node.clearEvents();
      }catch(err){
        winston.error({message: name + `: CLEAR_BUS_EVENTS: ${err}`});
      }
    })

    //
    //
    socket.on('CLEAR_NODE_EVENTS', function(data){
      try{
        winston.info({message: `socketServer: CLEAR_NODE_EVENTS ${data.nodeNumber}`});
        node.removeNodeEvents(data.nodeNumber);
      }catch(err){
        winston.error({message: name + `: CLEAR_NODE_EVENTS: ${err}`});
      }
    })

    //
    //
    socket.on('DELETE_ALL_EVENTS', async function(data){
      try{
        winston.info({message: name + `: DELETE_ALL_EVENTS ${JSON.stringify(data.nodeNumber)}`});
        await node.delete_all_events(data.nodeNumber)
        node.removeNodeEvents(data.nodeNumber)                   // clear node structure of events
        await node.request_all_node_events(data.nodeNumber) // now refresh
      }catch(err){
        winston.error({message: name + `: DELETE_ALL_EVENTS: ${err}`});
      }
    })

    //
    //
    socket.on('DELETE_BACKUP', function(data){
      try{
        winston.info({message: name + `: DELETE_BACKUP ${JSON.stringify(data)}`});
        config.deleteBackup(data.layoutName, data.fileName)
      }catch(err){
        winston.error({message: name + `: DELETE_BACKUP: ${err}`});
      }
    })

    //
    //
    socket.on('DELETE_NODE_BACKUP', function(data){
      try{
        winston.info({message: name + `: DELETE_NODE_BACKUP ${JSON.stringify(data)}`});
        config.deleteNodeBackup(data.layoutName, data.nodeNumber, data.fileName)
      }catch(err){
        winston.error({message: name + `: DELETE_NODE_BACKUP: ${err}`});
      }
    })

    //
    //
    socket.on('DELETE_LAYOUT', function(data){
      try{
        winston.info({message: name + `: DELETE_LAYOUT ${JSON.stringify(data.layoutName)}`});
        config.deleteLayoutFolder(data.layoutName)
      }catch(err){
        winston.error({message: name + `: DELETE_LAYOUT: ${err}`});
      }
    })

    //
    //
    socket.on('EVENT_TEACH_BY_IDENTIFIER', async function(data){
      try{
        winston.info({message: `socketServer: EVENT_TEACH_BY_IDENTIFIER ${JSON.stringify(data)}`});
        await node.event_teach_by_identifier(data.nodeNumber, data.eventIdentifier, data.eventVariableIndex, data.eventVariableValue, data.reLoad)
        if(data.linkedVariableList != undefined){
          for (let i = 0; i < data.linkedVariableList.length; i++) {
            node.requestEventVariableByIdentifier(data.nodeNumber, data.eventIdentifier, data.linkedVariableList[i])
          }
        }
      }catch(err){
        winston.error({message: name + `: EVENT_TEACH_BY_IDENTIFIER: ${err}`});
      }
    })

    //
    //
    socket.on('IMPORT_MODULE_DESCRIPTOR', function(data){
      try{
        var filename = data.moduleDescriptor.moduleDescriptorFilename
        winston.info({message: 'socketServer: IMPORT_MODULE_DESCRIPTOR ' + data.nodeNumber + ' ' + filename});
        config.writeModuleDescriptor(data.moduleDescriptor)
        // refresh matching list, if there's an associated nodeNumber
        if (data.nodeNumber != undefined){
          var match = node.nodeConfig.nodes[data.nodeNumber].moduleIdentifier
          io.emit('MATCHING_MDF_LIST', "USER", data.nodeNumber, config.getMatchingMDFList("USER", match))
        }
        node.refreshNodeDescriptors()   // force refresh of nodeDescriptors
      }catch(err){
        winston.error({message: name + `: IMPORT_MODULE_DESCRIPTOR: ${err}`});
      }
    })

    //
    //
    socket.on('PROGRAM_NODE', async function(data){
      try{
        winston.info({message: 'socketServer:  PROGRAM_NODE: nodeNumber ' + data.nodeNumber});
        await programNode.program(data.nodeNumber, data.cpuType, data.flags, data.hexFile)
        await sleep(200)              // allow time for programming to complete
        node.set_FCU_compatibility()
      }catch(err){
        winston.error({message: name + `: PROGRAM_NODE: ${err}`});
      }
    })

    //
    //
    socket.on('QUERY_ALL_NODES', function(){
      try{
        winston.info({message: 'socketServer:  QUERY_ALL_NODES'});
        node.set_FCU_compatibility()
        node.query_all_nodes()
      }catch(err){
        winston.error({message: name + `: QUERY_ALL_NODES: ${err}`});
      }
    })

    //
    //
    socket.on('REMOVE_EVENT', async function(data){
      try{
        winston.info({message: `socketServer: REMOVE_EVENT ${JSON.stringify(data)}`});
        await node.event_unlearn(data.nodeNumber, data.eventName)
        node.removeNodeEvent(data.nodeNumber, data.eventName)
        await node.request_all_node_events(data.nodeNumber) // now refresh
      }catch(err){
        winston.error({message: name + `: REMOVE_EVENT: ${err}`});
      }
    })

    //
    //
    socket.on('REMOVE_NODE', function(nodeNumber){
      try{
        winston.info({message: `socketServer: REMOVE_NODE ${nodeNumber}`});
        if (nodeNumber != undefined){
          node.remove_node(nodeNumber)
        }
      }catch(err){
        winston.error({message: name + `: REMOVE_NODE: ${err}`});
      }
    })

    //
    //
    socket.on('RENAME_NODE_BACKUP', function(data){
      try{
        winston.info({message: name + `: RENAME_NODE_BACKUP ${JSON.stringify(data)}`});
        let nodeBackups_list = config.renameNodeBackup(data.layoutName, data.nodeNumber, data.fileName, data.newFileName)
        io.emit('NODE_BACKUPS_LIST', nodeBackups_list)
        winston.info({message: name + `: sent NODE_BACKUPS_LIST ${JSON.stringify(nodeBackups_list)}`});
      }catch(err){
        winston.error({message: name + `: RENAME_NODE_BACKUP: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_ALL_EVENT_VARIABLES_FOR_NODE', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_ALL_EVENT_VARIABLES_FOR_NODE ${JSON.stringify(data)}`});
        if (data.nodeNumber != undefined){
          node.requestAllEventVariablesForNode(data.nodeNumber)
        } else {
          winston.error({message: `socketServer:  REQUEST_ALL_EVENT_VARIABLES_FOR_NODE: ERROR ${JSON.stringify(data)}`});
        }
      }catch(err){
        winston.error({message: name + `: REQUEST_ALL_EVENT_VARIABLES_FOR_NODE: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_EVENT_VARIABLES_BY_IDENTIFIER', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_EVENT_VARIABLES_BY_IDENTIFIER ${JSON.stringify(data)}`});
        if ((data.nodeNumber != undefined) && (data.eventIdentifier != undefined)){
          node.requestAllEventVariablesByIdentifier(data.nodeNumber, data.eventIdentifier)
        } else {
          winston.error({message: `socketServer:  REQUEST_EVENT_VARIABLES_BY_IDENTIFIER: ERROR ${JSON.stringify(data)}`});
        }
      }catch(err){
        winston.error({message: name + `: REQUEST_EVENT_VARIABLES_BY_IDENTIFIER: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_ALL_NODE_EVENTS', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_ALL_NODE_EVENTS ${JSON.stringify(data)}`});
        if (data.nodeNumber != undefined){
          node.request_all_node_events(data.nodeNumber)
        }
      }catch(err){
        winston.error({message: name + `: REQUEST_ALL_NODE_EVENTS: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_ALL_NODE_PARAMETERS', function(data){ //Request Node Parameter
      try{
        winston.info({message: `socketServer:  REQUEST_ALL_NODE_PARAMETERS ${JSON.stringify(data)}`});
        node.request_all_node_parameters(data.nodeNumber)
      }catch(err){
        winston.error({message: name + `: REQUEST_ALL_NODE_PARAMETERS: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_ALL_NODE_VARIABLES', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_ALL_NODE_VARIABLES ${JSON.stringify(data)}`})
        node.request_all_node_variables(data.nodeNumber)
      }catch(err){
        winston.error({message: name + `: REQUEST_ALL_NODE_VARIABLES: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_BACKUP', function(data){
      try{
        winston.info({message: name + `: REQUEST_BACKUP ` + JSON.stringify(data)});
        const backup = config.readBackup(data.layoutName, data.fileName)
        io.emit('RESTORED_DATA', backup)
        winston.info({message: `socketServer: sent RESTORED_DATA`});
      }catch(err){
        winston.error({message: name + `: REQUEST_BACKUP: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_BACKUPS_LIST', function(data){
      try{
        winston.info({message: `socketServer: REQUEST_BACKUPS_LIST`});
        const backups_list = config.getListOfBackups(data.layoutName)
        io.emit('BACKUPS_LIST', backups_list)
        winston.info({message: `socketServer: sent BACKUPS_LIST ` + backups_list});
      }catch(err){
        winston.error({message: name + `: REQUEST_BACKUPS_LIST: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_FIRMWARE_INFO', async function(hexFile){
      try{
        winston.info({message: name +':  REQUEST_FIRMWARE_INFO:'});
        let returnData = programNode.getFirmwareInformation(hexFile)
        winston.info({message: name + `:  FIRMWARE_INFO: ${JSON.stringify(returnData)}`});
        io.emit('FIRMWARE_INFO', returnData)
      }catch(err){
        winston.error({message: name + `: REQUEST_FIRMWARE_INFO: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_LOG_FILE', function(data){
      try{
        winston.info({message: name + `: REQUEST_LOG_FILE ` + JSON.stringify(data)});
        const logFile = config.readLogFile(data.fileName)
        if (logFile.length > 0) {
          io.emit('LOG_FILE', {fileName:data.fileName, logFile:logFile})
        }
        winston.info({message: `socketServer: sent LOG_FILE ${data.fileName}`});
      }catch(err){
        winston.error({message: name + `: REQUEST_LOG_FILE: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_NODE_BACKUP', function(data){
      try{
        winston.info({message: name + `: REQUEST_NODE_BACKUP ` + JSON.stringify(data)});
        const backup = config.readNodeBackup(data.layoutName, data.nodeNumber, data.fileName)
        io.emit('RESTORED_DATA', backup)
        winston.info({message: `socketServer: sent RESTORED_DATA`});
      }catch(err){
        winston.error({message: name + `: REQUEST_NODE_BACKUP: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_NODE_BACKUPS_LIST', function(data){
      try{
        winston.info({message: `socketServer: REQUEST_BACKUPS_LIST`});
        const nodeBackups_list = config.getListOfNodeBackups(data.layoutName, data.nodeNumber)
        io.emit('NODE_BACKUPS_LIST', nodeBackups_list)
        winston.info({message: `socketServer: sent NODE_BACKUPS_LIST ` + data.nodeNumber});
      }catch(err){
        winston.error({message: name + `: REQUEST_NODE_BACKUPS_LIST: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_BUS_CONNECTION', function(){
      try{
        io.emit('BUS_CONNECTION', status.busConnection)
      }catch(err){
        winston.error({message: name + `: REQUEST_BUS_CONNECTION: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_BUS_EVENTS', function(){
      try{
        winston.info({message: `socketServer: REQUEST_BUS_EVENTS`});
        node.refreshEvents();
      }catch(err){
        winston.error({message: name + `: REQUEST_BUS_EVENTS: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_DIAGNOSTICS', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_DIAGNOSTICS ${JSON.stringify(data)}`});
        if (data.serviceIndex == undefined){data.serviceIndex = 0;}
        node.sendRDGN(data.nodeNumber, data.serviceIndex, 0)
      }catch(err){
        winston.error({message: name + `: REQUEST_DIAGNOSTICS: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_EVENT_VARIABLE', function(data){
      try{
        winston.info({message: `socketServer: REQUEST_EVENT_VARIABLE ${JSON.stringify(data)}`});
        node.sendREVAL(data.nodeNumber, data.eventIndex, data.eventVariableId)
      }catch(err){
        winston.error({message: name + `: REQUEST_EVENT_VARIABLE: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_LAYOUT_DATA', function(){
      try{
        winston.info({message: `socketServer: REQUEST_LAYOUT_DATA`});
        io.emit('LAYOUT_DATA', config.readLayoutData())
      }catch(err){
        winston.error({message: name + `: REQUEST_LAYOUT_DATA: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_LAYOUTS_LIST', function(){
      try{
        winston.info({message: `socketServer: REQUEST_LAYOUTS_LIST`});
        const layout_list = config.getListOfLayouts()
        io.emit('LAYOUTS_LIST', layout_list)
        winston.info({message: `socketServer: sent LAYOUTS_LIST ` + layout_list});
      }catch(err){
        winston.error({message: name + `: REQUEST_LAYOUTS_LIST: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_NODE_VARIABLE', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_NODE_VARIABLE ${JSON.stringify(data)}`});
        node.request_node_variable(data.nodeNumber, data.variableId)
      }catch(err){
        winston.error({message: name + `: REQUEST_NODE_VARIABLE: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_SERVICE_DISCOVERY', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_SERVICE_DISCOVERY ${JSON.stringify(data)}`});
        node.sendRQSD(data.nodeNumber, 0)
      }catch(err){
        winston.error({message: name + `: REQUEST_SERVICE_DISCOVERY: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_SERVER_STATUS', function(){
      try{
        //winston.debug({message: `socketServer: REQUEST_SERVER_STATUS`});
        send_SERVER_STATUS(config, status)
      }catch(err){
        winston.error({message: name + `: REQUEST_SERVER_STATUS: ${err}`});
      }
    })
      
    //
    //
    socket.on('REQUEST_MATCHING_MDF_LIST', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_MATCHING_MDF_LIST: ` + data.location})
        // uses synchronous file system calls
        var match = node.nodeConfig.nodes[data.nodeNumber].moduleIdentifier
        io.emit('MATCHING_MDF_LIST', data.location, data.nodeNumber, config.getMatchingMDFList(data.location, match))
      }catch(err){
        winston.error({message: name + `: REQUEST_MATCHING_MDF_LIST: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_MDF_EXPORT', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_MDF_EXPORT: ` + data.location + ' ' + data.filename})
        // uses synchronous file system calls
        var mdf = config.getMDF(data.location, data.filename)
        io.emit('MDF_EXPORT', data.location, data.filename, mdf)
        winston.info({message: name + `: emit MDF_EXPORT ${data.location} ${data.filename}`});
      }catch(err){
        winston.error({message: name + `: REQUEST_MDF_EXPORT: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_MDF_DELETE', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_MDF_DELETE: ` + data.filename})
        // uses synchronous file system calls
        config.deleteMDF(data.filename)
        // refresh matching list, if there's an associated nodeNumber
        if (data.nodeNumber != undefined){
          var match = node.nodeConfig.nodes[data.nodeNumber].moduleIdentifier
          io.emit('MATCHING_MDF_LIST', "USER", data.nodeNumber, config.getMatchingMDFList("USER", match))
        }
        node.refreshNodeDescriptors()   // force refresh
      }catch(err){
        winston.error({message: name + `: REQUEST_MDF_DELETE: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_NODE_DESCRIPTOR', function(data){
      try{
        winston.info({message: `socketServer:  REQUEST_NODE_DESCRIPTOR: ` + data.nodeNumber})
        // uses synchronous file system calls
      }catch(err){
        winston.error({message: name + `: REQUEST_NODE_DESCRIPTOR: ${err}`});
      }
    })

    //
    //
    socket.on('REQUEST_VERSION', function(){
      try{
        winston.info({message: `socketServer: REQUEST_VERSION`});
        let version = {
          'App': packageInfo.version,
          'API': '0.0.1',
          'node': process.version
        }
        io.emit('VERSION', version)
        winston.info({message: `socketServer: sent VERSION ${JSON.stringify(version)}`});
      }catch(err){
        winston.error({message: name + `: REQUEST_VERSION: ${err}`});
      }
    })

    //
    //
    socket.on('RESET_NODE', async function(nodeNumber){
      try{
        winston.info({message: name + `:  RESET_NODE ${nodeNumber}`});
        node.sendNNRST(nodeNumber)
        await sleep(2000)        // wait for module to reset 
        node.set_FCU_compatibility()
      }catch(err){
        winston.error({message: name + `: RESET_NODE: ${err}`});
      }
    })

    //
    //
    socket.on('RQNPN', function(data){ //Request Node Parameter
      try{
        winston.info({message: `socketServer:  RQNPN ${JSON.stringify(data)}`});
        node.sendRQNPN(data.nodeNumber, data.parameter)
      }catch(err){
        winston.error({message: name + `: RQNPN: ${err}`});
      }
    })

    //
    //
    socket.on('SAVE_SETTING', function(data){ //save setting to appSetting
      try{
        winston.info({message: name + `:  SAVE_SETTING ${JSON.stringify(data)}`})
        //winston.info({message: name + `:  SAVE_SETTING ${JSON.stringify(config.appSettings)}`})
        config.appSettings = Object.assign(config.appSettings, data)
        //winston.info({message: name + `:  SAVE_SETTING ${JSON.stringify(config.appSettings)}`})
        config.writeAppSettings()
      }catch(err){
        winston.error({message: name + `: SAVE_SETTING: ${err}`});
      }
    })
 
    //
    //
    socket.on('SAVE_BACKUP', function(data){ //save backup
      try{
        winston.info({message: `socketServer:  SAVE_BACKUP ${JSON.stringify(data.fileName)}`});
        config.writeBackup(data.layoutName, data.fileName, data.layout, node.nodeConfig)
      }catch(err){
        winston.error({message: name + `: SAVE_BACKUP: ${err}`});
      }
    })
 
    //
    //
    socket.on('SAVE_NODE_BACKUP', function(data){ //save backup
      try{
        winston.info({message: `socketServer:  SAVE_NODE_BACKUP ${JSON.stringify(data.nodeNumber)}`});
        config.writeNodeBackup(data.layoutName, data.nodeNumber, data.layout, data.backupNode)
      }catch(err){
        winston.error({message: name + `: SAVE_NODE_BACKUP: ${err}`});
      }
    })
 
    //
    //
    socket.on('SEND_CBUS_MESSAGE', function(data){
      try{
        winston.info({message: `socketServer: SEND_CBUS_MESSAGE ` + data});
        messageRouter.sendCbusMessage(data)
      }catch(err){
        winston.error({message: name + `: SEND_CBUS_MESSAGE: ${err}`});
      }
    })
    
    //
    //
    socket.on('SET_CAN_ID', function(data){
      try{
        winston.info({message: `socketServer: SET_CAN_ID ` + data});
        node.sendCANID(data.nodeNumber, data.CAN_ID)
      }catch(err){
        winston.error({message: name + `: SET_CAN_ID: ${err}`});
      }
    })
    
    //
    //
    socket.on('SET_NODE_NUMBER', function(nodeNumber){
      try{
        winston.info({message: `socketServer: SET_NODE_NUMBER ` + nodeNumber});
        node.sendSNN(nodeNumber)
        node.setNodeNumberIssued = true
      }catch(err){
        winston.error({message: name + `: SET_NODE_NUMBER: ${err}`});
      }
    })
    
    //
    //
    socket.on('START_CONNECTION', async function(connectionDetails){
      try{
        winston.info({message: name + `: START_CONNECTION ${JSON.stringify(connectionDetails)}`});
        status.busConnection.state = undefined
        if (connectionDetails.mode == 'Network'){
          // expect network CbusServer (or equivalent)
          winston.info({message: name + `: START_CONNECTION: Network mode `});
          config.setCbusServerHost(connectionDetails.host)
          config.setCbusServerPort(connectionDetails.hostPort)
        } else {
          // use inbuilt cbusServer
          config.setCbusServerHost('localhost')
          config.setCbusServerPort(5550)
          if(connectionDetails.mode == 'SerialPort'){
            winston.info({message: name + `: START_CONNECTION: SerialPort mode `});
            if(await cbusServer.connect(5550, connectionDetails.serialPort) == false){
              status.busConnection.state = false
              winston.info({message: name + `: START_CONNECTION: failed `});
            }
          } else {
            winston.info({message: name + `: START_CONNECTION: Auto mode `});
            // assume it's Auto mode
            if(await cbusServer.connect(5550, '') == false){
              status.busConnection.state = false
              winston.info({message: name + `: START_CONNECTION: failed `});
            }
          }
          winston.info({message: name + `: START_CONNECTION: using in-built cbusServer `});
        }
        // don't try futher connections if busConnection failed
        if (status.busConnection.state != false){
          // now connect the messageRouter to the configured CbusServer
          await messageRouter.connect(config.getCbusServerHost(), config.getCbusServerPort())
          await node.onConnect(connectionDetails);
          status.mode = 'RUNNING'
        }
      }catch(err){
        winston.error({message: name + `: START_CONNECTION: ${err}`});
      }
    })

    //
    //
    socket.on('STOP_SERVER', function(){
      try{
        winston.info({message: `socketServer: STOP_SERVER`});
        process.exit();
      }catch(err){
        winston.error({message: name + `: STOP_SERVER: ${err}`});
      }
    })
    
    //
    // write a single node variable
    // reLoad is a flag to indicate if node variable(s) need to be read back
    // we don't want to read any back if doing bulk programming (restoring a node)
    // linkedVariableList is a list of variables that need to be read back as well as the changed variable
    // if linkedVariableList not present, then just read the changed variable
    //
    socket.on('UPDATE_NODE_VARIABLE', function(data){
      try{
        node.sendNVSET(data.nodeNumber, data.variableId, data.variableValue)
        winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE ${JSON.stringify(data)}`});
        //
        // Only read variable(s) back if reLoad not false
        // but decide if just changed variable, or list
        if (data.reLoad != false){
          // just read back the variable we've changed
          node.request_node_variable(data.nodeNumber, data.variableId)
          //
          // now check if we need to read back linked variables
          if(data.linkedVariableList != undefined){
            for (let i = 0; i < data.linkedVariableList.length; i++) {
              node.request_node_variable(data.nodeNumber, data.linkedVariableList[i])
            }        
          }
        }
      }catch(err){
        winston.error({message: name + `: UPDATE_NODE_VARIABLE: ${err}`});
      }
    })

    //
    //
    socket.on('UPDATE_NODE_VARIABLE_IN_LEARN_MODE', function(data){
      try{
        winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE_IN_LEARN_MODE ${JSON.stringify(data)}`});
        node.update_node_variable_in_learnMode(data.nodeNumber, data.variableId, data.variableValue)
        //
        // Only read variable(s) back if reLoad not false
        // but decide if just changed variable, or list
        if (data.reLoad != false){
          // just read back the variable we've changed
          node.request_node_variable(data.nodeNumber, data.variableId)
          //
          // now check if we need to read back linked variables
          if(data.linkedVariableList != undefined){
            for (let i = 0; i < data.linkedVariableList.length; i++) {
              node.request_node_variable(data.nodeNumber, data.linkedVariableList[i])
            }        
          }
        }
      }catch(err){
        winston.error({message: name + `: UPDATE_NODE_VARIABLE_IN_LEARN_MODE: ${err}`});
      }
    })

    //
    //
    socket.on('UPDATE_LAYOUT_DATA', function(data){
      try{
        winston.info({message: `socketServer: UPDATE_LAYOUT_DATA`});
        config.writeLayoutData(data)
        // add any new nodes
        node.addLayoutNodes(node.config.readLayoutData())
        io.emit('LAYOUT_DATA', data)    // refresh client, so pages can respond
      }catch(err){
        winston.error({message: name + `: UPDATE_LAYOUT_DATA: ${err}`});
      }
    })
      
  });

  //*************************************************************************************** */
  //
  // General functions to send to web socket clients
  //
  //*************************************************************************************** */

  //
  //
  function send_SERVER_STATUS(config, status){
    status["currentUserDirectory"] = config.currentUserDirectory
    status["appStorageDirectory"] = config.appStorageDirectory
    status["customUserDirectory"] = config.appSettings.customUserDirectory
    status["singleUserDirectory"] = config.singleUserDirectory
    status["systemDirectory"] = config.systemDirectory
    status["appSettings"] = config.appSettings
    status["opcodeTracker"] = node.opcodeTracker 
  //  winston.debug({message: name + ': send SERVER_STATUS ' + JSON.stringify(status)});
    io.emit('SERVER_STATUS', status)
  }
  
  //
  //
  function send_SERVER_MESSAGE(message){
    winston.debug({message: name + ': send_SERVER_MESSAGE ' + JSON.stringify(message)});

    io.emit('SERVER_MESSAGE', message)
  }
  
  //
  //      
  server.listen(config.getSocketServerPort(), () => console.log(`SS: Server running on port ${config.getSocketServerPort()}`))

  //*************************************************************************************** */
  //
  // events from cbusAdminNode
  //
  //*************************************************************************************** */

  //
  //
  node.on('cbusError', function (cbusErrors) {
    winston.info({message: `socketServer: CBUS - ERROR :${JSON.stringify(cbusErrors)}`});
    io.emit('CBUS_ERRORS', cbusErrors);
  })

  //
  //
  node.on('cbusNoSupport', function (cbusNoSupport) {
    winston.info({message: `socketServer: CBUS_NO_SUPPORT sent`});
    winston.debug({message: `socketServer: CBUS_NO_SUPPORT - Op Code Unknown : ${cbusNoSupport.opCode}`});
    io.emit('CBUS_NO_SUPPORT', cbusNoSupport);
  })


  //
  //
  node.on('dccError', function (error) {
    winston.info({message: `socketServer: DCC_ERROR sent`});
    io.emit('DCC_ERROR', error);
  })

  //
  //
  node.on('dccSessions', function (dccSessions) {
    winston.info({message: `socketServer: DCC_SESSIONS sent`});
    io.emit('DCC_SESSIONS', dccSessions);
  })

  //
  //
  node.on('events', function (events) {
    winston.info({message: `socketServer: EVENTS sent`});
    //winston.debug({message: `socketServer: EVENTS :${JSON.stringify(events)}`});
    io.emit('BUS_EVENTS', events);
  })

  //
  //
  node.on('node', function (node) {
    winston.info({message: `socketServer: Node ${node.nodeNumber} Sent to client `});
    //winston.info({message: `socketServer: Node Sent ` + JSON.stringify(node)});
    io.emit('NODE', node);
  })

  //
  //
  node.on('nodes', function (nodes) {
    winston.info({message: `socketServer: NODES Sent`});
    io.emit('NODES', nodes);
  })

  //
  //
  node.on('nodeDescriptor', function (nodeDescriptor) {
    winston.info({message: `socketServer: NodeDescriptor Sent`});
    //winston.debug({message: `socketServer: NodeDescriptor Sent : ` + JSON.stringify(nodeDescriptor)});
    io.emit('NODE_DESCRIPTOR', nodeDescriptor);
  })

  //
  //
  node.on('node_descriptor_file_list', function (nodeNumber, list) {
    winston.info({message: `socketServer: NODE_DESCRIPTOR_FILE_LIST Sent nodeNumber ` + nodeNumber});
    io.emit('NODE_DESCRIPTOR_FILE_LIST', nodeNumber, list);
  })

  //
  //
  node.on('requestNodeNumber', function (nodeNumber, name) {
    winston.info({message: `socketServer: REQUEST_NODE_NUMBER sent - previous nodeNumber ` + nodeNumber + '  Name ' + name});
    io.emit('REQUEST_NODE_NUMBER', nodeNumber, name)
  })

  //*************************************************************************************** */
  //
  // eventBus events
  //
  //*************************************************************************************** */

  //
  //
  config.eventBus.on('CBUS_TRAFFIC', function (data) {
    winston.debug({message: name + `: eventBus: CBUS_TRAFFIC: ${data.direction} ${data.json.text}` });
    io.emit('CBUS_TRAFFIC', data);
  })

  // data JSON elements: message, caption, type, timeout
  //
  config.eventBus.on('NETWORK_CONNECTION_FAILURE', function (data) {
    winston.info({message: `socketServer: NETWORK_CONNECTION_FAILURE: ${JSON.stringify(data)}`});
    io.emit('NETWORK_CONNECTION_FAILURE', data)
  })

  // 
  //
  config.eventBus.on('NODE_BACKUP_SAVED', function (filename) {
    winston.info({message: `socketServer: NODE_BACKUP_SAVED: ${filename}`});
    io.emit('NODE_BACKUP_SAVED', filename)
  })
  
  // data JSON elements: message, caption, type, timeout
  //
  config.eventBus.on('SERVER_NOTIFICATION', function (data) {
    winston.info({message: `socketServer: SERVER_NOTIFICATION: ${JSON.stringify(data)}`});
    io.emit('SERVER_NOTIFICATION', data)
  })

  // data JSON elements: message, caption, type, timeout
  //
  config.eventBus.on('SERIAL_CONNECTION_FAILURE', function (data) {
    winston.info({message: `socketServer: SERIAL_CONNECTION_FAILURE: ${JSON.stringify(data)}`});
    io.emit('SERIAL_CONNECTION_FAILURE', data)
  })

  //*************************************************************************************** */
  //
  // events from programNode
  //
  //*************************************************************************************** */

  //
  //
  programNode.on('programNode_progress', function (data) {
    let downloadData = data;
    winston.info({message: name + ': programNode event: ' + downloadData.text});
    io.emit('PROGRAM_NODE_PROGRESS', downloadData.text)
  });	        

}





