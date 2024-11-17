const winston = require('winston');		// use config from root instance
const name = 'socketServer'
const jsonfile = require('jsonfile')
const packageInfo = require(process.cwd()+'/package.json')

const server = require('http').createServer()



const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});

function send_SERVER_STATUS(config, status){
  status["userDirectory"] = config.userConfigPath
  status["systemDirectory"] = config.systemConfigPath
//  winston.debug({message: name + ': send SERVER_STATUS ' + JSON.stringify(status)});
  io.emit('SERVER_STATUS', status)
}



exports.socketServer = function(config, node, jsonServer, cbusServer, programNode, status) {

  io.on('connection', function(socket){
    winston.info({message: 'socketServer:  a user connected'});
    send_SERVER_STATUS(config, status)
    if (status.mode == "RUNNING"){
      // let the client know the current layout & nodes as we're already running
      io.emit('LAYOUT_DATA', config.readLayoutData())
      node.query_all_nodes()
//      io.emit('NODES', node.nodeConfig.nodes);
    }
    
    socket.on('ACCESSORY_LONG_OFF', function(data){
      winston.info({message: name + `: ACCESSORY_LONG_OFF ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.eventNumber != undefined)){
          node.CBUS_Queue.push(node.ACOF(data.nodeNumber, data.eventNumber))
        } else { winston.warn({message: name + `: ACCESSORY_LONG_OFF - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_LONG_OFF - missing arguments`});
      }
    })

    socket.on('ACCESSORY_LONG_ON', function(data){
      winston.info({message: name + `: ACCESSORY_LONG_ON ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.eventNumber != undefined)){
          node.CBUS_Queue.push(node.ACON(data.nodeNumber, data.eventNumber))
        } else { winston.warn({message: name + `: ACCESSORY_LONG_ON - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_LONG_ON - missing arguments`});
      }
    })

    socket.on('ACCESSORY_SHORT_OFF', function(data){
      winston.info({message: `socketServer: ACCESSORY_SHORT_OFF ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.deviceNumber != undefined)){
          node.CBUS_Queue.push(node.ASOF(data.nodeNumber, data.deviceNumber))
        } else { winston.warn({message: name + `: ACCESSORY_SHORT_OFF - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_SHORT_OFF - missing arguments`});
      }
    })

    socket.on('ACCESSORY_SHORT_ON', function(data){
      winston.info({message: `socketServer: ACCESSORY_SHORT_ON ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.deviceNumber != undefined)){
          node.CBUS_Queue.push(node.ASON(data.nodeNumber, data.deviceNumber))
        } else { winston.warn({message: name + `: ACCESSORY_SHORT_ON - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_SHORT_ON - missing arguments`});
      }
    })

    socket.on('CANID_ENUM', function(nodeNumber){
      winston.info({message: name + `:  CANID_ENUM ${nodeNumber}`});
      node.CBUS_Queue.push(node.ENUM(nodeNumber))
    })

    socket.on('CHANGE_LAYOUT', function(data){
      winston.info({message: `socketServer: CHANGE_LAYOUT ` + data});
      config.setCurrentLayoutFolder(data)
      io.emit('LAYOUT_DATA', config.readLayoutData())
    })

    socket.on('CLEAR_CBUS_ERRORS', function(){
      winston.info({message: `socketServer: CLEAR_CBUS_ERRORS`});
      node.clearCbusErrors();
    })
      
    socket.on('CLEAR_BUS_EVENTS', function(){
      winston.info({message: `socketServer: CLEAR_BUS_EVENTS`});
      node.clearEvents();
    })

    socket.on('CLEAR_NODE_EVENTS', function(data){
      winston.info({message: `socketServer: CLEAR_NODE_EVENTS ${data.nodeNumber}`});
      node.removeNodeEvents(data.nodeNumber);
    })

    socket.on('DELETE_ALL_EVENTS', async function(data){
      winston.info({message: name + `: DELETE_ALL_EVENTS ${JSON.stringify(data.nodeNumber)}`});
      await node.delete_all_events(data.nodeNumber)
      node.removeNodeEvents(data.nodeNumber)                   // clear node structure of events
      await node.request_all_node_events(data.nodeNumber) // now refresh
    })

    socket.on('DELETE_LAYOUT', function(data){
      winston.info({message: name + `: DELETE_LAYOUT ${JSON.stringify(data.layoutName)}`});
      config.deleteLayoutFolder(data.layoutName)
    })

    socket.on('EVENT_TEACH_BY_IDENTIFIER', async function(data){
      winston.info({message: `socketServer: EVENT_TEACH_BY_IDENTIFIER ${JSON.stringify(data)}`});
      await node.event_teach_by_identifier(data.nodeNumber, data.eventIdentifier, data.eventVariableIndex, data.eventVariableValue)
    })

    socket.on('IMPORT_MODULE_DESCRIPTOR', function(data){
      var filename = data.moduleDescriptor.moduleDescriptorFilename
      winston.info({message: 'socketServer: IMPORT_MODULE_DESCRIPTOR ' + data.nodeNumber + ' ' + filename});
      config.writeModuleDescriptor(data.moduleDescriptor)
      node.refreshNodeDescriptors()   // force refresh of nodeDescriptors
      // refresh matching list, if there's an associated nodeNumber
      if (data.nodeNumber != undefined){
        var match = node.nodeConfig.nodes[data.nodeNumber].moduleIdentifier
        io.emit('MATCHING_MDF_LIST', "USER", data.nodeNumber, config.getMatchingMDFList("USER", match))
      }
    })

    socket.on('PROGRAM_NODE', function(data){
      winston.info({message: 'socketServer:  PROGRAM_NODE: nodeNumber ' + data.nodeNumber});
      programNode.program(data.nodeNumber, data.cpuType, data.flags, data.hexFile)
    })

    socket.on('QUERY_ALL_NODES', function(){
      winston.info({message: 'socketServer:  QUERY_ALL_NODES'});
      node.query_all_nodes()
    })

    socket.on('REMOVE_EVENT', async function(data){
      winston.info({message: `socketServer: REMOVE_EVENT ${JSON.stringify(data)}`});
      await node.event_unlearn(data.nodeNumber, data.eventName)
      node.removeNodeEvent(data.nodeNumber, data.eventName)
      await node.request_all_node_events(data.nodeNumber) // now refresh
    })

    socket.on('REMOVE_NODE', function(nodeNumber){
      winston.info({message: `socketServer: REMOVE_NODE ${nodeNumber}`});
      if (nodeNumber != undefined){
        node.remove_node(nodeNumber)
      }
    })

    socket.on('REQUEST_ALL_EVENT_VARIABLES', function(data){
      winston.info({message: `socketServer:  REQUEST_ALL_EVENT_VARIABLES ${JSON.stringify(data)}`});
      node.requestEventVariablesByIndex(data.nodeNumber, data.eventIndex, data.variables)
    })

    socket.on('REQUEST_EVENT_VARIABLES_BY_IDENTIFIER', function(data){
      winston.info({message: `socketServer:  REQUEST_EVENT_VARIABLES_BY_IDENTIFIER ${JSON.stringify(data)}`});
      node.requestEventVariablesByIdentifier(data.nodeNumber, data.eventIdentifier)
    })

    socket.on('REQUEST_ALL_NODE_EVENTS', function(data){
      winston.info({message: `socketServer:  REQUEST_ALL_NODE_EVENTS ${JSON.stringify(data)}`});
      if (data.nodeNumber != undefined){
        node.request_all_node_events(data.nodeNumber)
      }
    })

    socket.on('REQUEST_ALL_NODE_PARAMETERS', function(data){ //Request Node Parameter
      winston.info({message: `socketServer:  REQUEST_ALL_NODE_PARAMETERS ${JSON.stringify(data)}`});
      node.request_all_node_parameters(data.nodeNumber)
    })

    socket.on('REQUEST_ALL_NODE_VARIABLES', function(data){
      winston.info({message: `socketServer:  REQUEST_ALL_NODE_VARIABLES ${JSON.stringify(data)}`})
      if (data.start === undefined) {
          data.start = 1
      }
      node.request_all_node_variables(data.nodeNumber, data.start)
    })

    socket.on('REQUEST_BACKUPS_LIST', function(data){
      winston.info({message: `socketServer: REQUEST_BACKUPS_LIST`});
      const backups_list = config.getListOfBackups(data.layoutName)
      io.emit('BACKUPS_LIST', backups_list)
      winston.info({message: `socketServer: sent BACKUPS_LIST ` + backups_list});
    })

    socket.on('REQUEST_BUS_CONNECTION', function(){
//      winston.debug({message: `socketServer: REQUEST_BUS_CONNECTION`});
      io.emit('BUS_CONNECTION', status.busConnection)
//      winston.debug({message: `socketServer: sent BUS_CONNECTION`});
    })

    socket.on('REQUEST_BUS_EVENTS', function(){
      winston.info({message: `socketServer: REQUEST_BUS_EVENTS`});
      node.refreshEvents();
    })

    socket.on('REQUEST_DIAGNOSTICS', function(data){
      winston.info({message: `socketServer:  REQUEST_DIAGNOSTICS ${JSON.stringify(data)}`});
      if (data.serviceIndex == undefined){data.serviceIndex = 0;}
      node.CBUS_Queue.push(node.RDGN(data.nodeNumber, data.serviceIndex, 0))
    })

    socket.on('REQUEST_EVENT_VARIABLE', function(data){
      winston.info({message: `socketServer: REQUEST_EVENT_VARIABLE ${JSON.stringify(data)}`});
      node.CBUS_Queue.push(node.REVAL(data.nodeNumber, data.eventIndex, data.eventVariableId))
    })

    socket.on('REQUEST_LAYOUT_DATA', function(){
      winston.info({message: `socketServer: REQUEST_LAYOUT_DATA`});
      io.emit('LAYOUT_DATA', config.readLayoutData())
    })

    socket.on('REQUEST_LAYOUTS_LIST', function(){
      winston.info({message: `socketServer: REQUEST_LAYOUTS_LIST`});
      const layout_list = config.getListOfLayouts()
      io.emit('LAYOUTS_LIST', layout_list)
      winston.info({message: `socketServer: sent LAYOUTS_LIST ` + layout_list});
    })

    socket.on('REQUEST_NODE_VARIABLE', function(data){
      winston.info({message: `socketServer:  REQUEST_NODE_VARIABLE ${JSON.stringify(data)}`});
      node.CBUS_Queue.push(node.NVRD(data.nodeNumber, data.variableId))
    })

    socket.on('REQUEST_SERVICE_DISCOVERY', function(data){
      winston.info({message: `socketServer:  REQUEST_SERVICE_DISCOVERY ${JSON.stringify(data)}`});
      node.CBUS_Queue.push(node.RQSD(data.nodeNumber, 0))
    })

    socket.on('REQUEST_SERVER_STATUS', function(){
    //      winston.debug({message: `socketServer: REQUEST_SERVER_STATUS`});
      send_SERVER_STATUS(config, status)
    })
      

    socket.on('REQUEST_MATCHING_MDF_LIST', function(data){
      winston.info({message: `socketServer:  REQUEST_MATCHING_MDF_LIST: ` + data.location})
      // uses synchronous file system calls
      var match = node.nodeConfig.nodes[data.nodeNumber].moduleIdentifier
      io.emit('MATCHING_MDF_LIST', data.location, data.nodeNumber, config.getMatchingMDFList(data.location, match))
    })


    socket.on('REQUEST_MDF_EXPORT', function(data){
      winston.info({message: `socketServer:  REQUEST_MDF_EXPORT: ` + data.location + ' ' + data.filename})
      // uses synchronous file system calls
      var mdf = config.getMDF(data.location, data.filename)
      io.emit('MDF_EXPORT', data.location, data.filename, mdf)
      winston.info({message: name + `: emit MDF_EXPORT ${data.location} ${data.filename}`});
    })


    socket.on('REQUEST_MDF_DELETE', function(data){
      winston.info({message: `socketServer:  REQUEST_MDF_DELETE: ` + data.filename})
      // uses synchronous file system calls
      config.deleteMDF(data.filename)
      node.refreshNodeDescriptors()   // force refresh
    })


    socket.on('REQUEST_NODE_DESCRIPTOR', function(data){
      winston.info({message: `socketServer:  REQUEST_NODE_DESCRIPTOR: ` + data.nodeNumber})
      // uses synchronous file system calls
    })


    socket.on('REQUEST_VERSION', function(){
      winston.info({message: `socketServer: REQUEST_VERSION`});
      let version = {
        'App': packageInfo.version,
        'API': '0.0.1',
        'node': process.version
      }
      io.emit('VERSION', version)
      winston.info({message: `socketServer: sent VERSION ${JSON.stringify(version)}`});
    })

    socket.on('RESET_NODE', function(nodeNumber){
      winston.info({message: name + `:  RESET_NODE ${nodeNumber}`});
      node.CBUS_Queue.push(node.NNRST(nodeNumber))
    })

    socket.on('RQNPN', function(data){ //Request Node Parameter
      winston.info({message: `socketServer:  RQNPN ${JSON.stringify(data)}`});
      node.CBUS_Queue.push(node.RQNPN(data.nodeNumber, data.parameter))
    })

    socket.on('SAVE_BACKUP', function(data){ //save backup
      winston.info({message: `socketServer:  SAVE_BACKUP ${JSON.stringify(data.fileName)}`});
      config.writeBackup(data.layoutName, data.fileName, data.layout, node.nodeConfig)
    })
 
    socket.on('SET_CAN_ID', function(data){
      winston.info({message: `socketServer: SET_CAN_ID ` + data});
      node.CBUS_Queue.push(node.CANID(data.nodeNumber, data.CAN_ID))
    })
    
    socket.on('SET_NODE_NUMBER', function(nodeNumber){
      winston.info({message: `socketServer: SET_NODE_NUMBER ` + nodeNumber});
      node.CBUS_Queue.push(node.SNN(nodeNumber))
      node.setNodeNumberIssued = true
    })
    
    socket.on('START_CONNECTION', async function(data){
      winston.info({message: name + `: START_CONNECTION ${JSON.stringify(data)}`});
      if (data.mode == 'Network'){
        winston.info({message: name + `: START_CONNECTION: Network mode `});
        await jsonServer.connect(data.host, data.hostPort)
      } else {
        if(data.mode == 'SerialPort'){
          winston.info({message: name + `: START_CONNECTION: SerialPort mode `});
          if(await cbusServer.connect(5550, data.serialPort) == false){
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

        // using local address
        winston.info({message: name + `: START_CONNECTION: connect JsonServer using local `});
        await jsonServer.connect(config.getRemoteAddress(), config.getCbusServerPort())
      }
      await node.connect(config.getServerAddress(), config.getJsonServerPort());
      programNode.setConnection(config.getServerAddress(), config.getJsonServerPort());
      status.mode = 'RUNNING'
    })

    socket.on('STOP_SERVER', function(){
      winston.info({message: `socketServer: STOP_SERVER`});
      process.exit();
    })
    
    socket.on('UPDATE_NODE_VARIABLE', function(data){
      node.CBUS_Queue.push(node.NVSET(data.nodeNumber, data.variableId, data.variableValue))
      winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE ${JSON.stringify(data)}`});
        setTimeout(function() {node.CBUS_Queue.push(node.NVRD(data.nodeNumber, data.variableId))},50)
    })

    socket.on('UPDATE_NODE_VARIABLE_IN_LEARN_MODE', function(data){
      winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE_IN_LEARN_MODE ${JSON.stringify(data)}`});
      node.CBUS_Queue.push(node.NNLRN(data.nodeNumber))
      node.CBUS_Queue.push(node.NVSET(data.nodeNumber, data.variableId, data.variableValue))
      node.CBUS_Queue.push(node.NNULN(data.nodeNumber))
      node.CBUS_Queue.push(node.NVRD(data.nodeNumber, data.variableId))
      node.CBUS_Queue.push(node.NNULN(data.nodeNumber))
    })

    socket.on('UPDATE_LAYOUT_DATA', function(data){
      winston.info({message: `socketServer: UPDATE_LAYOUT_DATA`});
//      winston.debug({message: `socketServer: UPDATE_LAYOUT_DATA ${JSON.stringify(data)}`});
      config.writeLayoutData(data)
      io.emit('LAYOUT_DATA', data)    // refresh client, so pages can respond
    })
      
  });


    
  server.listen(config.getSocketServerPort(), () => console.log(`SS: Server running on port ${config.getSocketServerPort()}`))

  //*************************************************************************************** */
  //
  // events from cbusAdminNode
  //
  //*************************************************************************************** */

  node.on('cbusError', function (cbusErrors) {
    winston.info({message: `socketServer: CBUS - ERROR :${JSON.stringify(cbusErrors)}`});
    io.emit('CBUS_ERRORS', cbusErrors);
  })


  node.on('cbusNoSupport', function (cbusNoSupport) {
    winston.info({message: `socketServer: CBUS_NO_SUPPORT sent`});
    winston.debug({message: `socketServer: CBUS_NO_SUPPORT - Op Code Unknown : ${cbusNoSupport.opCode}`});
    io.emit('CBUS_NO_SUPPORT', cbusNoSupport);
  })


  node.on('cbusTraffic', function (data) {
    winston.info({message: `socketServer: cbusTraffic : ` + data.direction + " : " + data.json.text});
//    winston.debug({message: `socketServer: cbusTraffic : ` + data.direction + " : " + JSON.stringify(data.json)});
    io.emit('CBUS_TRAFFIC', data);
  })


  node.on('dccError', function (error) {
    winston.info({message: `socketServer: DCC_ERROR sent`});
    io.emit('DCC_ERROR', error);
  })


  node.on('dccSessions', function (dccSessions) {
    winston.info({message: `socketServer: DCC_SESSIONS sent`});
    io.emit('DCC_SESSIONS', dccSessions);
  })


  node.on('events', function (events) {
    winston.info({message: `socketServer: EVENTS sent`});
//    winston.debug({message: `socketServer: EVENTS :${JSON.stringify(events)}`});
    io.emit('BUS_EVENTS', events);
  })


  node.on('node', function (node) {
    winston.info({message: `socketServer: Node Sent `});
//    winston.info({message: `socketServer: Node Sent ` + JSON.stringify(node)});
    io.emit('NODE', node);
  })


  node.on('nodes', function (nodes) {
    winston.info({message: `socketServer: NODES Sent`});
    io.emit('NODES', nodes);
  })


  node.on('nodeDescriptor', function (nodeDescriptor) {
    winston.info({message: `socketServer: NodeDescriptor Sent`});
//    winston.debug({message: `socketServer: NodeDescriptor Sent : ` + JSON.stringify(nodeDescriptor)});
    io.emit('NODE_DESCRIPTOR', nodeDescriptor);
  })


  node.on('node_descriptor_file_list', function (nodeNumber, list) {
    winston.info({message: `socketServer: NODE_DESCRIPTOR_FILE_LIST Sent nodeNumber ` + nodeNumber});
    io.emit('NODE_DESCRIPTOR_FILE_LIST', nodeNumber, list);
  })


  node.on('requestNodeNumber', function (nodeNumber) {
    winston.info({message: `socketServer: REQUEST_NODE_NUMBER sent - previous nodeNumber ` + nodeNumber});
    io.emit('REQUEST_NODE_NUMBER', nodeNumber)
  })


  //*************************************************************************************** */
  //
  // events from jsonServer
  //
  //*************************************************************************************** */

  config.eventBus.on('bus_connection_state', function (state) {
    winston.info({message: `socketServer: bus_connection_state: ` + state});
    status.busConnection.state = state
  })


  //*************************************************************************************** */
  //
  // events from programNode
  //
  //*************************************************************************************** */

  programNode.on('programNode_progress', function (data) {
    downloadData = data;
    winston.info({message: name + ': programNode event: ' + downloadData.text});
    io.emit('PROGRAM_NODE_PROGRESS', downloadData.text)
  });	        

}





