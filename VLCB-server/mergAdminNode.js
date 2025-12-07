const winston = require('winston');		// use config from root instance
const net = require('net')
let cbusLib = require('cbuslibrary')
const EventEmitter = require('events').EventEmitter;
const utils = require('./../VLCB-server/utilities.js');
const { isUndefined } = require('util');
const cbusLibrary = require('cbuslibrary');

const name = 'mergAdminNode'

class cbusAdmin extends EventEmitter {

  constructor(config) {
    super();
    this.inUnitTest = false;
    winston.info({message: `mergAdminNode: Constructor`});
    this.config = config
    this.nodeConfig = {}
    this.nodeDescriptors = {}
    const merg = config.readMergConfig()
    this.merg = merg
    const Service_Definitions = config.readServiceDefinitions()
    this.ServiceDefs = Service_Definitions
    this.pr1 = 2
    this.pr2 = 3
    this.canId = 60
    this.nodeConfig.nodes = {}
    this.nodeConfig.events = {}
    this.cbusErrors = {}
    this.cbusNoSupport = {}
    this.dccSessions = {}
    this.heartbeats = {}
    this.saveNodeConfig()
    this.setNodeNumberIssued = false
    this.nodeNumberInLearnMode = null
    this.rqnnPreviousNodeNumber = null
    // keep a record of when any module descriptors are updated, so we know when to recheck
    this.moduleDescriptorFilesTimeStamp = Date.now()   // put valid milliseconds in to start
    this.nodeDescripter_Queue = []      // create a queue for reading MDF's for nodes
    setInterval(this.checkNodeDescriptorIntervalFunc.bind(this), 20);

    const outHeader = ((((this.pr1 * 4) + this.pr2) * 128) + this.canId) << 5
    this.header = ':S' + outHeader.toString(16).toUpperCase() + 'N'

    this.lastCbusTrafficTime = Date.now()   // put valid milliseconds in to start
    this.LastCbusMessage = null
    this.CBUS_Queue = []
    this.CBUS_Queue = []
    setInterval(this.sendCBUSIntervalFunc.bind(this), 10);
    this.eventsChanged = false
    // update client if anything changed
    setInterval(this.updateClients.bind(this), 200);
    this.opcodeTracker = {}
    this.connectionDetails = null

    this.config.eventBus.on('GRID_CONNECT_RECEIVE', async function (data) {
      //winston.debug({message: name + `: GRID_CONNECT_RECEIVE ${data}`})
      try{
        this.lastCbusTrafficTime = Date.now()     // store this time stamp
        let cbusMsg = cbusLibrary.decode(data)
        winston.debug({message: name + `: GRID_CONNECT_RECEIVE ${JSON.stringify(cbusMsg)}`})
        //
        this.emit('nodeTraffic', {direction: 'In', json: cbusMsg});
        if (this.isMessageValid(cbusMsg)){
          this.action_message(cbusMsg)
        }
      } catch (err) {
        winston.error({message: name + `: GRID_CONNECT_RECEIVE: ${err}`})
      }
    }.bind(this))

    //
    this.actions = { //actions when Opcodes are received
      '00': async (cbusMsg) => { // ACK
          winston.info({message: "mergAdminNode: ACK (00) : No Action"});
      },
      //
      '50': async (cbusMsg) => {// RQNN -  Node Number
        try {
          winston.debug({message: "mergAdminNode: RQNN (50) : " + cbusMsg.text});
          this.rqnnPreviousNodeNumber = cbusMsg.nodeNumber
          this.nodeConfig["setupMode"] = {"NAME":""}    // need a new name from this node
          this.CBUS_Queue.push(cbusLib.encodeRQMN())    // push node onto queue to read module name from node
          this.CBUS_Queue.push(cbusLib.encodeRQNP())    // push node onto queue to read module name from node
          // now get the user to enter a node number
          await sleep(200)    // allow some time for the name to be received
          this.emit('requestNodeNumber', this.rqnnPreviousNodeNumber, this.nodeConfig.setupMode.NAME)
        } catch(err){
          winston.error({message: name + `: RQNN (50) ${err}`});          
        }
      },
      //
      '52': async (cbusMsg) => {
        // NNACK - Node number acknowledge
        try{
          winston.debug({message: "mergAdminNode: NNACK (59) : " + cbusMsg.text});
          // if acknowledge for set node number, delete & recreate any existing record for that node
          // as it may now be a wholly different node being added
          // then query all nodes to recreate the node
          if (this.setNodeNumberIssued){
            this.setNodeNumberIssued = false
            this.createNodeConfig(cbusMsg.nodeNumber, true) // refresh nodeConfig for this node
          }
        } catch(err){ winston.error({message: name + `: NNACK (52) ${err}`}) }
      },
      //
      '59': async (cbusMsg) => {
        try{
          winston.debug({message: "mergAdminNode: WRACK (59) " + cbusMsg.text});
        } catch(err){ winston.error({message: name + `: WRACK (59) ${err}`}) }
      },
      //
      '6F': async (cbusMsg) => {// CMDERR - Cbus Error
        try{
          let ref = cbusMsg.nodeNumber.toString() + '-' + cbusMsg.errorNumber.toString()
          if (ref in this.cbusErrors) {
              this.cbusErrors[ref].count += 1
          } else {
              let output = {}
              output['eventIdentifier'] = ref
              output['type'] = 'CBUS'
              output['Error'] = cbusMsg.errorNumber
              output['Message'] = this.merg.cbusErrors[cbusMsg.errorNumber]
              output['node'] = cbusMsg.nodeNumber
              output['count'] = 1
              this.cbusErrors[ref] = output
          }
          this.emit('cbusError', this.cbusErrors)
        } catch(err){ winston.error({message: name + `: CMDERR (6F) ${err}`}) }
      },
      //
      '70': async (cbusMsg) => { // EVNLF - response to NNEVN
        try{
          this.nodeConfig.nodes[cbusMsg.nodeNumber]["eventSpaceLeft"] = cbusMsg.EVSPC
          this.updateNodeConfig(cbusMsg.nodeNumber)
        } catch(err){ winston.error({message: name + `: EVNLF (70) ${err}`}) }
      },
      //
      '74': async (cbusMsg) => { // NUMEV - response to RQEVN
        try{
          this.nodeConfig.nodes[cbusMsg.nodeNumber].eventCount = cbusMsg.eventCount
          this.updateNodeConfig(cbusMsg.nodeNumber)
          this.CBUS_Queue.push(cbusLib.encodeNNEVN(cbusMsg.nodeNumber)) // always request available space left
          if (this.nodeConfig.nodes[cbusMsg.nodeNumber].eventCount != null) {
            this.CBUS_Queue.push(cbusLib.encodeNERD(cbusMsg.nodeNumber))   // push node onto queue to read all events
          }
        } catch(err){ winston.error({message: name + `: NUMEV (74) ${err}`}) }
      },
      //
      '90': async (cbusMsg) => {//Accessory On Long Event
        try{
          //winston.info({message: `mergAdminNode:  90 recieved`})
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
        } catch(err){ winston.error({message: name + `: ACON (90) ${err}`}) }
      },
      //
      '91': async (cbusMsg) => {//Accessory Off Long Event
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
        } catch(err){ winston.error({message: name + `: ACOF (91) ${err}`}) }
      },
      //
      '97': async (cbusMsg) => { // NVANS - Receive Node Variable Value
        try{
          this.saveNodeVariable(cbusMsg.nodeNumber, cbusMsg.nodeVariableIndex, cbusMsg.nodeVariableValue)
          if (cbusMsg.nodeVariableIndex > 0){
            this.nodeConfig.nodes[cbusMsg.nodeNumber]['lastNVANSTimestamp'] = Date.now()
            winston.debug({message: name + `: lastNVANSTimestamp: ${this.nodeConfig.nodes[cbusMsg.nodeNumber].lastNVANSTimestamp}`})
          }
        } catch (err){ winston.error({message: name + `: NVANS (97) ${err}` }) }
      },
      //
      '98': async (cbusMsg) => {//Accessory On Short Event
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
        } catch (err){ winston.error({message: name + `: ASON (98) ${err}` }) }
      },
      //
      '99': async (cbusMsg) => {//Accessory Off Short Event
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
        } catch (err){ winston.error({message: name + `: ASOF (99) ${err}` }) }
      },
      //
      '9B': async (cbusMsg) => {//PARAN Parameter readback by Index
        try {
        this.nodeConfig.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] = cbusMsg.parameterValue
        // mark paramsUpdated if we get index 10
        if (cbusMsg.parameterIndex == 10){ this.nodeConfig.nodes[cbusMsg.nodeNumber].paramsUpdated = true}
        this.updateNodeConfig(cbusMsg.nodeNumber)
        } catch (err){ winston.error({message: name + `: PARAN (9B) ${err}`}) }
      },
      //
      'AB': async (cbusMsg) => {//Heartbeat
        try{
          winston.debug({message: `mergAdminNode: Heartbeat ${cbusMsg.nodeNumber} ${Date.now()}`})
          this.heartbeats[cbusMsg.nodeNumber] = Date.now()
        } catch (err){ winston.error({message: name + `: HEARTB (AB) ${err}` }) }
      },
      //
      'AC': async (cbusMsg) => {// SD Service Discovery
        try{
          winston.info({message: `mergAdminNode: SD ${cbusMsg.nodeNumber} ${cbusMsg.text}`})
          utils.createServiceEntry(this.nodeConfig, 
            cbusMsg.nodeNumber,
            cbusMsg.ServiceIndex,
            cbusMsg.ServiceType,
            cbusMsg.ServiceVersion,
            this.ServiceDefs
          )
          this.updateNodeConfig(cbusMsg.nodeNumber)
          if (cbusMsg.ServiceIndex > 0){
            this.CBUS_Queue.push(cbusLib.encodeRQSD(cbusMsg.nodeNumber, cbusMsg.ServiceIndex))
          }
        } catch (err){ winston.error({message: name + `: SD (AC) ${err}`}) }
      },
      //
      'AF': async (cbusMsg) => {//GRSP
        try{
          winston.debug({message: `mergAdminNode: GRSP ` + cbusMsg.text})
          await this.process_GRSP(cbusMsg)
        } catch (err){ winston.error({message: name + `: GRSP (AF) ${err}` }) }
      },
      //
      'B0': async (cbusMsg) => {//Accessory On Long Event 1
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
        } catch (err){ winston.error({message: name + `: ACON1 (B0) ${err}` }) }
      },
      //
      'B1': async (cbusMsg) => {//Accessory Off Long Event 1
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
        } catch (err){ winston.error({message: name + `: ACOF1 (B1) ${err}` }) }
      },
      //
      'B5': async (cbusMsg) => {// NEVAL -Read of EV value Response REVAL
        try{
          this.storeEventVariableByIndex(cbusMsg.nodeNumber, cbusMsg.eventIndex, cbusMsg.eventVariableIndex, cbusMsg.eventVariableValue)
        } catch (err){ winston.error({message: name + `: NEVAL (B5) ${err}` }) }
      },
      //
      'B6': async (cbusMsg) => { //PNN Received from Node
        try{
          const nodeNumber = cbusMsg.nodeNumber
          if (nodeNumber in this.nodeConfig.nodes) {
            // already exists in config file...
            winston.debug({message: name + `: PNN (B6) Node found ` + JSON.stringify(this.nodeConfig.nodes[nodeNumber])})
          } else {
            this.createNodeConfig(cbusMsg.nodeNumber, true)
          }
          // store the parameters
          this.nodeConfig.nodes[nodeNumber].parameters[1] = cbusMsg.manufacturerId
          this.nodeConfig.nodes[nodeNumber].parameters[3] = cbusMsg.moduleId
          this.nodeConfig.nodes[nodeNumber].parameters[8] = cbusMsg.flags
          this.updateNodeConfig(cbusMsg.nodeNumber)
        } catch (err){ winston.error({message: name + `: PNN (B6) ${err}`}) }
      },
      //
      'B8': async (cbusMsg) => {//Accessory On Short Event 1
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
        } catch (err){ winston.error({message: name + `: ASON1 (B8) ${err}`}) }
      },
      //
      'B9': async (cbusMsg) => {//Accessory Off Short Event 1
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
        } catch (err){ winston.error({message: name + `: ASOF1 (B9) ${err}`}) }
      },
      //
      'C7': async (cbusMsg) => {//Diagnostic
        try{
          winston.info({message: `DGN: ${cbusMsg.text}`})
          const nodeNumber = cbusMsg.nodeNumber
          if (cbusMsg.ServiceIndex > 0) {
            // all valid service indexes start from 1 - service index 0 returns count of services
            if (nodeNumber in this.nodeConfig.nodes) {
              if (this.nodeConfig.nodes[nodeNumber]["services"][cbusMsg.ServiceIndex]) {
                const ServiceType = this.nodeConfig.nodes[nodeNumber]["services"][cbusMsg.ServiceIndex]['ServiceType']
                const ServiceVersion = this.nodeConfig.nodes[nodeNumber]["services"][cbusMsg.ServiceIndex]['ServiceVersion']
                let output = {
                    "DiagnosticCode": cbusMsg.DiagnosticCode,
                    "DiagnosticValue": cbusMsg.DiagnosticValue
                }
                try{
                  if(this.ServiceDefs[ServiceType]['version'][ServiceVersion]['diagnostics'][cbusMsg.DiagnosticCode]){
                    output["DiagnosticName"] = this.ServiceDefs[ServiceType]['version'][ServiceVersion]['diagnostics'][cbusMsg.DiagnosticCode]['name']
                  }
                } catch (err){
                  winston.warn({message: name + `: DGN: failed to get diagnostic name for diagnostic code ${cbusMsg.DiagnosticCode} ` + err});
                }
                this.nodeConfig.nodes[nodeNumber]["services"][cbusMsg.ServiceIndex]['diagnostics'][cbusMsg.DiagnosticCode] = output
                this.updateNodeConfig(cbusMsg.nodeNumber)
              }
              else {
                    winston.warn({message: name + `: DGN: node config services does not exist for node ${cbusMsg.nodeNumber}`});
              }
            }
            else {
                    winston.warn({message: name + `: DGN: node config does not exist for node ${cbusMsg.nodeNumber}`});
            }
          }
        } catch (err){ winston.error({message: name + `: DGN (C7) ${err}`}) }
      },
      //
      'D0': async (cbusMsg) => {//Accessory On Long Event 2
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
        } catch (err){ winston.error({message: name + `: ACON2 (D0) ${err}`}) }
      },
      //
      'D1': async (cbusMsg) => {//Accessory Off Long Event 2
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
        } catch (err){ winston.error({message: name + `: ACOF2 (D1) ${err}`}) }
      },
      //
      'D3': async (cbusMsg) => {// EVANS - response to REQEV
        try {
          var nodeNumber = this.nodeNumberInLearnMode
          var eventIdentifier = utils.decToHex(cbusMsg.nodeNumber, 4) + utils.decToHex(cbusMsg.eventNumber, 4) 
          this.storeEventVariableByIdentifier(nodeNumber, eventIdentifier, cbusMsg.eventVariableIndex, cbusMsg.eventVariableValue)
          winston.debug({message: name + `: EVANS(D3): eventIdentifier ${eventIdentifier}`});
          if (cbusMsg.eventVariableIndex > 0){
            this.nodeConfig.nodes[nodeNumber]['lastEVANSTimestamp'] = Date.now()
            winston.debug({message: name + `: lastEVANSTimestamp: node ${nodeNumber} ${this.nodeConfig.nodes[nodeNumber].lastEVANSTimestamp}`});
          }
        } catch(err){ winston.error({message: name + `: EVANS(D3): node ${nodeNumber} ${err}`}) }
      },
      //
      'D8': async (cbusMsg) => {//Accessory On Short Event 2
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
        } catch (err){ winston.error({message: name + `: ASON2 (D8) ${err}`}) }
      },
      //
      'D9': async (cbusMsg) => {//Accessory Off Short Event 2
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
        } catch (err){ winston.error({message: name + `: ASOF2 (D9) ${err}`}) }
      },
      //
      'E2': async (cbusMsg) => { // NAME
        try{
          winston.debug({message: `mergAdminNode: NAME (E2) ` + JSON.stringify(cbusMsg)})
          this.nodeConfig.setupMode.NAME = cbusMsg.name
        } catch(err){ winston.error({message: name + `: NAME (E2) ${err}`}) }
      },
      //
      'E7': async (cbusMsg) => {// ESD - Extended Service Discovery
        try{
          winston.debug({message: name + `: Extended Service Discovery ${JSON.stringify(cbusMsg)}`})
          utils.addESDvalue(this.nodeConfig, cbusMsg.nodeNumber, cbusMsg.ServiceIndex, 1, cbusMsg.Data1)
          utils.addESDvalue(this.nodeConfig, cbusMsg.nodeNumber, cbusMsg.ServiceIndex, 2, cbusMsg.Data2)
          utils.addESDvalue(this.nodeConfig, cbusMsg.nodeNumber, cbusMsg.ServiceIndex, 3, cbusMsg.Data3)
          this.updateNodeConfig(cbusMsg.nodeNumber)
        } catch (err) { winston.error({message: name + `: ESD (E7) ${err}` }) }
      },
      //
      'EF': async (cbusMsg) => {//PARAMS - response to RQNP in setup mode
        try{
          //winston.debug({message: `mergAdminNode: PARAMS (EF) Received`});
        } catch (err) { winston.error({message: name + `: PARAMS (EF) ${err}` }) }
      },
      //
      'F0': async (cbusMsg) => {//Accessory On Long Event 3
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
        } catch (err){ winston.error({message: name + `: ACON3 (F0) ${err}`}) }
      },
      //
      'F1': async (cbusMsg) => {//Accessory Off Long Event 3
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
        } catch (err){ winston.error({message: name + `: ACOF3 (F1) ${err}`}) }
      },
      //
      'F2': async (cbusMsg) => {//ENSRP Response to NERD/NENRD
        // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
        try{
          this.updateEventInNodeConfig(cbusMsg.nodeNumber, cbusMsg.eventIdentifier, cbusMsg.eventIndex)
        } catch (err) { winston.error({message: name + `: ENSRP (F2) ${err}` }) }
      },
      //
      'F8': async (cbusMsg) => {//Accessory On Short Event 3
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
        } catch (err){ winston.error({message: name + `: ASON3 (F8) ${err}`}) }
      },
      //
      'F9': async (cbusMsg) => {//Accessory Off Short Event 3
        try{
          this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
        } catch (err){ winston.error({message: name + `: ASOF3 (F9) ${err}`}) }
      },
      //
      'DEFAULT': async (cbusMsg) => {
        winston.debug({message: "mergAdminNode: Opcode " + cbusMsg.opCode + ' is not supported by the Admin module'});
        let opCode = cbusMsg.opCode

        if (opCode in this.cbusNoSupport) {
            this.cbusNoSupport[opCode].cbusMsg = cbusMsg
            this.cbusNoSupport[opCode].count += 1
        } else {
            let output = {}
            output['opCode'] = cbusMsg.opCode
            output['msg'] = {"message": cbusMsg.encoded}
            output['count'] = 1
            this.cbusNoSupport[opCode] = output
        }
        this.emit('cbusNoSupport', this.cbusNoSupport)
      }
    }
  } // end constructor


  //
  // Reads connection details and sets FCU_Compatibility accordingly
  //
  set_FCU_compatibility(){
    winston.info({message: name + `: set_FCU_compatibility`});
    try {
      let ModeNumber = 0x11   // Turn off FCU compatibility
      if (this.connectionDetails.FCU_Compatibility == true){
          ModeNumber = 0x10   // Turn on FCU compatibility
      }
      let nodeNumber = 0      // global (all nodes)
      this.CBUS_Queue.push(cbusLib.encodeMODE(nodeNumber, ModeNumber))
    } catch (err){
      winston.info({message: name + `: set_FCU_compatibility: ` + err});
    }
  }

  //
  //
  onConnect(connectionDetails){
    winston.info({message: name + `: onConnect`});
    this.connectionDetails = connectionDetails
    this.addLayoutNodes(this.config.readLayoutData())
    this.set_FCU_compatibility()
    this.query_all_nodes()
  }

  //
  //
  getModuleName(moduleIdentifier){
    winston.debug({message: name + `: getModuleName: ` + moduleIdentifier});
    var moduleName = 'Unknown'
    if (this.merg['modules'][moduleIdentifier]) {
      if (this.merg['modules'][moduleIdentifier]['name']) {
        moduleName = this.merg['modules'][moduleIdentifier]['name']
        winston.debug({message: name + `: getModuleName(1): ${moduleIdentifier} ${moduleName}`});
        return moduleName
      }
    }
    var list = this.config.getModuleDescriptorFileList(moduleIdentifier)
    //winston.debug({message: name + `: Descriptor File List: ` + JSON.stringify(list)});
    if (list[0]){
      var index = list[0].toString().search(moduleIdentifier)
      //winston.debug({message: name + `: getModuleDescriptorFileList: moduleIdentifier position: ` + index});
      if (index > 1) {
        moduleName =list[0].substr(0,index-1)
      }
    }
    winston.debug({message: name + `: getModuleName(2): ${moduleIdentifier} ${moduleName}`});
    return moduleName
  }

  //
  //
  getModuleInfo(nodeNumber, moduleIdentifier){
    winston.debug({message: name + `: getModuleInfo: ${nodeNumber} ${moduleIdentifier}`});
    if (this.merg['modules'][moduleIdentifier]) {
      this.nodeConfig.nodes[nodeNumber].moduleInfo = this.merg['modules'][moduleIdentifier]
    } else {
      this.nodeConfig.nodes[nodeNumber].moduleInfo = {}
    }
  }


  //
  //
  async process_GRSP (data) {
    winston.info({message: `mergAdminNode: grsp : data ` + JSON.stringify(data)});
    var nodeNumber = data.nodeNumber
    if (data.requestOpCode){
      if( (data.requestOpCode == "95") ||   // EVULN
          (data.requestOpCode == "D2") ){   // EVLRN
        // GRSP was for an event command
        winston.info({message: `mergAdminNode: GRSP for event command : node ` + nodeNumber});
      }
    }
  }

  //
  //
  async action_message(cbusMsg) {
    if (cbusMsg.ID_TYPE == "S"){
      this.preOpcodeProcessing(cbusMsg)
      winston.debug({message: name + ": action_message " + cbusMsg.mnemonic + " Opcode " + cbusMsg.opCode});
      if (this.actions[cbusMsg.opCode]) {
          await this.actions[cbusMsg.opCode](cbusMsg);
      } else {
          await this.actions['DEFAULT'](cbusMsg);
      }
      // finished processing opcode, do post processing actions
      this.postOpcodeProcessing(cbusMsg)
    }
    else if (cbusMsg.ID_TYPE = "X"){
      // currently ignoring extended messages - programNode class uses them instead
    }
    else {
      winston.warn({message: name + ": unexpected cbus message " + JSON.stringify(cbusMsg)});
    }
  }

  //
  // actions that are best done before processing the opcode
  // and can be done on all opcodes
  //
  preOpcodeProcessing(cbusMsg){
    winston.debug({message: name + `: preOpcodeProcessing ${cbusMsg.opCode} ${cbusMsg.mnemonic}`});
    try{
      var updated = false
      // update opcode tracker
      if (this.opcodeTracker[cbusMsg.opCode] == undefined) { this.opcodeTracker[cbusMsg.opCode] = {mnemonic:cbusMsg.mnemonic, count:0} }
      this.opcodeTracker[cbusMsg.opCode].count++
      this.opcodeTracker[cbusMsg.opCode]["timeStamp"] = Date.now()
      //
      // if this message has a node number, we can do extra actions
      if (cbusMsg.nodeNumber){
        let nodeNumber = cbusMsg.nodeNumber
        // if node doesn't exist, create it
        if (this.nodeConfig.nodes[nodeNumber] == undefined){
          this.createNodeConfig(nodeNumber, true)
          updated = true
        }
        // capture CANID
        this.nodeConfig.nodes[nodeNumber].CANID = utils.getMGCCANID(cbusMsg.encoded)
        //
        // if status for this node wasn't true, change it & mark as needs updating
        if (this.nodeConfig.nodes[nodeNumber].status != true){
          this.nodeConfig.nodes[nodeNumber].status = true
          winston.debug({message: name + `: node ${nodeNumber} status changed to true`});
          updated = true
        }
        // store the timestamp for this node
        this.nodeConfig.nodes[nodeNumber].lastReceiveTimestamp = Date.now()
        //
        // update if necessary
        if (updated) {this.updateNodeConfig(nodeNumber)}
      }
    } catch (err){
      winston.error({message: name + `: preOpcodeProcessing
        ${err} 
        ${JSON.stringify(cbusMsg)}
        `
      })
    }
  }

  //
  // actions that are best done after processing the opcode
  //
  postOpcodeProcessing(cbusMsg){
    winston.debug({message: name + `: postOpcodeProcessing ${cbusMsg.opCode} ${cbusMsg.mnemonic}`});
    //
    try{
      // if this message has a node number, and it's the source of the message (not destination)
      // then we can check extra things
      if (cbusMsg.nodeNumber){
        let nodeNumber = cbusMsg.nodeNumber
        if (utils.nodeNumberIsSource(cbusMsg.opCode)){
          winston.debug({message: name + `: postOpcodeProcessing: ${cbusMsg.mnemonic} node ${nodeNumber}`});
          // just in case it's been removed...
          if (this.nodeConfig.nodes[nodeNumber] == undefined){ this.createNodeConfig(nodeNumber, true) }
          // if we had a PNN, then we'd already have params 1, 3 & 8
          // but if node just added, or firmware changed, then we need to request them, but ensure only once
          // skip this if in unit test, as it's once only nature can cause repeated tests to fail
          if((this.nodeConfig.nodes[nodeNumber].minParamsAlreadyRequested == false) && (this.inUnitTest == false)){
            if ( this.nodeConfig.nodes[nodeNumber].parameters[8] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 8))   // flags
            }
            if ( this.nodeConfig.nodes[nodeNumber].parameters[1] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 1))   // ManufacturerID
            }
            if ( this.nodeConfig.nodes[nodeNumber].parameters[3] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 3))   // ModuleID
            }
            this.nodeConfig.nodes[nodeNumber].minParamsAlreadyRequested = true
          }
          // we also want the firmware version of the node
          // again, skip this if in unit test, as it's once only nature can cause repeated tests to fail
          if((this.nodeConfig.nodes[nodeNumber].versionAlreadyRequested == false) && (this.inUnitTest == false)){
            if ( this.nodeConfig.nodes[nodeNumber].parameters[7] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 7))   //
            }
            if (this.nodeConfig.nodes[nodeNumber].parameters[2] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 2))   //
            }
            if (this.nodeConfig.nodes[nodeNumber].parameters[9] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 9))   //
            }
            if (this.nodeConfig.nodes[nodeNumber].parameters[20] == undefined){
              this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 20))   //
            }
            //
            this.nodeConfig.nodes[nodeNumber].versionAlreadyRequested = true
          }
          // get event count if undefined, will trigger NERD & event space left as well
          // again, skip this if in unit test, as it's once only nature can cause repeated tests to fail
          if((this.nodeConfig.nodes[nodeNumber].eventsAlreadyRequested == false) && (this.inUnitTest == false)){
            if(this.nodeConfig.nodes[nodeNumber].eventCount == undefined){
              // don't read events if it's node number 0, as it's an uninitialsed module or a SLiM consumer
              if (nodeNumber > 0){
                this.CBUS_Queue.push(cbusLib.encodeRQEVN(nodeNumber))
              }
            }
            //
            this.nodeConfig.nodes[nodeNumber].eventsAlreadyRequested = true
          }  
        }
        // always update nodeConfig if there's a nodeNumber
        this.updateNodeConfig(nodeNumber)
      }
    }catch (err){
      winston.error({message: name + `: postOpcodeProcessing
        ${err} 
        ${JSON.stringify(cbusMsg)}
        `
      })
    }
  }

  //
  //
  isMessageValid(cbusMsg){
    var result = false
    if ((cbusMsg.encoded[0] == ':') && (cbusMsg.encoded[cbusMsg.encoded.length-1] == ';')){
      if (cbusMsg.ID_TYPE == 'S'){
        // example encoding :S1234NFF12345678; - 8 data hex chars, 4 data bytes
        //                  123456789--------0 - non-data bytes = 10
        if (cbusMsg.encoded.length == 8) {
          result = false
          winston.info({message: name + `: isMessageValid: empty message `});
        } else {
          var dataLength = (cbusMsg.encoded.length - 10) / 2
          // get numeric version of opCode, so we can test for 
          var opCode = parseInt(cbusMsg.opCode, 16)
          if (opCode <= 0x1F){
            if (dataLength == 0){ result = true}
          }
          if ((opCode >= 0x20) && (opCode <= 0x3F)){
            if (dataLength == 1){ result = true}
          }
          if ((opCode >= 0x40) && (opCode <= 0x5F)){
            if (dataLength == 2){ result = true}
          }
          if ((opCode >= 0x60) && (opCode <= 0x7F)){
            if (dataLength == 3){ result = true}
          }
          if ((opCode >= 0x80) && (opCode <= 0x9F)){
            if (dataLength == 4){ result = true}
          }
          if ((opCode >= 0xA0) && (opCode <= 0xBF)){
            if (dataLength == 5){ result = true}
          }
          if ((opCode >= 0xC0) && (opCode <= 0xDF)){
            if (dataLength == 6){ result = true}
          }
          if ((opCode >= 0xE0) && (opCode <= 0xFF)){
            if (dataLength == 7){ result = true}
          }
          if (result == false){
            winston.error({message: name + `: isMessageValid: opCode ` + cbusMsg.opCode + ` wrong data length: ` + dataLength});
          }
        }
      }
    } else {
      winston.error({message: name + `: isMessageValid: wrongly formed ` + cbusMsg.encoded });
    }
    return result
  }

  //
  // Create a node in node config
  // status true if creating because we've received traffic
  // status false if creating because it used to be there, but not seen it yet
  //
  createNodeConfig(nodeNumber, status){
      // doesn't exist in config file, so create an entry for it
      let output = {
        "CANID": "",
        "nodeNumber": nodeNumber,
        "manufacturerId": "",
        "moduleId": "",
        "moduleIdentifier": "",
        "moduleVersion": "",
        "parameters": {},
        "nodeVariables": {},
        "storedEventsNI": {},
        "eventsByIndex": {},
        "status": status,
        "eventCount": undefined,
        "services": {},
        "lastReceiveTimestamp": undefined,
        "getNodeDescriptorTimeStamp": 0,
        "versionAlreadyRequested": false,
        "eventsAlreadyRequested": false,
        "minParamsAlreadyRequested": false,
        "NodeModifiedTimestamp": Date.now()
    }
    this.nodeConfig.nodes[nodeNumber] = output
    winston.debug({message: name + `: createNodeConfig: node ` + nodeNumber})
    this.updateNodeConfig(nodeNumber)
  }

  //
  // This function updates or creates an event in nodeConfig
  // It captures the event Index, as we may need that later
  //
  updateEventInNodeConfig(nodeNumber, eventIdentifier, eventIndex){
    try{
      if (this.nodeConfig.nodes[nodeNumber] == undefined) {
        this.createNodeConfig(nodeNumber, false)
      }
      // add if doesn't exist - empty variables
      if (!(eventIdentifier in this.nodeConfig.nodes[nodeNumber].storedEventsNI)) {
        this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier] = {
          "eventIdentifier": eventIdentifier,
          "variables": {}
        }
      }
      // this may change even if it already exists
      this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].eventIndex = eventIndex
      //
      // check eventsByIndex and add if doesn't exist - empty variables
      if (!(eventIndex in this.nodeConfig.nodes[nodeNumber].eventsByIndex)) {
        this.nodeConfig.nodes[nodeNumber].eventsByIndex[eventIndex] = {
          "eventIndex": eventIndex,
          "variables": {}
        }
      }
      // this may change even if index already exists, so always set this
      this.nodeConfig.nodes[nodeNumber].eventsByIndex[eventIndex].eventIdentifier = eventIdentifier
      this.updateNodeConfig(nodeNumber)
    } catch (err){
      winston.error({message: name + `: updateEventInNodeConfig: node ${nodeNumber}: ${err}` })
    }
  }


  //
  // Function used to store event variable in eventIdentifier structure
  // This avoids the use of event indexes that may dynamically change
  //
  storeEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue){
    winston.debug({message: name + `: storeEventVariableByIdentifier: ${nodeNumber} ${eventIdentifier} ${eventVariableIndex} ${eventVariableValue}`});
    try {
      var node = this.nodeConfig.nodes[nodeNumber]
      if (node){
        // might be new event, so check it exists, and create if it doesn't
        if (node.storedEventsNI[eventIdentifier] == undefined){
          node.storedEventsNI[eventIdentifier] = { "eventIdentifier": eventIdentifier, "variables":{} }
        }
        if (node.storedEventsNI[eventIdentifier].variables == undefined){
          node.storedEventsNI[eventIdentifier].variables = {}
          // create all event variables - param 5 = No. of Event Variables per event
          for ( let i = 1; i < node.parameters[5]; i++){
            node.storedEventsNI[eventIdentifier].variables[i] = 0
          }
        }
        // now store it
        node.storedEventsNI[eventIdentifier].variables[eventVariableIndex] = eventVariableValue
        // now store in eventsByIndex table, so have to find an entry with matching eventIdentifier
        for (let eventIndex in node.eventsByIndex){
          if (node.eventsByIndex[eventIndex].eventIdentifier == eventIdentifier){
            node.eventsByIndex[eventIndex].variables[eventVariableIndex] = eventVariableValue
          }
        }
        this.updateNodeConfig(nodeNumber)
      } else {
        winston.debug({message: name + `: storeEventVariableByIdentifier: node undefined`});
      }
    } catch (err) {
      winston.error({message: name + `: storeEventVariableByIdentifier: error ${err}`});
    }
  }

  //
  // Function used when NEVAL is returned, and NEVAL uses eventIndex, not eventIdentifier
  // but we want to store variable by eventIdentifier
  // so need to find which eventIdentifier has that eventIndex
  // then we can use storeEventVariableByIdentifier() to actually store it
  //
  storeEventVariableByIndex(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue){
    winston.debug({message: name + `: storeEventVariableByIndex: ${nodeNumber} ${eventIndex} ${eventVariableIndex} ${eventVariableValue}`});
    try {
      var match = false
      var node = this.nodeConfig.nodes[nodeNumber]
      // might be new event, so check it exists, and create if it doesn't
      if (node.eventsByIndex[eventIndex] == undefined){
        node.eventsByIndex[eventIndex] = { "eventIndex": eventIndex, "variables":{} }
      }
      node.eventsByIndex[eventIndex].variables[eventVariableIndex] = eventVariableValue
      for (let eventIdentifier in node.storedEventsNI){
        if (node.storedEventsNI[eventIdentifier].eventIndex == eventIndex){
          // ok, we've found the matching eventIdentifier
          match = true
          winston.debug({message: name + ': storeEventVariableByIndex: eventIdentifier ' + JSON.stringify(node.storedEventsNI[eventIdentifier])})
          this.storeEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue)
        }
      }
      if (match == false){
        winston.info({message: name + `: storeEventVariableByIndex: eventIdentifier not found with eventIndex ${eventIndex}`});
      }
    } catch (err) {
      winston.info({message: name + `: storeEventVariableByIndex: error ${err}`});
    }
  }


  //
  // expected to be called after executing a NNCLR to clear all events on the node
  // Remove all events for node in nodeConfig, as it shouldn't have any now
  // include deleting any Bus Events stored for this node
  //
  removeNodeEvents(nodeNumber) {
    winston.debug({message: name + `: removeNodeEvents for node ${nodeNumber}`})
    if(this.nodeConfig.nodes[nodeNumber]){
      this.nodeConfig.nodes[nodeNumber].storedEventsNI = {}
      // remove all bus events for this node
      let busEventsList = Object.keys(this.nodeConfig.events)
      for (const busEventIdentifier of busEventsList) {
        if (busEventIdentifier.includes('L' + utils.decToHex(nodeNumber, 4))){
          winston.debug({message: name + `: removeBusEvent ${busEventIdentifier}`})
          delete this.nodeConfig.events[busEventIdentifier]
        }
        if (busEventIdentifier.includes('S' + utils.decToHex(nodeNumber, 4))){
          winston.debug({message: name + `: removeBusEvent ${busEventIdentifier}`})            
          delete this.nodeConfig.events[busEventIdentifier]
        }
      }
      this.refreshEvents()  // will send bus events
      this.nodeConfig.nodes[nodeNumber].hasChanged
    }
  }

  //
  //
  removeNodeEvent(nodeNumber, eventIdentifier) {
    winston.info({message: name + `: removeNodeEvent ${nodeNumber} ${eventIdentifier}`})
    if(this.nodeConfig.nodes[nodeNumber]){
      delete this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier]
    }
    // if there's a bus event for this event from that node, then remove that too
    // but need to include the nodeNumber in the event identifier, as it's sent on the bus
    // and identifies the source node, even for short events
    var busEventIdentifier = utils.decToHex(nodeNumber, 4) + eventIdentifier.substring(4, 8)
    if(eventIdentifier.substring(0, 4) == '0000'){
      busEventIdentifier = 'S' + busEventIdentifier
    } else {
      busEventIdentifier = 'L' + busEventIdentifier
    }
    delete this.nodeConfig.events[busEventIdentifier]
    winston.debug({message: name + `: removeBusEvent ${busEventIdentifier}`})
    this.refreshEvents()  // will send bus events
    this.nodeConfig.nodes[nodeNumber].hasChanged
  }

  //
  //
  clearCbusErrors() {
      this.cbusErrors = {}
      this.emit('cbusError', this.cbusErrors)
  }

  // expects a Grid Connect encoded message
  // And generates a 'GRID_CONNECT_SEND' eventbus message
  // as well as a 'nodeTraffic' logging event with more verbous data
  // stores the current message & timestamp
  //
  async cbusTransmit(GCmsg) {
    //winston.debug({message: name + `: cbusTransmit: ${GCmsg}`});
    if (typeof GCmsg !== 'undefined') {
      let cbusMSG = cbusLib.decode(GCmsg)   // decode to get text
      this.emit('nodeTraffic', {direction: 'Out', json: cbusMSG});
      winston.debug({message: name + `: GRID_CONNECT_SEND ${JSON.stringify(cbusMSG)}`})
      this.config.eventBus.emit ('GRID_CONNECT_SEND', GCmsg)
      this.lastCbusTrafficTime = Date.now()     // store this time stamp
      this.LastCbusMessage = cbusMSG            // used in conjunction with timesatmp above
      //
    }
  }

  //
  //
  refreshEvents() {
    this.eventsChanged = true
  }

  //
  //
  clearEvents() {
      winston.info({message: `mergAdminNode: clearEvents() `});
      this.nodeConfig.events = {}
      this.saveNodeConfig()
      this.eventsChanged = true
  }

  //
  //
  eventSend(nodeNumber, eventNumber, status, type) {
    let busIdentifier = utils.decToHex(nodeNumber, 4) + utils.decToHex(eventNumber, 4)
      let eventIdentifier = busIdentifier
      winston.info({message: 'mergAdminNode: eventIdentifier : ' + eventIdentifier});
      //need to remove node number from event identifier if short event
      if (type == 'short') { 
        busIdentifier = 'S' + busIdentifier
        eventIdentifier = "0000" + eventIdentifier.slice(4)
      } else {
        busIdentifier = 'L' + busIdentifier
      }
      if (busIdentifier in this.nodeConfig.events) {
          this.nodeConfig.events[busIdentifier]['status'] = status
          this.nodeConfig.events[busIdentifier]['count'] += 1
      } else {
          let output = {}
          output['eventIdentifier'] = eventIdentifier
          output['nodeNumber'] = nodeNumber
          output['eventNumber'] = eventNumber
          output['status'] = status
          output['type'] = type
          output['count'] = 1
          this.nodeConfig.events[busIdentifier] = output
          winston.debug({message: name + `: EventSend added to events ${busIdentifier}`});
        }
      winston.info({message: 'mergAdminNode: EventSend : ' + JSON.stringify(this.nodeConfig.events[busIdentifier])});
      this.eventsChanged = true
  }

  //
  // save the whole config structure for all nodes
  // updates the client
  //
  saveNodeConfig() {
      winston.info({message: 'mergAdminNode: Save Config : '});
      this.config.writeNodeConfig(this.nodeConfig)
      this.emit('nodes', this.nodeConfig.nodes);
  }

  //
  // Function to update data for a single node into nodeConfig
  // fills in various derived elements from node data
  // marks node as changed so that the timed process will pick it up and send to client
  //
  updateNodeConfig(nodeNumber) {
    winston.debug({message: 'mergAdminNode: updateNodeConfig : ' + nodeNumber});
    if (this.nodeConfig.nodes[nodeNumber] == undefined){
      this.createNodeConfig(nodeNumber, false)
    }
    // if node parameters exist, always update associated fields
    this.nodeConfig.nodes[nodeNumber].manufacturerId = this.nodeConfig.nodes[nodeNumber].parameters[1]
    this.nodeConfig.nodes[nodeNumber].moduleId = this.nodeConfig.nodes[nodeNumber].parameters[3]
    if (this.nodeConfig.nodes[nodeNumber].parameters[8]){
      let flags = this.nodeConfig.nodes[nodeNumber].parameters[8]
      this.nodeConfig.nodes[nodeNumber].flags = flags
      this.nodeConfig.nodes[nodeNumber].flim = (flags & 4) ? true : false
      this.nodeConfig.nodes[nodeNumber].consumer = (flags & 1) ? true : false
      this.nodeConfig.nodes[nodeNumber].producer = (flags & 2) ? true : false
      this.nodeConfig.nodes[nodeNumber].bootloader = (flags & 8) ? true : false
      this.nodeConfig.nodes[nodeNumber].coe = (flags & 16) ? true : false
      this.nodeConfig.nodes[nodeNumber].learn = (flags & 32) ? true : false
      this.nodeConfig.nodes[nodeNumber].VLCB = (flags & 64) ? true : false
    }
    this.nodeConfig.nodes[nodeNumber].cpuName = this.merg.cpuName[this.nodeConfig.nodes[nodeNumber].parameters[9]]
    this.nodeConfig.nodes[nodeNumber].interfaceName = this.merg.interfaceName[this.nodeConfig.nodes[nodeNumber].parameters[10]]
    this.nodeConfig.nodes[nodeNumber].cpuManufacturerName = this.nodeConfig.nodes[nodeNumber].parameters[19]
    this.nodeConfig.nodes[nodeNumber].Beta = this.nodeConfig.nodes[nodeNumber].parameters[20]

    // ensure moduleIdentifier is created (if params 1 & 3 exist)
    if ((this.nodeConfig.nodes[nodeNumber].manufacturerId != undefined) && (this.nodeConfig.nodes[nodeNumber].moduleId != undefined)){
      var moduleIdentifier = utils.decToHex(this.nodeConfig.nodes[nodeNumber].manufacturerId, 2)
        + utils.decToHex(this.nodeConfig.nodes[nodeNumber].moduleId, 2)
      // has the moduleIdentifier changed? - if so update some things
      if (this.nodeConfig.nodes[nodeNumber].moduleIdentifier != moduleIdentifier){  
        this.nodeConfig.nodes[nodeNumber].moduleIdentifier = moduleIdentifier
        // also fill manufacturer & module name
        this.nodeConfig.nodes[nodeNumber].moduleName = this.getModuleName(moduleIdentifier)
        this.getModuleInfo(nodeNumber, moduleIdentifier)
        this.nodeConfig.nodes[nodeNumber].moduleManufacturerName = this.merg.moduleManufacturerName[this.nodeConfig.nodes[nodeNumber].manufacturerId]
      }
    }
    if ((this.nodeConfig.nodes[nodeNumber].parameters[7] != undefined) && (this.nodeConfig.nodes[nodeNumber].parameters[2] != undefined)){
      // get & store the version
      this.nodeConfig.nodes[nodeNumber].moduleVersion = this.nodeConfig.nodes[nodeNumber].parameters[7] + String.fromCharCode(this.nodeConfig.nodes[nodeNumber].parameters[2])
    }
    if (this.nodeConfig.nodes[nodeNumber].parameters[9] != undefined){
      // get & store the processorType
      this.nodeConfig.nodes[nodeNumber].processorType = this.nodeConfig.nodes[nodeNumber].parameters[9]
    }
    // try to get nodeDescriptor, this will check if it needs doing
    this.nodeDescripter_Queue.push(nodeNumber)
    // mark node has changed, so regular check will send the node to the client & write to disk
    // reduces traffic if node is being changed very quickly
    this.nodeConfig.nodes[nodeNumber].hasChanged = true
  }

  //
  //
  saveNodeVariable(nodeNumber, nodeVariableIndex, nodeVariableValue){
    winston.debug({message: name + `: saveNodeVariable : ${nodeNumber} ${nodeVariableIndex} ${nodeVariableValue}`});
    if (this.nodeConfig.nodes[nodeNumber] == undefined){
      this.createNodeConfig(nodeNumber, false)
    }
    this.nodeConfig.nodes[nodeNumber].nodeVariables[nodeVariableIndex] = nodeVariableValue
    if (this.nodeConfig.nodes[nodeNumber]["nodeVariableReadCount"] == undefined){this.nodeConfig.nodes[nodeNumber]["nodeVariableReadCount"] = 0}
    if (nodeVariableIndex == 1){
      // start from 1 again
      this.nodeConfig.nodes[nodeNumber].nodeVariableReadCount = 1
    } else {
      this.nodeConfig.nodes[nodeNumber].nodeVariableReadCount++ 
    }
    // mark node has changed, so regular check will send the node to the client & write to disk
    // reduces traffic if node is being changed very quickly
    this.nodeConfig.nodes[nodeNumber].hasChanged = true
  }


//************************************************************************ */
//
// Timer functions
// in alphabetical order
//
//************************************************************************ */


  //
  // Function to send CBUS messages one at a time, ensuring a gap between them
  // Gap is dynamic depending on last message
  //
  sendCBUSIntervalFunc(){
    // get calculated time gap to leave after last message
    var timeGap = this.getTimeGap()
    if ( Date.now() > this.lastCbusTrafficTime + timeGap){
      if (this.CBUS_Queue.length > 0){
        // get first out of queue
        var msg = this.CBUS_Queue[0]
        //winston.debug({message: name + `: sendCBUSIntervalFunc: dequeued ${msg}` });
        this.cbusTransmit(msg)
        // remove the one we've used from queue
        this.CBUS_Queue.shift()
      }
    } else {
      //winston.debug({message: name + ": sendCBUSIntervalFunc - paused " + timeGap});
    }
  }

  // calculate a new time gap between CBUS tranmits dependant on the type of the last message
  // allow an override if unit tests in progress
  //
  getTimeGap(){
    let timeGap = 40
    try{
      switch (this.LastCbusMessage.mnemonic)
      {
        case "NERD":
          timeGap = 300
          break;
        case "NVRD":
          if ( this.LastCbusMessage.nodeVariableIndex == 0){
            timeGap = 300
          }
          break;
        case "QNN":
          timeGap = 400
          break;
        case "REVAL":
          if ( this.LastCbusMessage.eventVariableIndex == 0){
            timeGap = 300
          }
          break;
        case "REQEV":
          if ( this.LastCbusMessage.eventVariableIndex == 0){
            timeGap = 300
          }
          break;
        case "RQNPN":
          if ( this.LastCbusMessage.parameterIndex == 0){
            timeGap = 300
          }
          break;
        default:
      }
    } catch {}
    // reduce gap if doing unit tests
    timeGap = this.inUnitTest ? 1 : timeGap
    return timeGap
  }
    
  //
  // Function to check on a regular basis if anything has changed
  // and update client if so
  // aim is to reduce the traffic to client if rapid changes occur
  //
  updateClients(){
    //
    // check if any nodes have changed
    // assume nothing changed to start with
    let nodeConfigChanged = false
    for (let nodeNumber in this.nodeConfig.nodes) {
      // returns keyword, in this case the nodeNumber
      if(this.nodeConfig.nodes[nodeNumber].hasChanged){
        this.nodeConfig.nodes[nodeNumber].hasChanged = false
        winston.debug({message: name + ': checkIfNodeschanged: node ' + nodeNumber + ' has changed'})
        this.emit('node', this.nodeConfig.nodes[nodeNumber])
        nodeConfigChanged = true
      }
      //
      if (nodeConfigChanged){
        // something changed, so save to disk
        nodeConfigChanged = false
        this.config.writeNodeConfig(this.nodeConfig)
      }
    }
    //
    // check to see if events have changed
    if (this.eventsChanged){
      this.eventsChanged = false
      this.emit('events', this.nodeConfig.events)
    }

  }


//************************************************************************ */
//
// functions called by the socket service
// in alphabetical order
//
//************************************************************************ */

  // add any nodes that don't exist in node config
  // from layout data
  //  
  async addLayoutNodes(layoutData){
    winston.info({message: name + ': addLayoutNodes'});
    for (let nodeNumber in layoutData.nodeDetails) {
      if ( this.nodeConfig.nodes[nodeNumber] == undefined ){
        winston.info({message: name + ': addLayoutNodes - create node ' + nodeNumber});
        this.createNodeConfig(nodeNumber, false)
      }
    }
  }

  //
  //
  async query_all_nodes(){
    winston.info({message: name + ': query_all_nodes'});
    for (let node in this.nodeConfig.nodes) {
      try{
        this.createNodeConfig(node, false)    // false as we haven't had a response yet
      } catch{}
    }
    this.nodeDescriptors = {}   // force re-reading of module descriptors...
    this.moduleDescriptorFilesTimeStamp = Date.now()
    this.saveNodeConfig()
    this.CBUS_Queue.push(cbusLib.encodeQNN())
    this.config.getListOfBackupsForAllNodes(this.config.currentLayoutFolder)
  }

  async event_unlearn(nodeNumber, eventIdentifier) {
    this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
    let eventNodeNumber = parseInt(eventIdentifier.substr(0, 4), 16)
    let eventNumber = parseInt(eventIdentifier.substr(4, 4), 16)
    this.CBUS_Queue.push(cbusLib.encodeEVULN(eventNodeNumber, eventNumber))
    let timeGap = this.inUnitTest ? 1 : 300
    await sleep(timeGap); // allow a bit more time
    this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
    await this.request_all_node_events(nodeNumber)
  }

  //
  //  
  remove_node(nodeNumber) {
    try {
      winston.info({message: name + ': remove_node ' + nodeNumber});
      var nodes = Object.keys(this.nodeConfig.nodes)  // just get node numbers
      winston.debug({message: name + ': nodes ' + nodes});
      delete this.nodeConfig.nodes[nodeNumber]
      nodes = Object.keys(this.nodeConfig.nodes)  // just get node numbers
      winston.debug({message: name + ': nodes remaining ' + nodes});
      this.saveNodeConfig()
    } catch (err){
      winston.error({message: name + `: remove_node ${err}`});
    }
  }

  //
  //
  async delete_all_events(nodeNumber) {
    winston.debug({message: name + ': delete_all_events: node ' + nodeNumber});
    this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
    this.CBUS_Queue.push(cbusLib.encodeNNCLR(nodeNumber))
    let timeGap = this.inUnitTest ? 1 : 500
    await sleep(timeGap); // allow a bit more time
    this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
  }

  //
  // requests number of events for node
  // the response will then trigger a NERD
  // also request event space left
  //
  async request_all_node_events(nodeNumber){
    winston.debug({message: name +': request_all_node_events: node ' + nodeNumber});
    try{
      if (this.nodeConfig.nodes[nodeNumber] == undefined){this.createNodeConfig(nodeNumber, false)}
      // clear event count to force clearing & reload of events
      // ensures any events deleted are removed
      // this will force a NERD to be sent
      this.nodeConfig.nodes[nodeNumber].eventCount = undefined
      this.nodeConfig.nodes[nodeNumber].storedEventsNI = {}
      this.nodeConfig.nodes[nodeNumber].eventsByIndex = {}
      this.nodeConfig.nodes[nodeNumber].hasChanged = true
      this.CBUS_Queue.push(cbusLib.encodeRQEVN(nodeNumber)) // get number of events for each node
      // NUMEV response to RQEVN will trigger a NERD command as well
      // NERD must be last as could be cancelled by another command
    } catch (err){
      winston.error({message: name + `: request_all_node_events: ${err}` });
    }
  }

  //
  // requests number of events for node by index
  //
  async request_all_node_events_by_index(nodeNumber, numberOfEvents){
    winston.debug({message: name +': request_all_node_events_by_index: node ' + nodeNumber});
    try{
      if (this.nodeConfig.nodes[nodeNumber] == undefined){this.createNodeConfig(nodeNumber, false)}
      // clear event count to force clearing & reload of events
      // ensures any events deleted are removed
      this.nodeConfig.nodes[nodeNumber].eventCount = undefined
      this.nodeConfig.nodes[nodeNumber].storedEventsNI = {}
      this.nodeConfig.nodes[nodeNumber].eventsByIndex = {}
      this.nodeConfig.nodes[nodeNumber].hasChanged = true

      // check if the module has reported how many events it supports      
      let reportedNumberOfEvents = this.nodeConfig.nodes[nodeNumber].parameters[4]
      // use whichever is higher
      if (reportedNumberOfEvents > numberOfEvents){ numberOfEvents = reportedNumberOfEvents}
      winston.debug({message: name +`: request_all_node_events_by_index: numberOfEvents ${numberOfEvents}` });
      // lets go read them
      for(let eventIndex=1; eventIndex<= numberOfEvents; eventIndex++){
        this.request_node_event_by_index(nodeNumber, eventIndex)
      }
      this.CBUS_Queue.push(cbusLib.encodeRQEVN(nodeNumber)) // get number of events for each node
      // NUMEV response to RQEVN will trigger a NERD command as well
      // NERD must be last as could be cancelled by another command
    } catch(err){
      winston.error({message: name + `: request_all_node_events_by_index: ${err}` });
    }
  }

  //
  //
  async request_node_event_by_index(nodeNumber, eventIndex){
    winston.debug({message: name +`: request_node_event_by_index: node ${nodeNumber} eventIndex ${eventIndex}`});
    if (this.nodeConfig.nodes[nodeNumber] == undefined){this.createNodeConfig(nodeNumber, false)}
    this.CBUS_Queue.push(cbusLib.encodeNENRD(nodeNumber, eventIndex)) // get events for that index
  }

  //
  //
  async request_all_node_parameters(nodeNumber){
    winston.debug({message: name +`: request_all_node_parameters: node ${nodeNumber}`})
    if (this.nodeConfig.nodes[nodeNumber] == undefined) { this.createNodeConfig(nodeNumber, false) }
    // clear parameters to force full refresh
    this.nodeConfig.nodes[nodeNumber].parameters = {}
    this.nodeConfig.nodes[nodeNumber].paramsUpdated = false
    this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, 0))     // get number of node parameters
    await utils.sleep(200) // allow time for message to be sent & initial response
    // allow a gap in case we get multiple responses
    var timeGap = 400
    var count = 0   // add safety counter so while loop can't get stuck
    // but reduce gap if doing unit tests
    timeGap = this.inUnitTest ? 1 : timeGap
    // so now wait for the specified timeGap after the last message recieved
    // in case there was multiple responses (VLCB style)
    while ( Date.now() < this.lastCbusTrafficTime + timeGap){
      //winston.debug({message: name +': request_all_node_parameters: timeGap '})
      await utils.sleep(10)
      if (count++ > 100){break} // safety escape
    }
    // if we haven't received params 4, 5 or 6, then we need to request them individually
    // logical or
    if ( (this.nodeConfig.nodes[nodeNumber].parameters[4] == undefined) ||
      (this.nodeConfig.nodes[nodeNumber].parameters[5] == undefined) || 
      (this.nodeConfig.nodes[nodeNumber].parameters[6] == undefined) )
    {
      winston.debug({message: name +': request_all_node_parameters: request individually for node ' + nodeNumber})
      let nodeParameterCount = this.nodeConfig.nodes[nodeNumber].parameters[0]
      if (nodeParameterCount == undefined){nodeParameterCount = 20}
      for (let i = 1; i <= nodeParameterCount; i++) {
        this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, i))
      }
    }
  }

  //
  //
  async request_node_variable(nodeNumber, nodeVariableIndex){
    winston.debug({message: name + `:  request_node_variable ${nodeNumber} ${nodeVariableIndex}`});
    this.CBUS_Queue.push(cbusLib.encodeNVRD(nodeNumber, nodeVariableIndex))
  }

  //
  //
  async update_node_variable_in_learnMode(nodeNumber, nodeVariableIndex, nodeVariableValue){
    winston.debug({message: name + `: update_node_variable_in_learnMode ${nodeNumber} ${nodeVariableIndex}  ${nodeVariableValue}`});
    this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
    this.CBUS_Queue.push(cbusLib.encodeNVSET(nodeNumber, nodeVariableIndex, nodeVariableValue))
    this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
    // update timestamp
    this.nodeConfig.nodes[nodeNumber]['NodeModifiedTimestamp'] = Date.now()
  }

  //
  //
  async request_all_node_variables(nodeNumber){
    winston.debug({message: name + `:  request_all_node_variables ${nodeNumber}`});
    // only continue if we know number of node variables
    if (this.nodeConfig.nodes[nodeNumber].parameters[6] != undefined){
      let nodeVariableCount = this.nodeConfig.nodes[nodeNumber].parameters[6]
      if (this.nodeConfig.nodes[nodeNumber].VLCB){
        // expect to get all NV's back when requesting NV0
        // but check if we get at least one other NV, and if not, then request them all one-by-one
        this.nodeConfig.nodes[nodeNumber]['lastNVANSTimestamp'] = Date.now()
        let startTime = Date.now()
        this.CBUS_Queue.push(cbusLib.encodeNVRD(nodeNumber, 0))
        // reduce wait time if doing unit tests
        let waitTime = this.inUnitTest ? 10 : 400
        while(Date.now() < startTime + waitTime){
          // wait to see if we get a non-zero NV back, if so we assume all NV's returned
          await sleep(1)
          if (this.nodeConfig.nodes[nodeNumber].lastNVANSTimestamp > startTime){ break }
        }
        if (this.nodeConfig.nodes[nodeNumber].lastNVANSTimestamp <= startTime) {
          // didn't get at least one other NV, so request them all one-by-one
          for (let i = 1; i <= nodeVariableCount; i++) {
            this.CBUS_Queue.push(cbusLib.encodeNVRD(nodeNumber, i))
            await sleep(50); // allow time between requests
          }  
        }
      } else {
        // legacy CBUS, so request each variable one-by-one
        for (let i = 1; i <= nodeVariableCount; i++) {
          this.CBUS_Queue.push(cbusLib.encodeNVRD(nodeNumber, i))
          await sleep(50); // allow time between requests
        }
      }
    }
  }

  //
  //
  async event_teach_by_identifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue, reLoad) {
    winston.debug({message: name +': event_teach_by_identity: ' + nodeNumber + " " + eventIdentifier})
    if (reLoad == undefined){ reLoad = true }
    var isNewEvent = false
    if (utils.getEventTableIndexNI(this.nodeConfig.nodes[nodeNumber], eventIdentifier) == null){
      isNewEvent = true
      winston.info({message: name + ': event_teach_by_identifier - New event'});
    } 
    // updated variable, so add to config
    this.storeEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue)
    this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
    let eventNodeNumber = parseInt(eventIdentifier.substr(0, 4), 16)
    let eventNumber = parseInt(eventIdentifier.substr(4, 4), 16)
    this.CBUS_Queue.push(cbusLib.encodeEVLRN(eventNodeNumber, eventNumber, eventVariableIndex, eventVariableValue))
    this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
    // update timestamp
    this.nodeConfig.nodes[nodeNumber]['NodeModifiedTimestamp'] = Date.now()

    // don't reload variables if reload is false - like when restoring a node
    if (reLoad){
      if (isNewEvent){
        // adding new event may change event indexes, so need to refresh
        // get number of events for each node - response NUMEV will trigger NERD if event count changes
        this.CBUS_Queue.push(cbusLib.encodeRQEVN(nodeNumber))
        var timeOut = (this.inUnitTest) ? 1 : 250
        await sleep(timeOut); // allow a bit more time after EVLRN
        this.requestAllEventVariablesByIdentifier(nodeNumber, eventIdentifier)
      } else {
        this.requestEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex)
      }
    } else {
      winston.info({message: name + ': event_teach_by_identifier - reLoad false'});
    }
  }

  //
  //
  async event_teach_by_index(nodeNumber, eventIdentifier, eventIndex, eventVariableIndex, eventVariableValue, reLoad) {
    winston.debug({message: name +': event_teach_by_index: ' + nodeNumber + " " + eventIndex})
    if (reLoad == undefined){ reLoad = true }
    var isNewEvent = false
    if (this.nodeConfig.nodes[nodeNumber].eventsByIndex[eventIndex] == null){
      isNewEvent = true
      winston.info({message: name + ': event_teach_by_index - New event'});
    } 
    // updated variable, so add to config
    this.storeEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue)

    this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
    let eventNodeNumber = parseInt(eventIdentifier.substr(0, 4), 16)
    let eventNumber = parseInt(eventIdentifier.substr(4, 4), 16)
    this.CBUS_Queue.push(cbusLib.encodeEVLRNI(eventNodeNumber, eventNumber, eventIndex, eventVariableIndex, eventVariableValue))
    this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
    // update timestamp
    this.nodeConfig.nodes[nodeNumber]['NodeModifiedTimestamp'] = Date.now()

    // don't reload variables if reload is false - like when restoring a node
    if (reLoad){
      if (isNewEvent){
        // adding new event may change event indexes, so need to refresh
        // get number of events for each node - response NUMEV will trigger NERD if event count changes
        this.CBUS_Queue.push(cbusLib.encodeRQEVN(nodeNumber))
        var timeOut = (this.inUnitTest) ? 1 : 250
        await sleep(timeOut); // allow a bit more time after EVLRN
        //this.requestAllEventVariablesByIdentifier(nodeNumber, eventIdentifier)
      } else {
        this.requestEventVariableByIndex(nodeNumber, eventIndex, eventVariableIndex)
      }
    } else {
      winston.info({message: name + ': event_teach_by_index - reLoad false'});
    }
  }

  //
  // request individual event variable by Identifier
  //
  async requestEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex){
    winston.info({message: name + `: requestEventVariableByIdentifier ' ${nodeNumber} ${eventIdentifier} ${eventVariableIndex}`});

    try{
      if (this.nodeConfig.nodes[nodeNumber].VLCB){
        winston.info({message: name + `: requestEventVariableByIdentifier - VLCB Node'`});
        this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
        this.nodeNumberInLearnMode = nodeNumber
        let eventNodeNumber = parseInt(eventIdentifier.substr(0, 4), 16)
        let eventNumber = parseInt(eventIdentifier.substr(4, 4), 16)
        this.CBUS_Queue.push(cbusLib.encodeREQEV(eventNodeNumber, eventNumber, eventVariableIndex))
        this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
      } else {
        // originally used eventIdentity with REQEV & EVANS - but CBUSLib sends wrong nodeNumber in EVANS
        // So now uses eventIndex with REVAL/NEVAL, by finding eventIndex stored against eventIdentity
        // should not need to refresh event Indexes, as just asking for one variable
        var eventIndex = this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].eventIndex
        this.requestEventVariableByIndex(nodeNumber, eventIndex, eventVariableIndex)
      }
    } catch (err){
      winston.error({message: name + ': requestEventVariableByIdentifier: ' + err});
    }
  }

  //
  // request individual event variable by event index
  //
  async requestEventVariableByIndex(nodeNumber, eventIndex, eventVariableIndex){
    winston.info({message: name + `: requestEventVariableByIndex ' ${nodeNumber} ${eventIndex} ${eventVariableIndex}`});
    try {
      if (eventIndex){
        this.CBUS_Queue.push(cbusLib.encodeREVAL(nodeNumber, eventIndex, eventVariableIndex))
      } else {
        winston.info({message: name + ': requestEventVariableByIndex: no event index ' + eventIndex});
      }
    } catch (err){
      winston.error({message: name + ': requestEventVariableByIndex: ' + err});
    }
  }

  //
  // request all event variables for all events for specific node
  //
  async requestAllEventVariablesForNode(nodeNumber){
    winston.debug({message: name + `: requestAllEventVariablesForNode ${nodeNumber}` });
    var node = this.nodeConfig.nodes[nodeNumber]
    for (let eventIdentifier in node.storedEventsNI){
      winston.debug({message: name + `: requestAllEventVariablesForNode: eventIdentifier ${eventIdentifier}` });
      let startTime = Date.now()
      await this.requestAllEventVariablesByIdentifier(nodeNumber, eventIdentifier)
      // wait until the traffic has died down before doing next one
      let timeGap = 100
      while ( Date.now() < this.lastCbusTrafficTime + timeGap){
        //winston.debug({message: name + `: wait on eventIdentifier ${eventIdentifier}` });
        await sleep(1)
      }
      winston.debug({message: name + `: elapsed time  ${Date.now() - startTime}` });
      winston.debug({message: name + `: lastCbusTrafficTime  ${this.lastCbusTrafficTime}` });
    }
    winston.debug({message: name + `: requestAllEventVariablesForNode: END` });
  }

  //
  // request all event variables for specific event
  //
  async requestAllEventVariablesByIdentifier(nodeNumber, eventIdentifier){
    try {
    winston.info({message: name + `: requestAllEventVariablesByIdentifier: ${nodeNumber} ${eventIdentifier}` });

    if (this.nodeConfig.nodes[nodeNumber].VLCB){
      winston.info({message: name + `: requestEventVariablesByIdentifier - VLCB Node'`});
      // if VLCB, we can use REQEV to read all event variables with one command
      // expect to get all Event Variables's back when requesting EventVariableIndex 0
      // but check if we get at least one other eventVariableIndex, and if not, then request them all one-by-one
      this.nodeConfig.nodes[nodeNumber]['lastEVANSTimestamp'] = Date.now()
      let startTime = Date.now()
      this.Read_EV_in_learn_mode(nodeNumber, eventIdentifier, 0)
      // reduce wait time if doing unit tests
      // timeout needs to be long enough to cater for putting into learn mode as well as sending REQEV + receiving 2+ EVANS responses
      let waitTime = this.inUnitTest ? 100 : 400
      while(Date.now() < startTime + waitTime){
        // wait to see if we get a non-zero EV# back, if so we assume all EV's returned
        // if lastEVANSTimestamp is greater than start time, then we have multiple responses
        if (this.nodeConfig.nodes[nodeNumber].lastEVANSTimestamp > startTime){
          winston.debug({message: name + `: requestAllEventVariablesByIdentifier: break time ${this.nodeConfig.nodes[nodeNumber].lastEVANSTimestamp-startTime}`});
          break
        }
        await sleep(1)
      }
      winston.debug({message: name + `: requestAllEventVariablesByIdentifier: Time ${this.nodeConfig.nodes[nodeNumber].lastEVANSTimestamp-startTime}`});
      // if lastEVANSTimestamp is less than start time, then we didn't get multiple responses
      if (this.nodeConfig.nodes[nodeNumber].lastEVANSTimestamp <= startTime) {
        // didn't get at least one other NV, so request them all one-by-one
        winston.info({message: name + `: requestAllEventVariablesByIdentifier: fallback to one-by-one ${nodeNumber} ${eventIdentifier}`});
        // get number of variables from param 5
        let numberOfVariables = this.nodeConfig.nodes[nodeNumber].parameters[5]
        let eventNI = this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier]
        winston.info({message: name + `: requestAllEventVariablesByIdentifier:  event ${JSON.stringify(eventNI)}`});
        try{
          numberOfVariables = eventNI.variables[0]
        } catch (err){
          winston.error({message: name + `: requestAllEventVariablesByIdentifier: EV0 ${err}`});
        }
        for (let i = 1; i <= numberOfVariables; i++) {
          this.Read_EV_in_learn_mode(nodeNumber, eventIdentifier, i)
        }
      }
    } else {
      // Not VLCB, so request them all one-by-one using 'legacy' CBUS mechanism
      // REQEV/EVANS can't be used due to bug in EVANS response in CBUS library
      // So uses eventIndex with REVAL/NEVAL
      // first we need to ensure the event indexes are up to date
      await this.refreshEventIndexes(nodeNumber)
      // Then get the eventIndex
      var eventIndex = this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].eventIndex
      await this.requestAllEventVariablesByIndex(nodeNumber, eventIndex)
    }
  } catch (err){
    winston.error({message: name + `: requestAllEventVariablesByIdentifier: ${err}`});
  }
  }

  //
  // To use REQEV, the module needs to be in learn mode
  // but then can use the eventIdentifier directly, bypassing the need to use eventIndex
  //
  async Read_EV_in_learn_mode(nodeNumber, eventIdentifier, eventVariableIndex){
    this.CBUS_Queue.push(cbusLib.encodeNNLRN(nodeNumber))
    this.nodeNumberInLearnMode = nodeNumber
    let eventNodeNumber = parseInt(eventIdentifier.substr(0, 4), 16)
    let eventNumber = parseInt(eventIdentifier.substr(4, 4), 16)
    this.CBUS_Queue.push(cbusLib.encodeREQEV(eventNodeNumber, eventNumber, eventVariableIndex))
    this.CBUS_Queue.push(cbusLib.encodeNNULN(nodeNumber))
    // don't change nodeNumberInLearnMode value, as we may receive multiple responses to REQEV
  }

  //
  // refresh all event indexes by issuing a NERD command
  // wait alittle while for it to complete
  //
  async refreshEventIndexes(nodeNumber){
    this.CBUS_Queue.push(cbusLib.encodeNERD(nodeNumber))   // push node onto queue to read all events
    var timeGap = this.inUnitTest ? 10 : 400
    await utils.sleep(timeGap)  // wait 400mS for it to complete
  }

  //  
  // Requests all event variables for a specific event, referenced by event index
  // event indexes need to be up to date
  // Used outside of learn mode
  //
  async requestAllEventVariablesByIndex(nodeNumber, eventIndex){
    winston.debug({message: name + `: requestAllEventVariablesByIndex: node ${nodeNumber} eventIndex ${eventIndex}`});
    try {
      //
      // 'legacy' CBUS, so try reading EV0 - should return number of event variables
      this.CBUS_Queue.push(cbusLib.encodeREVAL(nodeNumber, eventIndex, 0))
      var timeGap = this.inUnitTest ? 100 : 100
      await sleep(timeGap); // wait for a response before trying to use it
      // now assume number of variables from param 5
      var numberOfVariables = this.nodeConfig.nodes[nodeNumber].parameters[5]
      // but use the value in EV0 if it exists
      try{
        let eventVariable0 = this.nodeConfig.nodes[nodeNumber].eventsByIndex[eventIndex].variables[0]
        winston.debug({message: name + `: requestAllEventVariablesByIndex: index  ${eventIndex} EV0 ${eventVariable0}`});
        if (eventVariable0 > 0 ){ numberOfVariables = eventVariable0 }
      } catch(err){
        winston.error({message: name + ': requestAllEventVariablesByIndex: read EV0: ' + err});
      }
      //
      // now read all the rest of the event variables
      winston.debug({message: name + `: requestAllEventVariablesByIndex: numberOfVariables ${numberOfVariables}`});
      for (let i = 1; i <= numberOfVariables; i++) {
        this.CBUS_Queue.push(cbusLib.encodeREVAL(nodeNumber, eventIndex, i))
      }
    } catch (err) {
      winston.error({message: name + ': requestAllEventVariablesByIndex: ' + err});
    }
  }
//************************************************************************ */
//
// Functions to send CBUS commands
// in opcode order
//
//************************************************************************ */    
  
  // 0x42
  //
  sendSNN(nodeNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeSNN(nodeNumber))
    } catch (err) {
      winston.error({message: name + `: sendSNN: ${err}`});
    }
  }

  // 0x58
  //
  sendRQEVN(nodeNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeRQEVN(nodeNumber))
    } catch (err) {
      winston.error({message: name + `: sendRQEVN: ${err}`});
    }
  }

  // 0x5D ENUM
  //
  sendENUM(nodeNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeENUM(nodeNumber))
    } catch (err) {
      winston.error({message: name + `: sendENUM: ${err}`});
    }
  }

  // 0x5E NNRST
  //
  sendNNRST(nodeNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeNNRST(nodeNumber))
    } catch (err) {
      winston.error({message: name + `: sendNNRST: ${err}`});
    }
  }

  // 0x73 RQNPN
  //
  sendRQNPN(nodeNumber, param) {//Read Node Parameter
    try{
      this.CBUS_Queue.push(cbusLib.encodeRQNPN(nodeNumber, param))
    } catch (err) {
      winston.error({message: name + `: sendRQNPN: ${err}`});
    }
  }

  // 0x75 CANID
  //
  sendCANID(nodeNumber, CAN_ID) {//Read Node Parameter
    try{
      this.CBUS_Queue.push(cbusLib.encodeCANID(nodeNumber, CAN_ID))
    } catch (err) {
      winston.error({message: name + `: sendCANID: ${err}`});
    }
  }

  // 0x78 RQSD
  //
  sendRQSD(nodeNumber, service) { //Request Service Delivery
    try{
      this.CBUS_Queue.push(cbusLib.encodeRQSD(nodeNumber, service))
    } catch (err) {
      winston.error({message: name + `: sendRQSD: ${err}`});
    }
  }

  // 0x87 RDGN
  //
  sendRDGN(nodeNumber, service, diagCode) { //Request Diagnostics
    try{
      this.CBUS_Queue.push(cbusLib.encodeRDGN(nodeNumber, service, diagCode))
    } catch (err) {
      winston.error({message: name + `: sendRDGN: ${err}`});
    }
  }

  // 0x90 AC0N
  //
  sendACON(nodeNumber, eventNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeACON(nodeNumber, eventNumber))
      this.eventSend(nodeNumber, eventNumber, 'on', 'long')
    } catch (err) {
      winston.error({message: name + `: sendACON: ${err}`});
    }
  }

  // 0x91 AC0F
  //
  sendACOF(nodeNumber, eventNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeACOF(nodeNumber, eventNumber))
      this.eventSend(nodeNumber, eventNumber, 'off', 'long')
    } catch (err) {
      winston.error({message: name + `: sendACOF: ${err}`});
    }
  }

  // 0x96
  //
  sendNVSET(nodeNumber, variableId, variableVal) { // Read Node Variable
    try{
      this.CBUS_Queue.push(cbusLib.encodeNVSET(nodeNumber, variableId, variableVal))
      this.nodeConfig.nodes[nodeNumber]['NodeModifiedTimestamp'] = Date.now()
    } catch (err) {
      winston.error({message: name + `: sendNVSET: ${err}`});
    }
  }

  // 0x98 ASON
  //
  sendASON(nodeNumber, deviceNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeASON(nodeNumber, deviceNumber))
      this.eventSend(nodeNumber, deviceNumber, 'on', 'short')
    } catch (err) {
      winston.error({message: name + `: sendASON: ${err}`});
    }
  }

  // 0x99 ASOF
  //
  sendASOF(nodeNumber, deviceNumber) {
    try{
      this.CBUS_Queue.push(cbusLib.encodeASOF(nodeNumber, deviceNumber))
      this.eventSend(nodeNumber, deviceNumber, 'off', 'short')
    } catch (err) {
      winston.error({message: name + `: sendASOF: ${err}`});
    }
  }

  // 0x9C REVAL
  //
  sendREVAL(nodeNumber, eventIndex, eventVariableIndex) {//Read an Events EV by index
    try{
      this.CBUS_Queue.push(cbusLib.encodeREVAL(nodeNumber, eventIndex, eventVariableIndex))
    } catch (err) {
      winston.error({message: name + `: sendREVAL: ${err}`});
    }
  }

///////////////////////////////////////////////////////////////////////////////////////////////////  
//
// MDF related methods
//
///////////////////////////////////////////////////////////////////////////////////////////////////  

  //
  //
  //
  refreshAllNodeDescriptors(){
    winston.debug({message: name + ': refreshAllNodeDescriptors'});
    // refresh time stamp so that all node descriptors will be refreshed
    this.moduleDescriptorFilesTimeStamp = Date.now()
    Object.keys(this.nodeConfig.nodes).forEach(async nodeNumber => {
      this.nodeDescripter_Queue.push(nodeNumber)
    })
  }

  //
  //
  //
  refreshNodeDescriptor(nodeNumber){
    winston.debug({message: name + `: refreshNodeDescriptor: node ${nodeNumber} `});
    // refresh time stamp so that the node descriptor for this node will be refreshed
    this.nodeConfig.nodes[nodeNumber].getNodeDescriptorTimeStamp = 0
    this.nodeDescripter_Queue.push(nodeNumber)
  }

  //
  // Method to allow checking of MDF's without blocking
  //
  checkNodeDescriptorIntervalFunc(){
    try{
      if (this.nodeDescripter_Queue.length > 0){
        // get first out of queue
        var nodeNumber = this.nodeDescripter_Queue[0]
        let needsMDF = false
        // check if we really need to go get the MDF for this node, as it's quite time consuming
        // uses timestamps so we can avoid repeatedly trying to read the MDF, as it may not exist
        if ( this.nodeConfig.nodes[nodeNumber].getNodeDescriptorTimeStamp == undefined){ needsMDF = true }
        if ( this.nodeConfig.nodes[nodeNumber].getNodeDescriptorTimeStamp < this.moduleDescriptorFilesTimeStamp){ needsMDF = true }
        //
        if (needsMDF){
          this.getNodeDescriptor(nodeNumber, false)
        }
        // remove the one we've used from queue
        this.nodeDescripter_Queue.shift()
      }
    } catch (err){
      winston.error({message: name + `: checkNodeDescriptorIntervalFunc: ${err}` });              
    }
  }

  //
  // gets a module descriptor for this node
  // needs to check that required information is available
  //
  getNodeDescriptor(nodeNumber){
    try{
      if (this.nodeConfig.nodes[nodeNumber]){
        // get the required information
        let moduleIdentifier = this.nodeConfig.nodes[nodeNumber].moduleIdentifier
        let moduleVersion = this.nodeConfig.nodes[nodeNumber].moduleVersion
        let processorType = this.nodeConfig.nodes[nodeNumber].processorType
        // can only continue if we have the required information
        if ((moduleIdentifier != undefined) && (moduleVersion != undefined) && (processorType != undefined)){
          winston.debug({message: name + `: getNodeDescriptor:
            nodeNumber ${nodeNumber}
            moduleIdentifier ${moduleIdentifier}
            moduleVersion ${moduleVersion}
            processorType ${processorType}`
          });
          // ok, information available, so lets go get the file
          const moduleDescriptor = this.config.getMatchingModuleDescriptorFile(moduleIdentifier, moduleVersion, "P" + processorType)
          // update timestamp here so we don't keep repeating this if the file doesn't exist
          this.nodeConfig.nodes[nodeNumber]['getNodeDescriptorTimeStamp'] = Date.now()
          // now check we did get an actual file
          let payload = {[nodeNumber]:{}}
          if (moduleDescriptor){
            this.nodeDescriptors[nodeNumber] = moduleDescriptor
            this.nodeConfig.nodes[nodeNumber]['moduleDescriptorFilename'] = moduleDescriptor.moduleDescriptorFilename
            this.config.writeNodeDescriptors(this.nodeDescriptors)
            winston.info({message: name +`: getNodeDescriptor: loaded file: node ${nodeNumber} file ${moduleDescriptor.moduleDescriptorFilename}`});
            payload = {[nodeNumber]:moduleDescriptor}
          } else {
            winston.info({message: name + `: getNodeDescriptor: failed to load file
              nodeNumber ${nodeNumber}
              moduleIdentifier ${moduleIdentifier}
              moduleVersion ${moduleVersion}
              processorType ${processorType}`
            });
          }
          this.emit('nodeDescriptor', payload);
        } else {
          winston.debug({message: name + `: getNodeDescriptor: missing information
            nodeNumber ${nodeNumber}
            moduleIdentifier ${moduleIdentifier}
            moduleVersion ${moduleVersion}
            processorType ${processorType}`
          });
        }
      } else {
        winston.error({message: name + `: getNodeDescriptor: no such node: nodeNumber ${nodeNumber}`});
      }
    } catch (err){
      winston.error({message: name + `: getNodeDescriptor: node ${nodeNumber} ${err}` });              
    }
  }

};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = (config) => { return new cbusAdmin(config) }
