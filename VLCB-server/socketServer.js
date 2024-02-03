const winston = require('winston');		// use config from root instance
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
let layoutDetails = config.readLayoutDetails()
let node = new admin.cbusAdmin(config);
//let jsServer = jsonServer.jsonServer(config)

  io.on('connection', function(socket){
    winston.info({message: 'socketServer:  a user connected'});
    node.query_all_nodes()
    io.emit('LAYOUT_DETAILS', layoutDetails)
    
    socket.on('IMPORT_MODULE_DESCRIPTOR', function(data){
      winston.info({message: 'socketServer: IMPORT_MODULE_DESCRIPTOR'});
      config.writeModuleDescriptor(data)
      node.query_all_nodes()  // force refresh of nodeDescriptors
    })

    socket.on('QUERY_ALL_NODES', function(){
      winston.info({message: 'socketServer:  QUERY_ALL_NODES'});
      node.query_all_nodes()
    })

    socket.on('REQUEST_ALL_NODE_PARAMETERS', function(data){ //Request Node Parameter
      winston.info({message: `socketServer:  REQUEST_ALL_NODE_PARAMETERS ${JSON.stringify(data)}`});
      node.request_all_node_parameters(data.nodeId)
    })

    socket.on('RQNPN', function(data){ //Request Node Parameter
      winston.info({message: `socketServer:  RQNPN ${JSON.stringify(data)}`});
      node.cbusSend(node.RQNPN(data.nodeId, data.parameter))
    })

    socket.on('REQUEST_ALL_NODE_VARIABLES', function(data){
      winston.info({message: `socketServer:  REQUEST_ALL_NODE_VARIABLES ${JSON.stringify(data)}`})
      if (data.start === undefined) {
          data.start = 1
      }
      node.request_all_node_variables(data.nodeId, data.start)
    })

    socket.on('REQUEST_SERVICE_DISCOVERY', function(data){
        winston.info({message: `socketServer:  REQUEST_SERVICE_DISCOVERY ${JSON.stringify(data)}`});
        node.cbusSend(node.RQSD(data.nodeId, 0))
    })

    socket.on('REQUEST_DIAGNOSTICS', function(data){
        winston.info({message: `socketServer:  REQUEST_DIAGNOSTICS ${JSON.stringify(data)}`});
        if (data.serviceIndex == undefined){data.serviceIndex = 0;}
        node.cbusSend(node.RDGN(data.nodeId, data.serviceIndex, 0))
    })

    socket.on('REQUEST_NODE_VARIABLE', function(data){
      winston.info({message: `socketServer:  REQUEST_NODE_VARIABLE ${JSON.stringify(data)}`});
        node.cbusSend(node.NVRD(data.nodeId, data.variableId))
    })

    socket.on('UPDATE_NODE_VARIABLE', function(data){
      node.cbusSend(node.NVSET(data.nodeId, data.variableId, data.variableValue))
      winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE ${JSON.stringify(data)}`});
        setTimeout(function() {node.cbusSend(node.NVRD(data.nodeId, data.variableId))},50)
    })

    socket.on('UPDATE_NODE_VARIABLE_IN_LEARN_MODE', function(data){
      winston.info({message: `socketServer:  UPDATE_NODE_VARIABLE_IN_LEARN_MODE ${JSON.stringify(data)}`});
      node.cbusSend(node.NNLRN(data.nodeId))
      node.cbusSend(node.NVSET(data.nodeId, data.variableId, data.variableValue))
      node.cbusSend(node.NNULN(data.nodeId))
      node.cbusSend(node.NVRD(data.nodeId, data.variableId))
      node.cbusSend(node.NNULN(data.nodeId))
    })

    socket.on('REQUEST_ALL_NODE_EVENTS', function(data){
      winston.info({message: `socketServer:  REQUEST_ALL_NODE_EVENTS ${JSON.stringify(data)}`});
      node.request_all_node_events(data.nodeId)
    })

    socket.on('REQUEST_ALL_EVENT_VARIABLES', function(data){
      winston.info({message: `socketServer:  REQUEST_ALL_EVENT_VARIABLES ${JSON.stringify(data)}`});
      node.request_all_event_variables(data.nodeId, data.eventIndex, data.variables)
    })

    socket.on('REQUEST_EVENT_VARIABLE', function(data){
      winston.info({message: `socketServer: REQUEST_EVENT_VARIABLE ${JSON.stringify(data)}`});
      node.cbusSend(node.REVAL(data.nodeId, data.eventIndex, data.eventVariableId))
    })

    socket.on('UPDATE_EVENT_VARIABLE', function(data){
      winston.info({message: `socketServer: UPDATE_EVENT_VARIABLE ${JSON.stringify(data)}`});
      node.update_event_variable(data)
    })

    socket.on('ACCESSORY_LONG_ON', function(data){
      winston.info({message: `socketServer: ACCESSORY_LONG_ON ${JSON.stringify(data)}`});
        node.cbusSend(node.ACON(data.nodeNumber, data.eventNumber))
    })

    socket.on('ACCESSORY_LONG_OFF', function(data){
      winston.info({message: `socketServer: ACCESSORY_LONG_OFF ${JSON.stringify(data)}`});
      node.cbusSend(node.ACOF(data.nodeNumber, data.eventNumber))
    })

    socket.on('ACCESSORY_SHORT_OFF', function(data){
      winston.info({message: `socketServer: ACCESSORY_SHORT_OFF ${JSON.stringify(data)}`});
      node.cbusSend(node.ASOF(data.nodeNumber, data.deviceNumber))
    })

    socket.on('ACCESSORY_SHORT_ON', function(data){
      winston.info({message: `socketServer: ACCESSORY_SHORT_ON ${JSON.stringify(data)}`});
      node.cbusSend(node.ASON(data.nodeNumber, data.deviceNumber))
    })

    socket.on('TEACH_EVENT', function(data){
      winston.info({message: `socketServer: TEACH_EVENT ${JSON.stringify(data)}`});
      node.teach_event(data.nodeId, data.eventName, 1, 0)
    })

    socket.on('REMOVE_NODE', function(nodeNumber){
      winston.info({message: `socketServer: REMOVE_NODE ${nodeNumber}`});
      if (nodeNumber != undefined){
        node.remove_node(nodeNumber)
      }
    })

    socket.on('REMOVE_EVENT', function(data){
      winston.info({message: `socketServer: REMOVE_EVENT ${JSON.stringify(data)}`});
      node.remove_event(data.nodeId, data.eventName)
    })

    socket.on('CLEAR_NODE_EVENTS', function(data){
      winston.info({message: `socketServer: CLEAR_NODE_EVENTS ${data.nodeId}`});
      node.removeNodeEvents(data.nodeId);
    })

    socket.on('REFRESH_EVENTS', function(){
      winston.info({message: `socketServer: REFRESH_EVENTS`});
      node.refreshEvents();
    })

    socket.on('CLEAR_EVENTS', function(){
      winston.info({message: `socketServer: CLEAR_EVENTS`});
      node.clearEvents();
    })

    socket.on('CLEAR_CBUS_ERRORS', function(){
      winston.info({message: `socketServer: CLEAR_CBUS_ERRORS`});
      node.clearCbusErrors();
    })
      
    socket.on('UPDATE_LAYOUT_DETAILS', function(data){
      winston.info({message: `socketServer: UPDATE_LAYOUT_DETAILS`});
      winston.debug({message: `socketServer: UPDATE_LAYOUT_DETAILS ${JSON.stringify(data)}`});
      layoutDetails = data
      config.writeLayoutDetails(layoutDetails)
      io.emit('LAYOUT_DETAILS', layoutDetails)
    })
      
    socket.on('CLEAR_CBUS_ERRORS', function(data){
      winston.info({message: `socketServer: CLEAR_CBUS_ERRORS`});
      node.clearCbusErrors()
    })

    socket.on('CHANGE_LAYOUT', function(data){
      winston.info({message: `socketServer: CHANGE_LAYOUT ` + data});
      config.setCurrentLayoutFolder(data)
      layoutDetails = config.readLayoutDetails()
      io.emit('LAYOUT_DETAILS', layoutDetails)
      node.query_all_nodes()  // refresh all node data to fill new layout
    })

    
    socket.on('REQUEST_BUS_CONNECTION', function(){
      winston.info({message: `socketServer: REQUEST_BUS_CONNECTION`});
      io.emit('BUS_CONNECTION', status.busConnection)

      winston.info({message: `socketServer: sent BUS_CONNECTION`});
    })

    
    socket.on('REQUEST_LAYOUTS_LIST', function(){
      winston.info({message: `socketServer: REQUEST_LAYOUTS_LIST`});
      const layout_list = config.getListOfLayouts()
      io.emit('LAYOUTS_LIST', layout_list)
      winston.info({message: `socketServer: sent LAYOUTS_LIST ` + layout_list});
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

    socket.on('STOP_SERVER', function(){
      winston.info({message: `socketServer: STOP_SERVER`});
      process.exit();
    })
    
    socket.on('SET_NODE_NUMBER', function(nodeNumber){
      winston.info({message: `socketServer: SET_NODE_NUMBER ` + nodeNumber});
      node.cbusSend(node.SNN(nodeNumber))
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
    io.emit('EVENTS', events);
  })


  node.on('layoutDetails', function (data) {
    layoutDetails = data
    winston.info({message: `socketServer: send layoutDetails`});
    io.emit('LAYOUT_DETAILS', layoutDetails)
  })


  node.on('node', function (node) {
    winston.info({message: `socketServer: Node Sent`});
    winston.debug({message: `socketServer: Node Sent :${JSON.stringify(node.nodeNumber)}`});
    io.emit('NODE', node);
    if(node.nodeNumber) {
      if (update_nodeName(config, node.nodeNumber, layoutDetails)) {
        io.emit('LAYOUT_DETAILS', layoutDetails)
        winston.info({message: `socketServer: nodeName updated, LAYOUT_DETAILS Sent`});
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
function  update_nodeName(config, nodeNumber, layoutDetails){
  winston.info({message: 'socketServer: update_nodeName'});
  updated = false
  if (nodeNumber in layoutDetails.nodeDetails){
  } else {
    // need to create entry for node
    layoutDetails.nodeDetails[nodeNumber] = {}
    layoutDetails.nodeDetails[nodeNumber].colour = "black"
    layoutDetails.nodeDetails[nodeNumber].group = ""
    updated = true
  }
  if (layoutDetails.nodeDetails[nodeNumber].name) {
    // nodeName already exists, so do nothing
  } else {
    // check if module name exists - read config to get latest
    // only auto populate if valid
    const nodeConfig = config.readNodeConfig()
    if (nodeConfig.nodes[nodeNumber].moduleName) {
      if (nodeConfig.nodes[nodeNumber].moduleName != 'Unknown'){
        // don't auto populate if we don't know the module name
        layoutDetails.nodeDetails[nodeNumber].name = nodeConfig.nodes[nodeNumber].moduleName + ' (' + nodeNumber + ')'
      }
    }
    updated = true
  }
  if (updated){
    // only write if updated
    config.writeLayoutDetails(layoutDetails)
  }
  return updated
}

