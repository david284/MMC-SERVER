const winston = require('winston');		// use config from root instance
const jsonfile = require('jsonfile')
const packageInfo = require('.././package.json')

const admin = require('./mergAdminNode.js')
const server = require('http').createServer()
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});

// array used to indicate a node has been 'taught' an event
// so that a subsequent WRACK or GRSP can request a refresh of events
// exported so that it can be set by unit tests
//
nodesTaught = {}
exports.nodesTaught = nodesTaught

exports.socketServer = function(config) {
    let layoutDetails = config.readLayoutDetails()
    let node = new admin.cbusAdmin(config);

    io.on('connection', function(socket){
  		winston.info({message: 'socketServer:  a user connected'});
      node.cbusSend(node.QNN())
      io.emit('layoutDetails', layoutDetails)
      
      socket.on('QUERY_ALL_NODES', function(){
        winston.info({message: 'socketServer:  QUERY_ALL_NODES'});
        node.cbusSend(node.QNN())
      })

      socket.on('REQUEST_ALL_NODE_PARAMETERS', function(data){ //Request Node Parameter
        winston.info({message: `socketServer:  REQUEST_ALL_NODE_PARAMETERS ${JSON.stringify(data)}`});
        if (data.delay === undefined) {
            data.delay = 100
        }
        for (let i = 0; i <= data.parameters; i++) {
            let time = i*data.delay
            setTimeout(function() {node.cbusSend(node.RQNPN(data.nodeId, i))},time)
        }
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
        if (data.delay === undefined) {
            data.delay = 100
        }
        let finish = data.variables + data.start -1
        let increment = 1
        for (let i = data.start; i <= finish; i++) {
            let time = increment*data.delay
            setTimeout(function() {node.cbusSend(node.NVRD(data.nodeId, i))},time)
            increment +=1
        }
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
        node.removeNodeEvents(data.nodeId)
        node.cbusSend(node.NERD(data.nodeId))
      })

      socket.on('REQUEST_ALL_EVENT_VARIABLES', function(data){
		  	winston.info({message: `socketServer:  REQUEST_ALL_EVENT_VARIABLES ${JSON.stringify(data)}`});
        if (data.delay === undefined) {
            data.delay = 100
        }
        for (let i = 1; i <= data.variables; i++) {
            let time = i*data.delay
            setTimeout(function() {node.cbusSend(node.REVAL(data.nodeId, data.eventIndex, i))},time)
        }
      })

      socket.on('REQUEST_EVENT_VARIABLE', function(data){
  			winston.info({message: `socketServer: REQUEST_EVENT_VARIABLE ${JSON.stringify(data)}`});
        node.cbusSend(node.REVAL(data.nodeId, data.eventIndex, data.eventVariableId))
      })

      socket.on('UPDATE_EVENT_VARIABLE', function(data){
  			winston.info({message: `socketServer: UPDATE_EVENT_VARIABLE ${JSON.stringify(data)}`});
          node.cbusSend(node.NNLRN(data.nodeId))
          //node.cbusSend(node.EVLRN(data.nodeId, data.eventName, data.eventIndex, data.eventVariableId, data.eventVariableValue))
          node.cbusSend(node.update_event(data.nodeId, data.eventName, data.eventIndex, data.eventVariableId, data.eventVariableValue))
          node.cbusSend(node.NNULN(data.nodeId))
          node.cbusSend(node.REVAL(data.nodeId, data.eventIndex, data.eventVariableId))
          node.cbusSend(node.NNULN(data.nodeId))
          node.cbusSend(node.NERD(data.nodeId))
          node.cbusSend(node.RQEVN(data.nodeId))
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
        node.cbusSend(node.NNLRN(data.nodeId))
        //node.cbusSend(node.EVLRN(data.eventName, data.eventId, data.eventVal))
        //node.cbusSend(node.EVLRN(data.nodeId, data.eventName, data.eventIndex, 1, 0))
        node.cbusSend(node.teach_event(data.nodeId, data.eventName, 1, 0))
        node.cbusSend(node.NNULN(data.nodeId))
        node.cbusSend(node.NNULN(data.nodeId))
        nodesTaught[data.nodeId]=true
        // events refresh done on WRACK or GRSP now
      })

      socket.on('REMOVE_NODE', function(data){
        winston.info({message: `socketServer: REMOVE_NODE ${JSON.stringify(data)}`});
        node.removeNode(data.nodeId)
      })

      socket.on('REMOVE_EVENT', function(data){
  			winston.info({message: `socketServer: REMOVE_EVENT ${JSON.stringify(data)}`});
        node.cbusSend(node.NNLRN(data.nodeId))
        node.cbusSend(node.EVULN(data.eventName))
        node.cbusSend(node.NNULN(data.nodeId))
        node.removeNodeEvents(data.nodeId)
        node.cbusSend(node.NERD(data.nodeId))
        node.cbusSend(node.RQEVN(data.nodeId))
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
	  		winston.debug({message: `socketServer: UPDATE_LAYOUT_DETAILS ${JSON.stringify(data)}`});
        layoutDetails = data
        config.writeLayoutDetails(layoutDetails)
        io.emit('layoutDetails', layoutDetails)
      })
        
      socket.on('CLEAR_CBUS_ERRORS', function(data){
		  	winston.info({message: `socketServer: CLEAR_CBUS_ERRORS`});
        node.clearCbusErrors()
      })
		
      socket.on('CHANGE_LAYOUT', function(data){
        winston.info({message: `socketServer: CHANGE_LAYOUT ` + data});
        config.setCurrentLayoutFolder(data)
        layoutDetails = config.readLayoutDetails()
        io.emit('layoutDetails', layoutDetails)
      })

      
      socket.on('REQUEST_LAYOUTS_LIST', function(){
        winston.info({message: `socketServer: REQUEST_LAYOUTS_LIST`});
        const layout_list = config.getListOfLayouts()
        io.emit('LAYOUTS_LIST', layout_list)
        winston.info({message: `socketServer: sent LAYOUTS_LIST` + layout_list});
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
      
    });
    server.listen(config.getSocketServerPort(), () => console.log(`SS: Server running on port ${config.getSocketServerPort()}`))

    node.on('events', function (events) {
      winston.info({message: `socketServer: Events`});
      winston.debug({message: `socketServer: Events :${JSON.stringify(events)}`});
      io.emit('events', events);
    })

    node.on('layoutDetails', function (data) {
      layoutDetails = data
      winston.info({message: `socketServer: send layoutDetails`});
      io.emit('layoutDetails', layoutDetails)
  })

    node.on('nodes', function (nodes) {
      winston.info({message: `socketServer: Nodes Sent`});
      winston.debug({message: `socketServer: Nodes Sent :${JSON.stringify(nodes)}`});
      io.emit('nodes', nodes);
    })

    node.on('node', function (node) {
      winston.info({message: `socketServer: Node Sent`});
      winston.debug({message: `socketServer: Node Sent :${JSON.stringify(node)}`});
      io.emit('node', node);
      if(node.nodeNumber) {
        if (update_nodeName(config, node.nodeNumber, layoutDetails)) {
          io.emit('layoutDetails', layoutDetails)
          winston.info({message: `socketServer: nodeName updated, layoutDetails Sent`});
        }
      }
    })

    node.on('cbusError', function (cbusErrors) {
		winston.info({message: `socketServer: CBUS - ERROR :${JSON.stringify(cbusErrors)}`});
        io.emit('cbusError', cbusErrors);
    })

    node.on('dccError', function (error) {
		winston.info({message: `socketServer: DCC - ERROR :${JSON.stringify(error)}`});
        io.emit('dccError', error);
    })

    node.on('cbusNoSupport', function (cbusNoSupport) {
		winston.info({message: `socketServer: CBUS - Op Code Unknown : ${cbusNoSupport.opCode}`});
        io.emit('cbusNoSupport', cbusNoSupport);
    })

    node.on('dccSessions', function (dccSessions) {
        io.emit('dccSessions', dccSessions);
    })

    node.on('requestNodeNumber', function () {
        if (layoutDetails.layoutDetails.assignId) {
            const newNodeId = parseInt(layoutDetails.layoutDetails.nextNodeId)
            winston.info({message: `socketServer: requestNodeNumber : ${newNodeId}`});
            node.cbusSend(node.SNN(newNodeId))
            layoutDetails.layoutDetails.nextNodeId = newNodeId + 1
            config.writeLayoutDetails(layoutDetails)
            io.emit('layoutDetails', layoutDetails)
            node.cbusSend(node.QNN())
        }
    })


    node.on('cbusTraffic', function (data) {
      winston.info({message: `socketServer: cbusTraffic : ` + data.direction + " " + data.json.text});
      winston.debug({message: `socketServer: cbusTraffic : ` + data.direction + " " + JSON.stringify(data.json)});
      io.emit('cbusTraffic', data);
    })

    node.on('wrack', function (nodeNumber) {
      winston.info({message: `socketServer: wrack : node ` + nodeNumber});
      if (nodesTaught[nodeNumber]){
        winston.info({message: `socketServer: wrack : node ` + nodeNumber + ' had an event taught, so refresh events'});
        node.cbusSend(node.NERD(nodeNumber))
        nodesTaught[nodeNumber]=false
      }
    })

    node.on('grsp', function (data) {
      winston.info({message: `socketServer: grsp : data ` + JSON.stringify(data)});
      var nodeNumber = data.nodeNumber
      if (data.requestOpCode){
        if(data.requestOpCode == "D2"){
          // GRSP was for an EVLRN command (D2)
          winston.info({message: `socketServer: GRSP for EVLRN : node ` + nodeNumber});
          if (nodesTaught[nodeNumber]){
            winston.info({message: 'socketServer: GRSP for EVLRN : refresh events'});
            node.cbusSend(node.NERD(nodeNumber))
            nodesTaught[nodeNumber]=false
          }
        }
      }

    })

    /*programNode.on('programNode', function (data) {
		winston.info({message: `WSSERVER: 'programNode' : ` + data});
        io.emit('PROGRAM_NODE', data);
    })*/

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
    const nodeConfig = config.readNodeConfig()
    if (nodeConfig.nodes[nodeNumber].moduleName) {
      layoutDetails.nodeDetails[nodeNumber].name = nodeConfig.nodes[nodeNumber].moduleName + ' (' + nodeNumber + ')'
    } else {
      layoutDetails.nodeDetails[nodeNumber].name = 'Unknown (' + nodeNumber + ')'
    }
    updated = true
  }
  if (updated){
    // only write if updated
    config.writeLayoutDetails(layoutDetails)
  }
  return updated
}

