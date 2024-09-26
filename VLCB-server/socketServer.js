const winston = require('winston');		// use config from root instance
const name = 'socketServer'
const jsonfile = require('jsonfile')
const packageInfo = require(process.cwd()+'/package.json')

const admin = require('./mergAdminNode.js')
const server = require('http').createServer()
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});



exports.socketServer = function(config, status) {
let layoutData = config.readLayoutData()
let node = new admin.cbusAdmin(config);
//let jsServer = jsonServer.jsonServer(config)

  io.on('connection', function(socket){
    winston.info({message: 'socketServer:  a user connected'});
    node.query_all_nodes()
    io.emit('LAYOUT_DATA', layoutData)
    

    //=============================================================================================
    //
    // Incoming web socket messages
    //
    //=============================================================================================

    socket.on('ACCESSORY_LONG_OFF', function(data){
      winston.info({message: name + `: ACCESSORY_LONG_OFF ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.eventNumber != undefined)){
          node.cbusSend(node.ACOF(data.nodeNumber, data.eventNumber))
        } else { winston.warn({message: name + `: ACCESSORY_LONG_OFF - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_LONG_OFF - missing arguments`});
      }
    })

    socket.on('ACCESSORY_LONG_ON', function(data){
      winston.info({message: name + `: ACCESSORY_LONG_ON ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.eventNumber != undefined)){
          node.cbusSend(node.ACON(data.nodeNumber, data.eventNumber))
        } else { winston.warn({message: name + `: ACCESSORY_LONG_ON - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_LONG_ON - missing arguments`});
      }
    })

    socket.on('ACCESSORY_SHORT_OFF', function(data){
      winston.info({message: `socketServer: ACCESSORY_SHORT_OFF ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.deviceNumber != undefined)){
          node.cbusSend(node.ASOF(data.nodeNumber, data.deviceNumber))
        } else { winston.warn({message: name + `: ACCESSORY_SHORT_OFF - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_SHORT_OFF - missing arguments`});
      }
    })

    socket.on('ACCESSORY_SHORT_ON', function(data){
      winston.info({message: `socketServer: ACCESSORY_SHORT_ON ${JSON.stringify(data)}`});
      if (data) { 
        if((data.nodeNumber != undefined) && (data.deviceNumber != undefined)){
          node.cbusSend(node.ASON(data.nodeNumber, data.deviceNumber))
        } else { winston.warn({message: name + `: ACCESSORY_SHORT_ON - missing arguments`}); }
      } else {
        winston.warn({message: name + `: ACCESSORY_SHORT_ON - missing arguments`});
      }
    })

    socket.on('CHANGE_LAYOUT', function(data){
      winston.info({message: `socketServer: CHANGE_LAYOUT ` + data});
      config.setCurrentLayoutFolder(data)
      layoutData = config.readLayoutData()
      io.emit('LAYOUT_DATA', layoutData)
      node.query_all_nodes()  // refresh all node data to fill new layout
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

    socket.on('DELETE_ALL_EVENTS', function(data){
      winston.info({message: name + `: DELETE_ALL_EVENTS ${JSON.stringify(data.nodeNumber)}`});
      node.delete_all_events(data.nodeNumber)
    })

    socket.on('EVENT_TEACH_BY_IDENTIFIER', function(data){
      winston.info({message: `socketServer: EVENT_TEACH_BY_IDENTIFIER ${JSON.stringify(data)}`});
      node.event_teach_by_identifier(data.nodeNumber, data.eventIdentifier, data.eventVariableIndex, data.eventVariableValue)
    })

    socket.on('IMPORT_MODULE_DESCRIPTOR', function(data){
      winston.info({message: 'socketServer: IMPORT_MODULE_DESCRIPTOR'});
      config.writeModuleDescriptor(data)
      node.query_all_nodes()  // force refresh of nodeDescriptors
    })

    socket.on('REMOVE_EVENT', function(data){
      winston.info({message: `socketServer: REMOVE_EVENT ${JSON.stringify(data)}`});
      node.remove_event(data.nodeNumber, data.eventName)
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

    socket.on('QUERY_ALL_NODES', function(){
      winston.info({message: 'socketServer:  QUERY_ALL_NODES'});
      node.query_all_nodes()
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
      winston.debug({message: `socketServer: REQUEST_BUS_CONNECTION`});
      io.emit('BUS_CONNECTION', status.busConnection)

      winston.debug({message: `socketServer: sent BUS_CONNECTION`});
    })

    socket.on('REQUEST_BUS_EVENTS', function(){
      winston.info({message: `socketServer: REQUEST_BUS_EVENTS`});
      node.refreshEvents();
    })

    socket.on('REQUEST_DIAGNOSTICS', function(data){
      winston.info({message: `socketServer:  REQUEST_DIAGNOSTICS ${JSON.stringify(data)}`});
      if (data.serviceIndex == undefined){data.serviceIndex = 0;}
      node.cbusSend(node.RDGN(data.nodeNumber, data.serviceIndex, 0))
    })

    socket.on('REQUEST_EVENT_VARIABLE', function(data){
      winston.info({message: `socketServer: REQUEST_EVENT_VARIABLE ${JSON.stringify(data)}`});
      node.cbusSend(node.REVAL(data.nodeNumber, data.eventIndex, data.eventVariableId))
    })

    socket.on('REQUEST_LAYOUTS_LIST', function(){
      winston.info({message: `socketServer: REQUEST_LAYOUTS_LIST`});
      const layout_list = config.getListOfLayouts()
      io.emit('LAYOUTS_LIST', layout_list)
      winston.info({message: `socketServer: sent LAYOUTS_LIST ` + layout_list});
    })

    socket.on('REQUEST_NODE_VARIABLE', function(data){
      winston.info({message: `socketServer:  REQUEST_NODE_VARIABLE ${JSON.stringify(data)}`});
        node.cbusSend(node.NVRD(data.nodeNumber, data.variableId))
    })

    socket.on('REQUEST_SERVICE_DISCOVERY', function(data){
      winston.info({message: `socketServer:  REQUEST_SERVICE_DISCOVERY ${JSON.stringify(data)}`});
      node.cbusSend(node.RQSD(data.nodeNumber, 0))
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

    socket.on('RQNPN', function(data){ //Request Node Parameter
      winston.info({message: `socketServer:  RQNPN ${JSON.stringify(data)}`});
      node.cbusSend(node.RQNPN(data.nodeNumber, data.parameter))
    })

    socket.on('SAVE_BACKUP', function(data){ //save backup
      winston.info({message: `socketServer:  SAVE_BACKUP ${JSON.stringify(data.fileName)}`});
      config.writeBackup(data.layoutName, data.fileName, data.layout, node.nodeConfig)
    })
 
    socket.on('SET_NODE_NUMBER', function(nodeNumber){
      winston.info({message: `socketServer: SET_NODE_NUMBER ` + nodeNumber});
      node.cbusSend(node.SNN(nodeNumber))
    })
    
    socket.on('STOP_SERVER', function(){
      winston.info({message: `socketServer: STOP_SERVER`});
      process.exit();
    })
    
    socket.on('TEACH_EVENT', function(data){
      winston.info({message: `socketServer: TEACH_EVENT ${JSON.stringify(data)}`});
      node.teach_event(data.nodeNumber, data.eventName, 1, 0)
    })

    socket.on('UPDATE_EVENT_VARIABLE', function(data){
      winston.info({message: `socketServer: UPDATE_EVENT_VARIABLE ${JSON.stringify(data)}`});
      node.update_event_variable(data)
    })

    socket.on('UPDATE_NODE_VARIABLE', function(data){
      node.cbusSend(node.NVSET(data.nodeNumber, data.variableId, data.variableValue))
      winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE ${JSON.stringify(data)}`});
        setTimeout(function() {node.cbusSend(node.NVRD(data.nodeNumber, data.variableId))},50)
    })

    socket.on('UPDATE_NODE_VARIABLE_IN_LEARN_MODE', function(data){
      winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE_IN_LEARN_MODE ${JSON.stringify(data)}`});
      node.cbusSend(node.NNLRN(data.nodeNumber))
      node.cbusSend(node.NVSET(data.nodeNumber, data.variableId, data.variableValue))
      node.cbusSend(node.NNULN(data.nodeNumber))
      node.cbusSend(node.NVRD(data.nodeNumber, data.variableId))
      node.cbusSend(node.NNULN(data.nodeNumber))
    })

    socket.on('UPDATE_LAYOUT_DATA', function(data){
      winston.info({message: `socketServer: UPDATE_LAYOUT_DATA`});
      winston.debug({message: `socketServer: UPDATE_LAYOUT_DATA ${JSON.stringify(data)}`});
//      layoutDetails = data
      config.writeLayoutData(data)
      io.emit('LAYOUT_DATA', data)
    })
      
/*    
    socket.on('PROGRAM_NODE', function(data){
      let buff = Buffer.from(data.encodedIntelHex, 'base64');
      let intelhexString = buff.toString('ascii');
      winston.info({message: `socketServer: PROGRAM_NODE; intel hex ` + intelhexString});
      programNode.program(data.nodeNumber, data.cpuType, data.flags, intelhexString);
    })
          
    socket.on('PROGRAM_BOOT_MODE', function(data){
      let buff = Buffer.from(data.encodedIntelHex, 'base64');
      let intelhexString = buff.toString('ascii');
      winston.info({message: `socketServer: PROGRAM_BOOT_MODE; intel hex ` + intelhexString});
      programNode.programBootMode(data.cpuType, data.flags, intelhexString);
    })
*/

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
    winston.debug({message: `socketServer: cbusTraffic : ` + data.direction + " : " + JSON.stringify(data.json)});
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


  node.on('layoutData', function (data) {
    layoutData = data
    winston.info({message: `socketServer: send LAYOUT_DATA`});
    io.emit('LAYOUT_DATA', layoutData)
  })


  node.on('node', function (node) {
    winston.info({message: `socketServer: Node Sent `});
//    winston.info({message: `socketServer: Node Sent ` + JSON.stringify(node)});
    io.emit('NODE', node);
    if(node.nodeNumber != undefined) {
      if (update_nodeName(config, node.nodeNumber, layoutData)) {
        io.emit('LAYOUT_DATA', layoutData)
        winston.info({message: `socketServer: nodeName updated, LAYOUT_DATA Sent`});
      }
    }
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


  /*programNode.on('programNode', function (data) {
  winston.info({message: `WSSERVER: 'programNode' : ` + data});
      io.emit('PROGRAM_NODE', data);
  })*/

  //*************************************************************************************** */
  //
  // events from jsonServer
  //
  //*************************************************************************************** */

  config.eventBus.on('bus_connection_state', function (state) {
    winston.info({message: `socketServer: no_bus_connection received`});
    status.busConnection.state = state
  })

}




// layoutDetails functions
//
function  update_nodeName(config, nodeNumber, layoutData){
  winston.info({message: 'socketServer: update_nodeName'});
  updated = false
  if (nodeNumber in layoutData.nodeDetails){
  } else {
    // need to create entry for node
    layoutData.nodeDetails[nodeNumber] = {}
    layoutData.nodeDetails[nodeNumber].colour = "black"
    layoutData.nodeDetails[nodeNumber].group = ""
    updated = true
    winston.debug({message: 'socketServer: update_nodeName: layoutdetails entry created'});
  }
  if (layoutData.nodeDetails[nodeNumber].name) {
    // nodeName already exists, so do nothing
  } else {
    // check if module name exists - read config to get latest
    // only auto populate if valid
    const nodeConfig = config.readNodeConfig()
    if (nodeConfig.nodes[nodeNumber].moduleName) {
      if (nodeConfig.nodes[nodeNumber].moduleName != 'Unknown'){
        // don't auto populate if we don't know the module name
        layoutData.nodeDetails[nodeNumber].name = nodeConfig.nodes[nodeNumber].moduleName + ' (' + nodeNumber + ')'
      }
    }
    updated = true
  }
  winston.debug({message: 'socketServer: update_nodeName: updated ' + updated});
  if (updated){
    // only write if updated
    config.writeLayoutData(layoutData)
  }
  return updated
}

