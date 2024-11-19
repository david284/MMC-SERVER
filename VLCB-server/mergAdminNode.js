const winston = require('winston');		// use config from root instance
const net = require('net')
let cbusLib = require('cbuslibrary')
const EventEmitter = require('events').EventEmitter;
const utils = require('./../VLCB-server/utilities.js');
const { isUndefined } = require('util');

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
        this.saveConfig()
        this.setNodeNumberIssued = false
        this.nodeNumberInLearnMode = null

        const outHeader = ((((this.pr1 * 4) + this.pr2) * 128) + this.canId) << 5
        this.header = ':S' + outHeader.toString(16).toUpperCase() + 'N'
        this.client = new net.Socket()

        this.lastReceiveTime = Date.now()   // put valid milliseconds in to start
        this.lastMessageWasQNN = false
        this.QNN_sent_time = Date.now()   // put valid milliseconds in to start
        this.NERD_Queue = []
        this.NERD_Queue_Count = 0;
        setInterval(this.sendNERDIntervalFunc.bind(this), 50);
        this.RQEVN_Queue = []
        setInterval(this.sendRQEVNIntervalFunc.bind(this), 50);

        this.CBUS_Queue = []
        setInterval(this.sendCBUSIntervalFunc.bind(this), 20);

        //
        this.client.on('data', async function (data) { //Receives packets from network and process individual Messages
          this.lastReceiveTime = Date.now()     // store this time stamp
          //const outMsg = data.toString().split(";")
            let indata = data.toString().replace(/}{/g, "}|{")
            //winston.info({message: `mergAdminNode: CBUS Receive <<<  ${indata}`})
            const outMsg = indata.toString().split("|")
            //const outMsg = JSON.parse(data)
            //winston.info({message: `mergAdminNode: Split <<<  ${outMsg.length}`})
            for (let i = 0; i < outMsg.length; i++) {

                //let cbusMsg = cbusLib.decode(outMsg[i].concat(";"))     // replace terminator removed by 'split' method
                winston.debug({message: `mergAdminNode: CBUS Receive <<<  ${outMsg[i]}`})
                var msg = JSON.parse(outMsg[i])
                this.emit('cbusTraffic', {direction: 'In', json: msg});
                if (this.isMessageValid(msg)){
                  this.action_message(msg)
                }
            }
        }.bind(this))

        this.client.on('error', (err) => {
            winston.debug({message: 'mergAdminNode: TCP ERROR ' + err});
        })

        //
        this.client.on('close', function () {
            winston.debug({message: 'mergAdminNode: Connection Closed'});
            setTimeout(() => {
                this.client.connect(config.getJsonServerPort(), config.getServerAddress(), function () {
                    winston.debug({message: 'mergAdminNode: Client ReConnected'});
                })
            }, 1000)
        }.bind(this))

        //
        this.actions = { //actions when Opcodes are received
            '00': async (cbusMsg) => { // ACK
                winston.info({message: "mergAdminNode: ACK (00) : No Action"});
            },
            '21': async (cbusMsg) => { // KLOC
                winston.info({message: `mergAdminNode: Session Cleared : ${cbusMsg.session}`});
                let ref = cbusMsg.opCode
                let session = cbusMsg.session
                if (session in this.dccSessions) {
                    this.dccSessions[session].status = 'In Active'
                } else {
                    winston.debug({message: `mergAdminNode: Session ${session} does not exist - adding`});
                    this.dccSessions[session] = {}
                    this.dccSessions[session].count = 1
                    this.dccSessions[session].status = 'In Active'
                    this.CBUS_Queue.push(this.QLOC(session))
                }
                this.emit('dccSessions', this.dccSessions)
            },
            '23': async (cbusMsg) => { // DKEEP
                //winston.debug({message: `mergAdminNode: Session Keep Alive : ${cbusMsg.session}`});
                let ref = cbusMsg.opCode
                let session = cbusMsg.session

                if (session in this.dccSessions) {
                    this.dccSessions[session].count += 1
                    this.dccSessions[session].status = 'Active'
                } else {

                    winston.debug({message: `mergAdminNode: Session ${session} does not exist - adding`});

                    this.dccSessions[session] = {}
                    this.dccSessions[session].count = 1
                    this.dccSessions[session].status = 'Active'
                    this.CBUS_Queue.push(this.QLOC(session))
                }
                this.emit('dccSessions', this.dccSessions)
            },

            '47': async (cbusMsg) => { // DSPD
                let session = cbusMsg.session
                let speed = cbusMsg.speed
                let direction = cbusMsg.direction
                winston.info({message: `mergAdminNode: (47) DCC Speed Change : ${session} : ${direction} : ${speed}`});

                if (!(session in this.dccSessions)) {
                    this.dccSessions[session] = {}
                    this.dccSessions[session].count = 0
                }

                this.dccSessions[session].direction = direction
                this.dccSessions[session].speed = speed
                this.emit('dccSessions', this.dccSessions)
            },
            '50': async (cbusMsg) => {// RQNN -  Node Number
              winston.debug({message: "mergAdminNode: RQNN (50) : " + cbusMsg.text});
              this.emit('requestNodeNumber', cbusMsg.nodeNumber)
            },
            '52': async (cbusMsg) => {
              // NNACK - acknowledge
                winston.debug({message: "mergAdminNode: NNACK (59) : " + cbusMsg.text});
                // if acknowledge for set node number then query all nodes
                if (this.setNodeNumberIssued){
                  this.setNodeNumberIssued = false
                  this.query_all_nodes()   // force refresh of nodes
                }
            },
            '59': async (cbusMsg) => {
                winston.debug({message: "mergAdminNode: WRACK (59) : " + cbusMsg.text});
                this.process_WRACK(cbusMsg)
            },
            '60': async (cbusMsg) => {
                let session = cbusMsg.session
                if (!(session in this.dccSessions)) {
                    this.dccSessions[session] = {}
                    this.dccSessions[session].count = 0
                }
                let functionRange = cbusMsg.Fn1
                let dccNMRA = cbusMsg.Fn2
                let func = `F${functionRange}`
                this.dccSessions[session][func] = dccNMRA
                let functionArray = []
                if (this.dccSessions[session].F1 & 1) functionArray.push(1)
                if (this.dccSessions[session].F1 & 2) functionArray.push(2)
                if (this.dccSessions[session].F1 & 4) functionArray.push(3)
                if (this.dccSessions[session].F1 & 8) functionArray.push(4)
                if (this.dccSessions[session].F2 & 1) functionArray.push(5)
                if (this.dccSessions[session].F2 & 2) functionArray.push(6)
                if (this.dccSessions[session].F2 & 4) functionArray.push(7)
                if (this.dccSessions[session].F2 & 8) functionArray.push(8)
                if (this.dccSessions[session].F3 & 1) functionArray.push(9)
                if (this.dccSessions[session].F3 & 2) functionArray.push(10)
                if (this.dccSessions[session].F3 & 4) functionArray.push(11)
                if (this.dccSessions[session].F3 & 8) functionArray.push(12)
                if (this.dccSessions[session].F4 & 1) functionArray.push(13)
                if (this.dccSessions[session].F4 & 2) functionArray.push(14)
                if (this.dccSessions[session].F4 & 4) functionArray.push(15)
                if (this.dccSessions[session].F4 & 8) functionArray.push(16)
                if (this.dccSessions[session].F4 & 16) functionArray.push(17)
                if (this.dccSessions[session].F4 & 32) functionArray.push(18)
                if (this.dccSessions[session].F4 & 64) functionArray.push(19)
                if (this.dccSessions[session].F4 & 128) functionArray.push(20)
                if (this.dccSessions[session].F5 & 1) functionArray.push(21)
                if (this.dccSessions[session].F5 & 2) functionArray.push(22)
                if (this.dccSessions[session].F5 & 4) functionArray.push(23)
                if (this.dccSessions[session].F5 & 8) functionArray.push(24)
                if (this.dccSessions[session].F5 & 16) functionArray.push(25)
                if (this.dccSessions[session].F5 & 32) functionArray.push(26)
                if (this.dccSessions[session].F5 & 64) functionArray.push(27)
                if (this.dccSessions[session].F5 & 128) functionArray.push(28)
                this.dccSessions[session].functions = functionArray

                winston.debug({message: `mergAdminNode: DCC Set Engine Function : ${cbusMsg.session} ${functionRange} ${dccNMRA} : ${functionArray}`});
                this.emit('dccSessions', this.dccSessions)
            },
            '63': async (cbusMsg) => {// ERR - dcc error
                //winston.debug({message: `mergAdminNode: DCC ERROR Node ${msg.nodeNumber()} Error ${msg.errorId()}`});
                let output = {}
                output['type'] = 'DCC'
                output['Error'] = cbusMsg.errorNumber
                output['Message'] = this.merg.dccErrors[cbusMsg.errorNumber]
                output['data'] = utils.decToHex(cbusMsg.data1, 2) + utils.decToHex(cbusMsg.data2, 2)
                this.emit('dccError', output)
            },
            '6F': async (cbusMsg) => {// CMDERR - Cbus Error
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
            },
            '74': async (cbusMsg) => { // NUMEV - response to RQEVN
                //winston.info({message: 'mergAdminNode: 74: ' + JSON.stringify(this.nodeConfig.nodes[cbusMsg.nodeNumber])})
                if (this.nodeConfig.nodes[cbusMsg.nodeNumber].eventCount != null) {
                  if (this.nodeConfig.nodes[cbusMsg.nodeNumber].eventCount != cbusMsg.eventCount) {
                      this.nodeConfig.nodes[cbusMsg.nodeNumber].eventCount = cbusMsg.eventCount
                      this.saveNode(cbusMsg.nodeNumber)
                      this.NERD_Queue.push(cbusMsg.nodeNumber)   // push node onto queue to read all events
                    } else {
                      winston.debug({message: `mergAdminNode:  NUMEV: EvCount value has not changed`});
                  }
                } else {
                  this.nodeConfig.nodes[cbusMsg.nodeNumber].eventCount = cbusMsg.eventCount
                  this.saveNode(cbusMsg.nodeNumber)
                  this.NERD_Queue.push(cbusMsg.nodeNumber)   // push node onto queue to read all events
                }
            },
            '90': async (cbusMsg) => {//Accessory On Long Event
                //winston.info({message: `mergAdminNode:  90 recieved`})
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
            },
            '91': async (cbusMsg) => {//Accessory Off Long Event
                //winston.info({message: `mergAdminNode: 91 recieved`})
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
            },
            '97': async (cbusMsg) => { // NVANS - Receive Node Variable Value
                if (this.nodeConfig.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] != null) {
                    if (this.nodeConfig.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] != cbusMsg.nodeVariableValue) {
                        //winston.info({message: `mergAdminNode: Variable ${cbusMsg.nodeVariableIndex} value has changed`});
                        this.nodeConfig.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue
                        this.saveNode(cbusMsg.nodeNumber)
                    } else {
                        //winston.info({message: `mergAdminNode: Variable ${cbusMsg.nodeVariableIndex} value has not changed`});
                    }
                } else {
                    //winston.info({message: `mergAdminNode: Variable ${cbusMsg.nodeVariableIndex} value does not exist in config`});
                    this.nodeConfig.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue
                    this.saveNode(cbusMsg.nodeNumber)
                }
            },
            '98': async (cbusMsg) => {//Accessory On Short Event
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
            },
            '99': async (cbusMsg) => {//Accessory Off Short Event
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
            },
            '9B': async (cbusMsg) => {//PARAN Parameter readback by Index
                let saveConfigNeeded = false
                if (cbusMsg.parameterIndex == 1) {
                    if (this.nodeConfig.nodes[cbusMsg.nodeNumber].moduleManufacturerName != merg.moduleManufacturerName[cbusMsg.parameterValue]) {
                        this.nodeConfig.nodes[cbusMsg.nodeNumber].moduleManufacturerName = merg.moduleManufacturerName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (cbusMsg.parameterIndex == 9) {
                    if (this.nodeConfig.nodes[cbusMsg.nodeNumber].cpuName != merg.cpuName[cbusMsg.parameterValue]) {
                        this.nodeConfig.nodes[cbusMsg.nodeNumber].cpuName = merg.cpuName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (cbusMsg.parameterIndex == 10) {
                    if (this.nodeConfig.nodes[cbusMsg.nodeNumber].interfaceName != merg.interfaceName[cbusMsg.parameterValue]) {
                        this.nodeConfig.nodes[cbusMsg.nodeNumber].interfaceName = merg.interfaceName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (cbusMsg.parameterIndex == 19) {
                    if (this.nodeConfig.nodes[cbusMsg.nodeNumber].cpuManufacturerName != merg.cpuManufacturerName[cbusMsg.parameterValue]) {
                        this.nodeConfig.nodes[cbusMsg.nodeNumber].cpuManufacturerName = merg.cpuManufacturerName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (this.nodeConfig.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] !== null) {
                    if (this.nodeConfig.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] != cbusMsg.parameterValue) {
                        winston.debug({message: `mergAdminNode: Parameter ${cbusMsg.parameterIndex} value has changed`});
                        this.nodeConfig.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] = cbusMsg.parameterValue
                        saveConfigNeeded = true
                    } else {
                        winston.info({message: `mergAdminNode: Parameter ${cbusMsg.parameterIndex} value has not changed`});
                    }
                } else {
                    winston.info({message: `mergAdminNode: Parameter ${cbusMsg.parameterIndex} value does not exist in config`});
                    this.nodeConfig.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] = cbusMsg.parameterValue
                    saveConfigNeeded = true
                }
                // ok, save the config if needed
                if (saveConfigNeeded == true) {
                    this.saveNode(cbusMsg.nodeNumber)
                }
            },
            'AB': async (cbusMsg) => {//Heartbeat
                winston.debug({message: `mergAdminNode: Heartbeat ${cbusMsg.nodeNumber} ${Date.now()}`})
                this.heartbeats[cbusMsg.nodeNumber] = Date.now()
            },
            'AC': async (cbusMsg) => {//Service Discovery
                winston.info({message: `mergAdminNode: SD ${cbusMsg.nodeNumber} ${cbusMsg.text}`})
                utils.createServiceEntry(this.nodeConfig, 
                  cbusMsg.nodeNumber,
                  cbusMsg.ServiceIndex,
                  cbusMsg.ServiceType,
                  cbusMsg.ServiceVersion,
                  this.ServiceDefs
                )
                this.saveNode(cbusMsg.nodeNumber)
                if (cbusMsg.ServiceIndex > 0){
                  this.CBUS_Queue.push(this.RQSD(cbusMsg.nodeNumber, cbusMsg.ServiceIndex))
                }
            },
            'AF': async (cbusMsg) => {//GRSP
                winston.debug({message: `mergAdminNode: GRSP ` + cbusMsg.text})
                await this.process_GRSP(cbusMsg)
            },
            'B0': async (cbusMsg) => {//Accessory On Long Event 1
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
            },
            'B1': async (cbusMsg) => {//Accessory Off Long Event 1
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
            },
            'B5': async (cbusMsg) => {// NEVAL -Read of EV value Response REVAL
              this.storeEventVariableByIndex(cbusMsg.nodeNumber, cbusMsg.eventIndex, cbusMsg.eventVariableIndex, cbusMsg.eventVariableValue)
            },
            'B6': async (cbusMsg) => { //PNN Received from Node
              const ref = cbusMsg.nodeNumber
              // don't process the PNN if it's node number 0, as it's an uninitialsed module
              if (ref > 0){
                const moduleIdentifier = cbusMsg.encoded.toString().substr(13, 4).toUpperCase()
                if (ref in this.nodeConfig.nodes) {
                  // already exists in config file...
                  winston.debug({message: name + `: PNN (B6) Node found ` + JSON.stringify(this.nodeConfig.nodes[ref])})
                } else {
                  this.createNodeConfig(cbusMsg.nodeNumber)
                }
                this.nodeConfig.nodes[ref].CANID = utils.getMGCCANID(cbusMsg.encoded)
                this.nodeConfig.nodes[ref].manufacturerId = cbusMsg.manufacturerId
                this.nodeConfig.nodes[ref].moduleId = cbusMsg.moduleId
                this.nodeConfig.nodes[ref].moduleIdentifier =  moduleIdentifier
                this.nodeConfig.nodes[ref].moduleName = this.getModuleName(moduleIdentifier)
                // force variableConfig to be reloaded
                this.nodeConfig.nodes[ref].variableConfig = undefined
                // always update/create the flags....
                this.nodeConfig.nodes[ref].flags = cbusMsg.flags
                this.nodeConfig.nodes[ref].flim = (cbusMsg.flags & 4) ? true : false
                this.nodeConfig.nodes[ref].consumer = (cbusMsg.flags & 1) ? true : false
                this.nodeConfig.nodes[ref].producer = (cbusMsg.flags & 2) ? true : false
                this.nodeConfig.nodes[ref].bootloader = (cbusMsg.flags & 8) ? true : false
                this.nodeConfig.nodes[ref].coe = (cbusMsg.flags & 16) ? true : false
                this.nodeConfig.nodes[ref].learn = (cbusMsg.flags & 32) ? true : false
                this.nodeConfig.nodes[ref].VLCB = (cbusMsg.flags & 64) ? true : false
                this.nodeConfig.nodes[ref].status = true
                this.RQEVN_Queue.push(cbusMsg.nodeNumber)   // push node onto queue to read all events
                this.saveNode(cbusMsg.nodeNumber)
                // now get file list & send event to socketServer
                this.emit('node_descriptor_file_list', cbusMsg.nodeNumber, config.getModuleDescriptorFileList(moduleIdentifier))
              }
            },
            'B8': async (cbusMsg) => {//Accessory On Short Event 1
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
            },
            'B9': async (cbusMsg) => {//Accessory Off Short Event 1
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
            },
            'C7': async (cbusMsg) => {//Diagnostic
                winston.info({message: `DGN: ${cbusMsg.text}`})
                const ref = cbusMsg.nodeNumber
                if (cbusMsg.ServiceIndex > 0) {
                  // all valid service indexes start from 1 - service index 0 returns count of services
                  if (ref in this.nodeConfig.nodes) {
                    if (this.nodeConfig.nodes[ref]["services"][cbusMsg.ServiceIndex]) {
                      const ServiceType = this.nodeConfig.nodes[ref]["services"][cbusMsg.ServiceIndex]['ServiceType']
                      const ServiceVersion = this.nodeConfig.nodes[ref]["services"][cbusMsg.ServiceIndex]['ServiceVersion']
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
                      this.nodeConfig.nodes[ref]["services"][cbusMsg.ServiceIndex]['diagnostics'][cbusMsg.DiagnosticCode] = output
                      this.saveNode(cbusMsg.nodeNumber)
                    }
                    else {
                          winston.warn({message: name + `: DGN: node config services does not exist for node ${cbusMsg.nodeNumber}`});
                    }
                  }
                  else {
                          winston.warn({message: name + `: DGN: node config does not exist for node ${cbusMsg.nodeNumber}`});
                  }
                }
            },
            'D0': async (cbusMsg) => {//Accessory On Long Event 2
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
            },
            'D1': async (cbusMsg) => {//Accessory Off Long Event 2
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
            },
            'D3': async (cbusMsg) => {// EVANS - response to REQEV
              //
              var nodeNumber = this.nodeNumberInLearnMode
              var eventIdentifier = utils.decToHex(cbusMsg.nodeNumber, 4) + utils.decToHex(cbusMsg.eventNumber, 4) 
              this.storeEventVariableByIdentifier(nodeNumber, eventIdentifier, cbusMsg.eventVariableIndex, cbusMsg.eventVariableValue)
              winston.debug({message: name + `: EVANS(D3): eventIdentifier ${eventIdentifier}`});
              var tableIndex = utils.getEventTableIndex( this.nodeConfig.nodes[nodeNumber], eventIdentifier)
              winston.debug({message: name + `: EVANS(D3): tableIndex ${tableIndex}`});              
              if (tableIndex != null) {
                if (this.nodeConfig.nodes[nodeNumber].storedEvents[tableIndex].variables[cbusMsg.eventVariableIndex] != null) {
                    if (this.nodeConfig.nodes[nodeNumber].storedEvents[tableIndex].variables[cbusMsg.eventVariableIndex] != cbusMsg.eventVariableValue) {
                        winston.debug({message: name + `: EVANS(D3): Event Variable ${cbusMsg.variable} Value has Changed `});
                        this.nodeConfig.nodes[nodeNumber].storedEvents[tableIndex].variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue
                        this.saveNode(nodeNumber)
                    } else {
                        winston.debug({message: name + `: EVANS(D3): Event Variable ${cbusMsg.eventVariableIndex} Value has not Changed `});
                    }
                } else {
                    winston.debug({message: name + `: EVANS(D3): Event Variable ${cbusMsg.variable} Does not exist on config - adding`});
                    this.nodeConfig.nodes[nodeNumber].storedEvents[tableIndex].variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue
                    this.saveNode(nodeNumber)
                }
              } else {
                  winston.debug({message: name + `: EVANS(D3): Event Identifier ${eventIdentifier} Does not exist on config - skipping`});
              }
            },
            'D8': async (cbusMsg) => {//Accessory On Short Event 2
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
            },
            'D9': async (cbusMsg) => {//Accessory Off Short Event 2
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
            },
            'E1': async (cbusMsg) => { // PLOC
                let session = cbusMsg.session
                if (!(session in this.dccSessions)) {
                    this.dccSessions[session] = {}
                    this.dccSessions[session].count = 0
                }
                this.dccSessions[session].id = session
                this.dccSessions[session].loco = cbusMsg.address
                this.dccSessions[session].direction = cbusMsg.direction
                this.dccSessions[session].speed = cbusMsg.speed
                this.dccSessions[session].status = 'Active'
                this.dccSessions[session].F1 = cbusMsg.Fn1
                this.dccSessions[session].F2 = cbusMsg.Fn2
                this.dccSessions[session].F3 = cbusMsg.Fn3
                this.emit('dccSessions', this.dccSessions)
                winston.debug({message: `mergAdminNode: PLOC (E1) ` + JSON.stringify(this.dccSessions[session])})
            },
            'E7': async (cbusMsg) => {// ESD - Extended Service Discovery
                // mode
                winston.debug({message: name + `: Extended Service Discovery ${JSON.stringify(cbusMsg)}`})
                utils.addESDvalue(this.nodeConfig, cbusMsg.nodeNumber, cbusMsg.ServiceIndex, 1, cbusMsg.Data1)
                utils.addESDvalue(this.nodeConfig, cbusMsg.nodeNumber, cbusMsg.ServiceIndex, 2, cbusMsg.Data2)
                utils.addESDvalue(this.nodeConfig, cbusMsg.nodeNumber, cbusMsg.ServiceIndex, 3, cbusMsg.Data3)
                /*
                this.nodeConfig.nodes[cbusMsg.nodeNumber]["services"][cbusMsg.ServiceIndex].ESD[1].value = cbusMsg.Data1
                this.nodeConfig.nodes[cbusMsg.nodeNumber]["services"][cbusMsg.ServiceIndex].ESD[2].value = cbusMsg.Data2
                this.nodeConfig.nodes[cbusMsg.nodeNumber]["services"][cbusMsg.ServiceIndex].ESD[3].value = cbusMsg.Data3
                */
                this.saveNode(cbusMsg.nodeNumber)
              },
            'EF': async (cbusMsg) => {//Request Node Parameter in setup
                // mode
                //winston.debug({message: `mergAdminNode: PARAMS (EF) Received`});
            },
            'F0': async (cbusMsg) => {//Accessory On Long Event 3
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'on', 'long')
            },
            'F1': async (cbusMsg) => {//Accessory Off Long Event 3
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.eventNumber, 'off', 'long')
            },
            'F2': async (cbusMsg) => {//ENSRP Response to NERD/NENRD
              // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
              this.updateEventInNodeConfig(cbusMsg.nodeNumber, cbusMsg.eventIdentifier, cbusMsg.eventIndex)
            },
            'F8': async (cbusMsg) => {//Accessory On Short Event 3
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'on', 'short')
            },
            'F9': async (cbusMsg) => {//Accessory Off Short Event 3
                this.eventSend(cbusMsg.nodeNumber, cbusMsg.deviceNumber, 'off', 'short')
            },
            'DEFAULT': async (cbusMsg) => {
                winston.debug({message: "mergAdminNode: Opcode " + cbusMsg.opCode + ' is not supported by the Admin module'});
                let ref = cbusMsg.opCode

                if (ref in this.cbusNoSupport) {
                    this.cbusNoSupport[ref].cbusMsg = cbusMsg
                    this.cbusNoSupport[ref].count += 1
                } else {
                    let output = {}
                    output['opCode'] = cbusMsg.opCode
                    output['msg'] = {"message": cbusMsg.encoded}
                    output['count'] = 1
                    this.cbusNoSupport[ref] = output
                }
                this.emit('cbusNoSupport', this.cbusNoSupport)
            }
        }
    }

    //
    // Function to read all events from nodes one at a time
    // node numbers are pushed onto a queue
    // node number taken from queue and NERD sent to get all events for that node
    // Function called on a frequent basis
    // wait for elapsed time after last message received
    //
    sendNERDIntervalFunc(){
      if ( Date.now() > this.lastReceiveTime + 100){
        if (this.NERD_Queue.length > 0){
          var nodeNumber = this.NERD_Queue[0]
          // if first time for this node, then send it...
          if (this.NERD_Queue_Count == 0) {
            winston.info({message: name + `: scanNodesIntervalFunc: node ` + nodeNumber})
            // clear events before we re-read them (but don't send to client yet)
//            this.nodeConfig.nodes[nodeNumber].storedEventsNI = {}
            this.cbusSend(this.NERD(nodeNumber))
          }
          // count passes for this node
          this.NERD_Queue_Count++
          var loops = (this.nodeConfig.nodes[nodeNumber].eventCount) ? this.nodeConfig.nodes[nodeNumber].eventCount / 5 : 1
          if (this.NERD_Queue_Count > loops){
            // reset for next node
            var nodeNumber = this.NERD_Queue.shift()
            this.NERD_Queue_Count = 0
          }
        }
      }
    }
      

    //
    // Function to read number of events from nodes one at a time
    // node numbers are pushed onto a queue
    // node number taken from queue and RQEVN sent to get number for that node
    // Function called on a frequent basis
    // If QNN has been sent recently, then wait until a time has elapsed to allow the nodes
    // to send their PNN responses
    //
    sendRQEVNIntervalFunc(){
      // allow larger gap if we've just sent QNN
      var timeGap = this.lastMessageWasQNN ? 500 : 100
      timeGap = this.inUnitTest ? 1 : timeGap
      if ( Date.now() > this.lastReceiveTime + timeGap){
        this.lastMessageWasQNN = false
        if (this.RQEVN_Queue.length > 0){
          // get first out of queue
          var nodeNumber = this.RQEVN_Queue[0]
          this.cbusSend(this.RQEVN(nodeNumber))
          // remove the one we've used from queue
          this.RQEVN_Queue.shift()
        }
      }
    }
      
    //
    // Function to send CBUS messages one at a time, ensuring a gap between them
    //
    sendCBUSIntervalFunc(){
      var timeGap = this.inUnitTest ? 1 : 100
      if ( Date.now() > this.lastReceiveTime + timeGap){
        if (this.CBUS_Queue.length > 0){
          // get first out of queue
          var msg = this.CBUS_Queue[0]
          this.cbusSend(msg)
          // remove the one we've used from queue
          this.CBUS_Queue.shift()
        }
      }
    }
      

    async connect(host, port){
      winston.info({message: `mergAdminNode: connect - ${host} on port ${port}`});
      this.client.connect(port, host, function () {
        winston.info({message: `mergAdminNode: Connected - ${host} on port ${port}`});
      })
      await utils.sleep(100)
      this.query_all_nodes()
    }

    getModuleName(moduleIdentifier){
      var moduleName = 'Unknown'
      if (this.merg['modules'][moduleIdentifier]) {
        if (this.merg['modules'][moduleIdentifier]['name']) {
          moduleName = this.merg['modules'][moduleIdentifier]['name']
          return moduleName
        }
      }
      var list = this.config.getModuleDescriptorFileList(moduleIdentifier)
      winston.info({message: name + `: Descriptor File List: ` + JSON.stringify(list)});
      if (list[0]){
        var index = list[0].toString().search(moduleIdentifier)
        winston.info({message: name + `: moduleIdentifier position: ` + index});
        if (index > 1) {
          moduleName =list[0].substr(0,index-1)
        }
      }
      return moduleName
    }

    process_WRACK(cbusMsg) {
      winston.info({message: name + `: wrack : node ` + cbusMsg.nodeNumber});
      this.nodeConfig.nodes[cbusMsg.nodeNumber].CANID = utils.getMGCCANID(cbusMsg.encoded)
      this.saveNode(cbusMsg.nodeNumber)
    }

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


    async action_message(cbusMsg) {
      if (cbusMsg.ID_TYPE == "S"){
        winston.info({message: "mergAdminNode: Standard message " + cbusMsg.mnemonic + " Opcode " + cbusMsg.opCode});
        if (this.actions[cbusMsg.opCode]) {
            await this.actions[cbusMsg.opCode](cbusMsg);
        } else {
            await this.actions['DEFAULT'](cbusMsg);
        }
      }
      else if (cbusMsg.ID_TYPE = "X"){
        // currently ignoring extended messages - programNode class uses them instead
      }
      else {
        winston.warn({message: name + ": unexpected cbus message " + JSON.stringify(cbusMsg)});
      }
    }

    isMessageValid(cbusMsg){
      var result = false
      if ((cbusMsg.encoded[0] == ':') && (cbusMsg.encoded[cbusMsg.encoded.length-1] == ';')){
        if (cbusMsg.ID_TYPE == 'S'){
          // example encoding :S1234NFF12345678; - 8 data hex chars, 4 data bytes
          //                  123456789--------0 - non-data bytes = 10
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
      } else {
        winston.error({message: name + `: isMessageValid: wrongly formed ` + cbusMsg.encoded });
      }
      return result
    }


    createNodeConfig(nodeNumber){
        // doesn't exist in config file, so create an entry for it
        let output = {
          "CANID": "",
          "nodeNumber": nodeNumber,
          "manufacturerId": "",
          "moduleId": "",
          "moduleIdentifier": "",
          "moduleVersion": "",
          "parameters": [],
          "nodeVariables": [],
          "storedEvents": {},
          "storedEventsNI": {},
          "status": true,
          "eventCount": 0,
          "services": {},
          "moduleName": 'Unknown',
          "eventReadBusy":false,
          "eventVariableReadBusy":false
      }
      this.nodeConfig.nodes[nodeNumber] = output
      winston.debug({message: name + `: createNodeConfig: node ` + nodeNumber})
    }

    updateEventInNodeConfig(nodeNumber, eventIdentifier, eventIndex){
      if (this.nodeConfig.nodes[nodeNumber] == undefined) {
        this.createNodeConfig(nodeNumber)
      }
      if (!(eventIndex in this.nodeConfig.nodes[nodeNumber].storedEvents)) {
        this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex] = {
            "eventIndex": eventIndex,
            "variables": {}
        }
      }
      this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex].eventIdentifier = eventIdentifier
      this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex].nodeNumber = nodeNumber
      //
      if (!(eventIdentifier in this.nodeConfig.nodes[nodeNumber].storedEventsNI)) {
        this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier] = {
            "eventIdentifier": eventIdentifier,
            "variables": {}
        }
      }
      this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].eventIndex = eventIndex
      this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].nodeNumber = nodeNumber
      //
      this.saveConfig()      
    }

    storeEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue){
      winston.debug({message: name + `: storeEventVariable: ${nodeNumber} ${eventIdentifier} ${eventVariableIndex} ${eventVariableValue}`});
      try {
        var node = this.nodeConfig.nodes[nodeNumber]
        // might be new event, so check it exists, and create if it doesn't
        if (node.storedEventsNI[eventIdentifier] == undefined){
          node.storedEventsNI[eventIdentifier] = {
            "eventIdentifier": eventIdentifier,
            "variables": {}
          }
        }
        node.storedEventsNI[eventIdentifier].variables[eventVariableIndex] = eventVariableValue
//        winston.debug({message: name + `: storeEventVariableByIdentifier: ` + JSON.stringify(node.storedEventsNI)});
      } catch (err) {
        winston.debug({message: name + `: storeEventVariableByIdentifier: error ${err}`});
      }
    }

    //
    // Function used when NEVAL is returned, to store variable by eventIdentifier
    // but NEVAL uses eventIndex, not eventIdentifier,
    // so need to find which eventIdentifier has that eventIndex
    // eventIdentifier must already exist in storedEventsNI, with the right eventIndex
    //
    storeEventVariableByIndex(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue){
      winston.debug({message: name + `: storeEventVariable: ${nodeNumber} ${eventIndex} ${eventVariableIndex} ${eventVariableValue}`});
      try {
        var match = false
        var node = this.nodeConfig.nodes[nodeNumber]
        for (let eventIdentifier in node.storedEventsNI){
          if (node.storedEventsNI[eventIdentifier].eventIndex == eventIndex){
            // ok, we've found the matching eventIdentifier
            match = true
            winston.debug({message: name + ': storeEventVariableByIndex: eventIdentifier ' + JSON.stringify(node.storedEventsNI[eventIdentifier])})
            if(node.storedEventsNI[eventIdentifier].variables == undefined) {
              node.storedEventsNI[eventIdentifier].variables = {}
            }
            if (node.storedEventsNI[eventIdentifier].variables[eventVariableIndex] != eventVariableValue){
              node.storedEventsNI[eventIdentifier].variables[eventVariableIndex] = eventVariableValue
              this.saveNode(nodeNumber)
            } else {
              // stored event variable is the same value, so do nothing
            }
          }
        }
        if (match == false){
          winston.info({message: name + `: storeEventVariableByIndex: eventIdentifier not found with eventIndex ${eventIndex}`});
        }
      } catch (err) {
        winston.info({message: name + `: storeEventVariableByIndex: error ${err}`});
      }
    }

    removeNodeEvents(nodeNumber) {
      if(this.nodeConfig.nodes[nodeNumber]){
        this.nodeConfig.nodes[nodeNumber].storedEvents = {}
        this.nodeConfig.nodes[nodeNumber].storedEventsNI = {}
        this.saveConfig()
      }
    }

    removeNodeEvent(nodeNumber, eventIdentifier) {
      winston.info({message: name + `: removeNodeEvent ${nodeNumber} ${eventIdentifier}`})
      if(this.nodeConfig.nodes[nodeNumber]){
        // delete this.nodeConfig.nodes[nodeNumber].storedEvents[]
        delete this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier]
        this.saveConfig()
      }
    }


    clearCbusErrors() {
        this.cbusErrors = {}
        this.emit('cbusError', this.cbusErrors)
    }

    async cbusSend(msg) {
      if (typeof msg !== 'undefined') {
        let output = JSON.stringify(msg)
        this.client.write(output);
        winston.debug({message: `mergAdminNode: CBUS Transmit >>>  ${output}`})
        let tmp = cbusLib.decode(cbusLib.encode(msg).encoded) //do double trip to get text
        this.emit('cbusTraffic', {direction: 'Out', json: tmp});
      }
    }

    refreshEvents() {
        this.emit('events', this.nodeConfig.events)
    }

    clearEvents() {
        winston.info({message: `mergAdminNode: clearEvents() `});
        this.nodeConfig.events = {}
        this.saveConfig()
        this.emit('events', this.nodeConfig.events)
    }

    eventSend(nodeNumber, eventNumber, status, type) {
      let busIdentifier = utils.decToHex(nodeNumber, 4) + utils.decToHex(eventNumber, 4)
        let eventIdentifier = busIdentifier
        winston.info({message: 'mergAdminNode: eventIdentifier : ' + eventIdentifier});
        //need to remove node number from event identifier if short event
        if (type == 'short') {
          eventIdentifier = "0000" + eventIdentifier.slice(4)
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
        //this.saveConfig()
        this.emit('events', this.nodeConfig.events);
    }


    saveConfig() {
        winston.info({message: 'mergAdminNode: Save Config : '});
        this.config.writeNodeConfig(this.nodeConfig)
        this.emit('nodes', this.nodeConfig.nodes);
    }

    saveNode(nodeNumber) {
      winston.info({message: 'mergAdminNode: Save Node : ' + nodeNumber});
      winston.debug({message: 'mergAdminNode: Save Node : ' + JSON.stringify(this.nodeConfig.nodes[nodeNumber])});
      if (this.nodeConfig.nodes[nodeNumber] == undefined){
        this.nodeConfig.nodes[nodeNumber] = {
          "nodeNumber": nodeNumber,
          "eventVariableReadBusy": false
        } 
      }
      this.checkNodeDescriptor(nodeNumber); // do before emit node
      this.config.writeNodeConfig(this.nodeConfig)
      this.emit('node', this.nodeConfig.nodes[nodeNumber])
    }

    refreshNodeDescriptors(){
      Object.keys(this.nodeDescriptors).forEach(nodeNumber => {
        this.checkNodeDescriptor(nodeNumber, true)
      })
    }

    checkNodeDescriptor(nodeNumber, force){
      if ((this.nodeDescriptors[nodeNumber] == undefined) || (force == true)) {
        // only proceed if nodeDescriptor doesn't exist, if it does exist, then just return, nothing to see here...
        try {
          if (this.nodeConfig.nodes[nodeNumber]){
            var moduleName = this.nodeConfig.nodes[nodeNumber].moduleName;                  // should be populated by PNN
            var moduleIdentifier = this.nodeConfig.nodes[nodeNumber].moduleIdentifier;      // should be populated by PNN
            if ((moduleName == "Unknown") || (moduleName == undefined)) {
              // we can't handle a module we don't know about, so just warn & skip rest
              winston.info({message: 'mergAdminNode: checkNodeDescriptor : module unknown'});
            } else {
              // build filename
              var filename = moduleName + "-" + moduleIdentifier               
              // need major & minor version numbers, and cpu type
              // to complete building of filename
              if ((this.nodeConfig.nodes[nodeNumber].parameters[7] != undefined) && (this.nodeConfig.nodes[nodeNumber].parameters[2] != undefined) && (this.nodeConfig.nodes[nodeNumber].parameters[9] != undefined))
              {
                // get & store the version
                this.nodeConfig.nodes[nodeNumber].moduleVersion = this.nodeConfig.nodes[nodeNumber].parameters[7] + String.fromCharCode(this.nodeConfig.nodes[nodeNumber].parameters[2])
                filename += "-" + this.nodeConfig.nodes[nodeNumber].moduleVersion
                filename += "--P" + this.nodeConfig.nodes[nodeNumber].parameters[9]  // cpu type
                filename += ".json"
                // but don't store the filename in nodeConfig until we're tried to read the file
                try {
                  const moduleDescriptor = this.config.readModuleDescriptor(filename)
                  this.nodeDescriptors[nodeNumber] = moduleDescriptor
                  // ok, we've tried to read the file, and sent it if it succeeded, so set the filename in nodeConfig
                  // and the client can check for filename, and if no data, then fileload failed
                  if (moduleDescriptor){
                    this.nodeConfig.nodes[nodeNumber]['moduleDescriptorFilename'] = moduleDescriptor.moduleDescriptorFilename
                  }
                  this.config.writeNodeDescriptors(this.nodeDescriptors)
                  winston.info({message: 'mergAdminNode: checkNodeDescriptor: loaded file ' + filename});
                  var payload = {[nodeNumber]:moduleDescriptor}
                  this.emit('nodeDescriptor', payload);
                }catch(err) {
                  winston.error({message: 'mergAdminNode: checkNodeDescriptor: error loading file ' + filename + ' ' + err});
                }
              }
            }
          }
        } catch (err){
          winston.error({message: name + ': checkNodeDescriptor: ' + err});        
        }
      }
    }


    async holdIfBusy(busyFlag){
      var count = 0;
      while(busyFlag){
        await sleep(10);
        count++
        // check to ensure it doesn't lock up in this routine
        if (count > 1000){
          winston.info({message: 'mergAdminNode: busy hold break...... '});
          break
        }
      }
//      winston.info({message: 'mergAdminNode: busy hold released at count ' + count});
    }


//************************************************************************ */
//
// functions called by the socket service
// in alphabetical order
//
//************************************************************************ */

  async query_all_nodes(){
    winston.info({message: name + ': query_all_nodes'});
    for (let node in this.nodeConfig.nodes) {
      this.nodeConfig.nodes[node].status = false
    }
    this.nodeDescriptors = {}   // force re-reading of module descriptors...
    this.saveConfig()
    this.QNN_sent_time = Date.now()   // gets milliseconds now
    await this.cbusSend(this.QNN())
    this.lastMessageWasQNN = true
  }

  async event_unlearn(nodeNumber, eventName) {
    this.CBUS_Queue.push(this.NNLRN(nodeNumber))
    this.CBUS_Queue.push(this.EVULN(eventName))
    await sleep(300); // allow a bit more time after NNCLR
    this.CBUS_Queue.push(this.NNULN(nodeNumber))
    await sleep(100); // allow a bit more time after NNCLR
    await this.request_all_node_events(nodeNumber)
  }

  
  remove_node(nodeNumber) {
    winston.info({message: name + ': remove_node ' + nodeNumber});
    var nodes = Object.keys(this.nodeConfig.nodes)  // just get node numbers
    winston.info({message: name + ': nodes ' + nodes});
    delete this.nodeConfig.nodes[nodeNumber]
    nodes = Object.keys(this.nodeConfig.nodes)  // just get node numbers
    winston.info({message: name + ': nodes ' + nodes});
    this.saveConfig()
  }

  // need to use event index here, as used outside of learn mode
  async requestEventVariablesByIndex(nodeNumber, eventIndex, variableCount){
    // don't start if already being read
    this.holdIfBusy(this.nodeConfig.nodes[nodeNumber].eventReadBusy)
    if(this.nodeConfig.nodes[nodeNumber].eventReadBusy==false){
      // need to prevent all events being refreshed whilst we're doing this
      this.nodeConfig.nodes[nodeNumber].eventVariableReadBusy=true
      // check event still exists first, as some events are dynamic on the module
      if (this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex]){
        // let clear out existing event variables...
//        this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex].variables = {}
        // now try reading EV0 - should return number of event variables
        this.CBUS_Queue.push(this.REVAL(nodeNumber, eventIndex, 0))
        await sleep(300); // wait for a response before trying to use it
        // now assume number of variables from param 5, but use the value in EV0 if it exists
        var numberOfVariables = this.nodeConfig.nodes[nodeNumber].parameters[5]
        if (this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex].variables[0] > 0 ){
          numberOfVariables = this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex].variables[0]
        }
        // now read event variables
        for (let i = 1; i <= numberOfVariables; i++) {
//          await sleep(50); // allow time between requests
          this.CBUS_Queue.push(this.REVAL(nodeNumber, eventIndex, i))
        }
      }
      this.nodeConfig.nodes[nodeNumber].eventVariableReadBusy=false
    } else {
      winston.info({message: 'mergAdminNode: requestEventVariablesByIndex: blocked '});
    }
  }


  addNodeToConfig(nodeNumber){
    this.nodeConfig.nodes[nodeNumber] = {eventVariableReadBusy:false}
  }


  async delete_all_events(nodeNumber) {
    winston.debug({message: name + ': delete_all_events: node ' + nodeNumber});
    this.CBUS_Queue.push(this.NNLRN(nodeNumber))
    this.CBUS_Queue.push(this.NNCLR(nodeNumber))
    await sleep(500); // allow a bit more time after NNCLR
    this.CBUS_Queue.push(this.NNULN(nodeNumber))
  }

  //
  // Adds node number to scan queue so that multiple requests can be dealt with in order
  // so that it doesn't overload the CANBUS
  //
  async request_all_node_events(nodeNumber){
    winston.info({message: name +': request_all_node_events: node ' + nodeNumber});
    if (this.nodeConfig.nodes[nodeNumber] == undefined){this.addNodeToConfig(nodeNumber)}
    // clear event count to force clearing & reload of events
    // ensures any events deleted are removed
    // this will force a NERD to be sent
    // but as it's destructive, lets wait for a gap in the traffic
    while ( Date.now() < this.lastReceiveTime + 200){await sleep(10)}
    this.nodeConfig.nodes[nodeNumber].eventCount = undefined
    this.nodeConfig.nodes[nodeNumber].storedEventsNI = {}
    this.CBUS_Queue.push(this.RQEVN(nodeNumber)) // get number of events for each node
    // response to RQEVN will trigger a NERD command as well
    var timeOut = (this.inUnitTest) ? 1 : 100
    await sleep(timeOut); // allow a bit more time after EVLRN
  }


  async request_all_node_parameters(nodeNumber){
    this.CBUS_Queue.push(this.RQNPN(nodeNumber, 0))     // get number of node parameters
    await sleep(400); // wait for a response before trying to use it
    let nodeParameterCount = this.nodeConfig.nodes[nodeNumber].parameters[0]
    for (let i = 1; i <= nodeParameterCount; i++) {
      this.CBUS_Queue.push(this.RQNPN(nodeNumber, i))
    }
  }

  async request_all_node_variables(nodeNumber, start){
    // get number of node variables - but wait till it exists
    while (1){
      if (this.nodeConfig.nodes[nodeNumber].parameters[6] != undefined) {break}
      await sleep(50); // allow time between requests
    }
    let nodeVariableCount = this.nodeConfig.nodes[nodeNumber].parameters[6]
    for (let i = start; i <= nodeVariableCount; i++) {
      this.CBUS_Queue.push(this.NVRD(nodeNumber, i))
      await sleep(50); // allow time between requests
    }
  }


  async event_teach_by_identifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue) {
    winston.debug({message: name +': event_teach_by_identity: ' + nodeNumber + " " + eventIdentifier})
    var isNewEvent = false
    if (utils.getEventTableIndex(this.nodeConfig.nodes[nodeNumber], eventIdentifier) == null){
      isNewEvent = true
      winston.info({message: name + ': event_teach_by_identifier - New event'});
    } 
    // updated variable, so add to config
    this.storeEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue)
    this.CBUS_Queue.push(this.NNLRN(nodeNumber))
    this.CBUS_Queue.push(this.EVLRN(nodeNumber, eventIdentifier, eventVariableIndex, eventVariableValue))
    var timeOut = (this.inUnitTest) ? 1 : 250
    await sleep(timeOut); // allow a bit more time after EVLRN
    winston.debug({message: name +': event_teach_by_identity: timeOut ' + timeOut})
    this.CBUS_Queue.push(this.NNULN(nodeNumber))

    if (isNewEvent){
      // adding new event may change event indexes, so need to refresh
      this.CBUS_Queue.push(this.RQEVN(nodeNumber)) // get number of events for each node
      await sleep(500); // allow a bit more time after RQEVN as it'll trigger a NERD
    }
    this.requestEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex)
  }


  async requestEventVariableByIdentifier(nodeNumber, eventIdentifier, eventVariableIndex){
    winston.info({message: name + ': requestEventVariablesByIdentifier ' + nodeNumber + ' ' + eventIdentifier});

    // originally used eventIdentity with REQEV & EVANS - but CBUSLib sends wrong nodeNumber in EVANS
    // So now uses eventIndex with REVAL/NEVAL, by finding eventIndex stored against eventIdentity
    // should not need to refresh event Indexes, as just asking for one variable
    try{
      var eventIndex = this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].eventIndex
      if (eventIndex){
        this.CBUS_Queue.push(this.REVAL(nodeNumber, eventIndex, eventVariableIndex))
      } else {
        winston.info({message: name + ': requestEventVariableByIdentifier: no event index found for ' + eventIdentifier});
      }
    } catch (err){
      winston.error({message: name + ': requestEventVariableByIdentifier: failed to get eventIndex: ' + err});
    }
  }


  async requestEventVariablesByIdentifier(nodeNumber, eventIdentifier){
    winston.info({message: name + ': requestEventVariablesByIdentifier ' + nodeNumber + ' ' + eventIdentifier});

    // originally used eventIdentity with REQEV & EVANS - but CBUSLib sends wrong nodeNumber in EVANS
    // So now uses eventIndex with REVAL/NEVAL, by finding eventIndex stored against eventIdentity
    // but need to refresh all events to get updated event indexes
    this.CBUS_Queue.push(this.NERD(nodeNumber))
    var timeOut = (this.inUnitTest) ? 1 : 250
    await sleep(timeOut); // allow a bit more time after EVLRN
    try{
      var eventIndex = this.nodeConfig.nodes[nodeNumber].storedEventsNI[eventIdentifier].eventIndex
      if (eventIndex){
        this.requestEventVariablesByIndex(nodeNumber, eventIndex, 0)
      } else {
        winston.info({message: name + ': requestEventVariablesByIdentifier: no event index found for ' + eventIdentifier});
      }
    } catch (err){
      winston.error({message: name + ': requestEventVariablesByIdentifier: failed to get eventIndex: ' + err});
    }
  }


//************************************************************************ */
//
// Functions to create json VLCB messages
// in opcode order
//
//************************************************************************ */    
  
  // 0x0D QNN
  //
  QNN() {//Query Node Number
    let output = {}
    output['mnemonic'] = 'QNN'
    return output;
  }

  // 0x10 RQNP
  //
  RQNP() {//Request Node Parameters
      let output = {}
      output['mnemonic'] = 'RQNP'
      return output;
  }

  // 0x22 QLOC
  //
  QLOC(sessionId) {
      let output = {}
      output['mnemonic'] = 'QLOC'
      output['session'] = sessionId
      return output
  }

  // 0x42
  //
  SNN(nodeNumber) {
      if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
          let output = {}
          output['mnemonic'] = 'SNN'
          output['nodeNumber'] = nodeNumber
          return output
      }
  }

  // 0x4F NNCLR
  //
  NNCLR(nodeNumber) {
    if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
        let output = {}
        output['mnemonic'] = 'NNCLR'
        output['nodeNumber'] = nodeNumber
        return output
    }
}


  // 0x53 NNLRN
  //
  NNLRN(nodeNumber) {
      if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
          let output = {}
          output['mnemonic'] = 'NNLRN'
          output['nodeNumber'] = nodeNumber
          return output
      }
  }

  // 0x54 NNULN
  //
  NNULN(nodeNumber) {
      let output = {}
      output['mnemonic'] = 'NNULN'
      output['nodeNumber'] = nodeNumber
      return output
  }

  // 0x57 NERD
  //
  NERD(nodeNumber) {//Request All Events
      let output = {}
      output['mnemonic'] = 'NERD'
      output['nodeNumber'] = nodeNumber
      return output
  }

  // 0x58 RQEVN
  //
  RQEVN(nodeNumber) {// Read Node Variable
      let output = {}
      output['mnemonic'] = 'RQEVN'
      output['nodeNumber'] = nodeNumber
      return output;
  }

  // 0x5D ENUM
  //
  ENUM(nodeNumber) {
    let output = {}
    output['mnemonic'] = 'ENUM'
    output['nodeNumber'] = nodeNumber
    return output;
}

  // 0x5E NNRST
  //
  NNRST(nodeNumber) {
    let output = {}
    output['mnemonic'] = 'NNRST'
    output['nodeNumber'] = nodeNumber
    return output;
}

// 0x72 NENRD
  //
  NENRD(nodeNumber, eventNumber) { //Request specific event
      let output = {}
      output['mnemonic'] = 'NENRD'
      output['nodeNumber'] = nodeNumber
      output['eventIndex'] = eventNumber
      return output
  }

  // 0x73 RQNPN
  //
  RQNPN(nodeNumber, param) {//Read Node Parameter
      let output = {}
      output['mnemonic'] = 'RQNPN'
      output['nodeNumber'] = nodeNumber
      output['parameterIndex'] = param
      return output
  }

  // 0x73 RQNPN
  //
  CANID(nodeNumber, CAN_ID) {//Read Node Parameter
    let output = {}
    output['mnemonic'] = 'CANID'
    output['nodeNumber'] = nodeNumber
    output['CAN_ID'] = CAN_ID
    return output
}

// 0x78 RQSD
  //
  RQSD(nodeNumber, service) { //Request Service Delivery
      let output = {}
      output['mnemonic'] = 'RQSD'
      output['nodeNumber'] = nodeNumber
      output['ServiceIndex'] = service
      return output
      //return cbusLib.encodeRQSD(nodeNumber, ServiceNumber);
  }

  // 0x9C REVAL
  //
  REVAL(nodeNumber, eventNumber, valueId) {//Read an Events EV by index
      //winston.info({message: 'mergAdminNode: REVAL '})
      let output = {}
      output['mnemonic'] = 'REVAL'
      output['nodeNumber'] = nodeNumber
      output['eventIndex'] = eventNumber
      output['eventVariableIndex'] = valueId
      return output;
      //return cbusLib.encodeREVAL(nodeNumber, eventNumber, valueId);
  }

  RDGN(nodeNumber, service, diagCode) { //Request Diagnostics
      let output = {}
      output['mnemonic'] = 'RDGN'
      output['nodeNumber'] = nodeNumber
      output['ServiceIndex'] = service
      output['DiagnosticCode'] = diagCode
      winston.info({message: 'mergAdminNode: RDGN : ' + JSON.stringify(output)})
      return output
      //return cbusLib.encodeRDGN(nodeNumber ServiceNumber, DiagnosticCode);
  }

  update_event(nodeNumber, eventIdentifier, variableId, value){
//      this.nodeConfig.nodes[nodeNumber].storedEvents[eventIndex].variables[variableId] = value
      return this.EVLRN(nodeNumber, eventIdentifier, variableId, value)
  }


  // 0x9C REVAL
  //
  REQEV(eventIdentifier, variableIndex) {//Read an Events EV by identifier - must be in learn mode
    //winston.info({message: 'mergAdminNode: REQEV '})
    let output = {}
    output['mnemonic'] = 'REQEV'
    output['nodeNumber'] = parseInt(eventIdentifier.substr(0, 4), 16)
    output['eventNumber'] = parseInt(eventIdentifier.substr(4, 4), 16)
    output['eventVariableIndex'] = variableIndex
    return output;
    //return cbusLib.encodeREVAL(nodeNumber, eventNumber, valueId);
}

EVLRN(nodeNumber, eventIdentifier, variableId, value) {
    winston.debug({message: 'mergAdminNode: EVLRN: ' + nodeNumber + ' ' + eventIdentifier + ' ' + variableId + ' ' + value})
    this.saveNode(nodeNumber)
    let output = {}
    output['mnemonic'] = 'EVLRN'
    output['nodeNumber'] = parseInt(eventIdentifier.substr(0, 4), 16)
    output['eventNumber'] = parseInt(eventIdentifier.substr(4, 4), 16)
    output['eventVariableIndex'] = variableId
    output['eventVariableValue'] = value
    return output;
  }

  EVULN(event) {//Remove an Event in Learn mMode
      let output = {}
      output['mnemonic'] = 'EVULN'
      output['nodeNumber'] = parseInt(event.substr(0, 4), 16)
      output['eventNumber'] = parseInt(event.substr(4, 4), 16)
      return output
      //return cbusLib.encodeEVULN(parseInt(event.substr(0, 4), 16), parseInt(event.substr(4, 4), 16));

  }

  NVRD(nodeNumber, variableId) {// Read Node Variable
      let output = {}
      output['mnemonic'] = 'NVRD'
      output['nodeNumber'] = nodeNumber
      output['nodeVariableIndex'] = variableId
      winston.info({message: `mergAdminNode: NVRD : ${nodeNumber} :${JSON.stringify(output)}`})
      return output
      //return cbusLib.encodeNVRD(nodeNumber, variableId);
  }

  NVSET(nodeNumber, variableId, variableVal) {// Read Node Variable
      this.nodeConfig.nodes[nodeNumber].nodeVariables[variableId] = variableVal
      this.saveConfig()
      let output = {}
      output['mnemonic'] = 'NVSET'
      output['nodeNumber'] = nodeNumber
      output['nodeVariableIndex'] = variableId
      output['nodeVariableValue'] = variableVal
      return output

      //return cbusLib.encodeNVSET(nodeNumber, variableId, variableVal);

  }

  ACON(nodeNumber, eventNumber) {
    this.eventSend(nodeNumber, eventNumber, 'on' , 'long')
      let output = {}
      output['mnemonic'] = 'ACON'
      output['nodeNumber'] = nodeNumber
      output['eventNumber'] = eventNumber
      return output
  }

  ACOF(nodeNumber, eventNumber) {
    this.eventSend(nodeNumber, eventNumber, 'off' , 'long')
      let output = {}
      output['mnemonic'] = 'ACOF'
      output['nodeNumber'] = nodeNumber
      output['eventNumber'] = eventNumber
      return output
  }

  ASON(nodeNumber, deviceNumber) {
    this.eventSend(nodeNumber, deviceNumber, 'on' , 'short')
    let output = {}
    output['mnemonic'] = 'ASON'
    output['nodeNumber'] = nodeNumber
    output['deviceNumber'] = deviceNumber
    return output
  }

  ASOF(nodeNumber, deviceNumber) {
    this.eventSend(nodeNumber, deviceNumber, 'off' , 'short')
    let output = {}
    output['mnemonic'] = 'ASOF'
    output['nodeNumber'] = nodeNumber
    output['deviceNumber'] = deviceNumber
    return output
  }

};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = (config) => { return new cbusAdmin(config) }
