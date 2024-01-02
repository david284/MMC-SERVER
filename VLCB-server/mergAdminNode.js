const winston = require('winston');		// use config from root instance
const net = require('net')
const jsonfile = require('jsonfile')
let cbusLib = require('cbuslibrary')
const EventEmitter = require('events').EventEmitter;


function pad(num, len) { //add zero's to ensure hex values have correct number of characters
    let padded = "00000000" + num;
    return padded.substr(-len);
}

function decToHex(num, len) {
    return parseInt(num).toString(16).toUpperCase().padStart(len, '0');
}

class cbusAdmin extends EventEmitter {
    constructor(LAYOUT_PATH, NET_ADDRESS, NET_PORT) {
        super();
        this.configFile = './VLCB-server/config/' + LAYOUT_PATH + '/nodeConfig.json'
        this.config = {}
        const merg = jsonfile.readFileSync('./VLCB-server/config/mergConfig.json')
        this.layoutDetailsFileName = './VLCB-server/config/' + LAYOUT_PATH + '/layoutDetails.json'
        this.layoutDetails = jsonfile.readFileSync(this.layoutDetailsFileName)
        this.merg = merg
        const Service_Definitions = jsonfile.readFileSync('./VLCB-server/config/Service_Definitions.json')
        this.ServiceDefs = Service_Definitions

        winston.info({message: `mergAdminNode: Config = ${this.configFile}`});
        winston.info({message: `mergAdminNode: Layout = ${JSON.stringify(this.layoutDetails)}`});
        this.pr1 = 2
        this.pr2 = 3
        this.canId = 60
        this.config.nodes = {}
        this.config.events = {}
        this.cbusErrors = {}
        this.cbusNoSupport = {}
        this.dccSessions = {}
        this.heartbeats = {}
        this.saveConfig()
        const outHeader = ((((this.pr1 * 4) + this.pr2) * 128) + this.canId) << 5
        this.header = ':S' + outHeader.toString(16).toUpperCase() + 'N'
        this.client = new net.Socket()
        this.client.connect(NET_PORT, NET_ADDRESS, function () {
            winston.info({message: `mergAdminNode: Connected - ${NET_ADDRESS} on ${NET_PORT}`});
        })
        this.client.on('data', function (data) { //Receives packets from network and process individual Messages
            //const outMsg = data.toString().split(";")
            let indata = data.toString().replace(/}{/g, "}|{")
            //winston.info({message: `mergAdminNode: CBUS Receive <<<  ${indata}`})
            const outMsg = indata.toString().split("|")
            //const outMsg = JSON.parse(data)
            //winston.info({message: `mergAdminNode: Split <<<  ${outMsg.length}`})
            for (let i = 0; i < outMsg.length; i++) {

                //let cbusMsg = cbusLib.decode(outMsg[i].concat(";"))     // replace terminator removed by 'split' method
                winston.debug({message: `mergAdminNode: CBUS Receive >>>  ${outMsg[i]}`})
                //this.emit('cbusTraffic', {direction: 'In', raw: cbusMsg.encoded, translated: cbusMsg.text});
                this.action_message(JSON.parse(outMsg[i]))

            }
            //this.action_message(outMsg)
        }.bind(this))
        this.client.on('error', (err) => {
            winston.debug({message: 'mergAdminNode: TCP ERROR ${err.code}'});
        })
        this.client.on('close', function () {
            winston.debug({message: 'mergAdminNode: Connection Closed'});
            setTimeout(() => {
                this.client.connect(NET_PORT, NET_ADDRESS, function () {
                    winston.debug({message: 'mergAdminNode: Client ReConnected'});
                })
            }, 1000)
        }.bind(this))
        this.actions = { //actions when Opcodes are received
            '00': (cbusMsg) => { // ACK
                winston.info({message: "mergAdminNode: ACK (00) : No Action"});
            },
            '21': (cbusMsg) => { // KLOC
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
                    this.cbusSend(this.QLOC(session))
                }
                this.emit('dccSessions', this.dccSessions)
            },
            '23': (cbusMsg) => { // DKEEP
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
                    this.cbusSend(this.QLOC(session))
                }
                this.emit('dccSessions', this.dccSessions)
            },

            '47': (cbusMsg) => { // DSPD
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
                //this.cbusSend(this.QLOC(session))
            },
            '50': (cbusMsg) => {// RQNN -  Node Number
                this.emit('requestNodeNumber')
            },
            '52': (cbusMsg) => {
                winston.debug({message: "mergAdminNode: NNACK (59) : " + cbusMsg.text});
            },
            '59': (cbusMsg) => {
                winston.debug({message: "mergAdminNode: WRACK (59) : " + cbusMsg.text});
            },
            '60': (cbusMsg) => {
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
                //this.cbusSend(this.QLOC(session))
            },
            '63': (cbusMsg) => {// ERR - dcc error
                //winston.debug({message: `mergAdminNode: DCC ERROR Node ${msg.nodeId()} Error ${msg.errorId()}`});
                let output = {}
                output['type'] = 'DCC'
                output['Error'] = cbusMsg.errorNumber
                output['Message'] = this.merg.dccErrors[cbusMsg.errorNumber]
                output['data'] = decToHex(cbusMsg.data1, 2) + decToHex(cbusMsg.data2, 2)
                this.emit('dccError', output)
            },
            '6F': (cbusMsg) => {// CMDERR - Cbus Error
                let ref = cbusMsg.nodeNumber.toString() + '-' + cbusMsg.errorNumber.toString()
                if (ref in this.cbusErrors) {
                    this.cbusErrors[ref].count += 1
                } else {
                    let output = {}
                    output['id'] = ref
                    output['type'] = 'CBUS'
                    output['Error'] = cbusMsg.errorNumber
                    output['Message'] = this.merg.cbusErrors[cbusMsg.errorNumber]
                    output['node'] = cbusMsg.nodeNumber
                    output['count'] = 1
                    this.cbusErrors[ref] = output
                }
                this.emit('cbusError', this.cbusErrors)
            },
            '74': (cbusMsg) => { // NUMEV
                //winston.info({message: 'mergAdminNode: 74: ' + JSON.stringify(this.config.nodes[cbusMsg.nodeNumber])})
                if (this.config.nodes[cbusMsg.nodeNumber].eventCount != null) {
                    if (this.config.nodes[cbusMsg.nodeNumber].eventCount != cbusMsg.eventCount) {
                        this.config.nodes[cbusMsg.nodeNumber].eventCount = cbusMsg.eventCount
                        this.saveNode(cbusMsg.nodeNumber)
                    } else {
                        winston.debug({message: `mergAdminNode:  NUMEV: EvCount value has not changed`});
                    }
                } else {
                    this.config.nodes[cbusMsg.nodeNumber].eventCount = cbusMsg.eventCount
                    this.saveNode(cbusMsg.nodeNumber)
                }
                //winston.info({message: 'mergAdminNode:  NUMEV: ' + JSON.stringify(this.config.nodes[cbusMsg.nodeNumber])});
            },
            '90': (cbusMsg) => {//Accessory On Long Event
                //winston.info({message: `mergAdminNode:  90 recieved`})
                this.eventSend(cbusMsg, 'on', 'long')
            },
            '91': (cbusMsg) => {//Accessory Off Long Event
                //winston.info({message: `mergAdminNode: 91 recieved`})
                this.eventSend(cbusMsg, 'off', 'long')
            },
            '97': (cbusMsg) => { // NVANS - Receive Node Variable Value
                if (this.config.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] != null) {
                    if (this.config.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] != cbusMsg.nodeVariableValue) {
                        //winston.info({message: `mergAdminNode: Variable ${cbusMsg.nodeVariableIndex} value has changed`});
                        this.config.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue
                        this.saveNode(cbusMsg.nodeNumber)
                    } else {
                        //winston.info({message: `mergAdminNode: Variable ${cbusMsg.nodeVariableIndex} value has not changed`});
                    }
                } else {
                    //winston.info({message: `mergAdminNode: Variable ${cbusMsg.nodeVariableIndex} value does not exist in config`});
                    this.config.nodes[cbusMsg.nodeNumber].nodeVariables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue
                    this.saveNode(cbusMsg.nodeNumber)
                }
            },
            '98': (cbusMsg) => {//Accessory On Short Event
                this.eventSend(cbusMsg, 'on', 'short')
            },
            '99': (cbusMsg) => {//Accessory Off Short Event
                this.eventSend(cbusMsg, 'off', 'short')
            },
            '9B': (cbusMsg) => {//PARAN Parameter readback by Index
                let saveConfigNeeded = false
                if (cbusMsg.parameterIndex == 1) {
                    if (this.config.nodes[cbusMsg.nodeNumber].moduleManufacturerName != merg.moduleManufacturerName[cbusMsg.parameterValue]) {
                        this.config.nodes[cbusMsg.nodeNumber].moduleManufacturerName = merg.moduleManufacturerName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (cbusMsg.parameterIndex == 9) {
                    if (this.config.nodes[cbusMsg.nodeNumber].cpuName != merg.cpuName[cbusMsg.parameterValue]) {
                        this.config.nodes[cbusMsg.nodeNumber].cpuName = merg.cpuName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (cbusMsg.parameterIndex == 10) {
                    if (this.config.nodes[cbusMsg.nodeNumber].interfaceName != merg.interfaceName[cbusMsg.parameterValue]) {
                        this.config.nodes[cbusMsg.nodeNumber].interfaceName = merg.interfaceName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (cbusMsg.parameterIndex == 19) {
                    if (this.config.nodes[cbusMsg.nodeNumber].cpuManufacturerName != merg.cpuManufacturerName[cbusMsg.parameterValue]) {
                        this.config.nodes[cbusMsg.nodeNumber].cpuManufacturerName = merg.cpuManufacturerName[cbusMsg.parameterValue]
                        saveConfigNeeded = true
                    }
                }
                if (this.config.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] !== null) {
                    if (this.config.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] != cbusMsg.parameterValue) {
                        winston.debug({message: `mergAdminNode: Parameter ${cbusMsg.parameterIndex} value has changed`});
                        this.config.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] = cbusMsg.parameterValue
                        saveConfigNeeded = true
                    } else {
                        winston.info({message: `mergAdminNode: Parameter ${cbusMsg.parameterIndex} value has not changed`});
                    }
                } else {
                    winston.info({message: `mergAdminNode: Parameter ${cbusMsg.parameterIndex} value does not exist in config`});
                    this.config.nodes[cbusMsg.nodeNumber].parameters[cbusMsg.parameterIndex] = cbusMsg.parameterValue
                    saveConfigNeeded = true
                }
                // ok, save the config if needed
                if (saveConfigNeeded == true) {
                    this.saveNode(cbusMsg.nodeNumber)
                }
            },
            'AB': (cbusMsg) => {//Heartbeat
                winston.debug({message: `mergAdminNode: Heartbeat ${cbusMsg.nodeNumber} ${Date.now()}`})
                this.heartbeats[cbusMsg.nodeNumber] = Date.now()
            },
            'AC': (cbusMsg) => {//Service Discovery
                winston.info({message: `mergAdminNode: SD ${cbusMsg.nodeNumber} ${cbusMsg.text}`})
                const ref = cbusMsg.nodeNumber
                if (cbusMsg.ServiceIndex > 0) {
                  // all valid service indexes start from 1 - service index 0 returns count of services
                  if (ref in this.config.nodes) {
                    if (this.config.nodes[ref]["services"]) {
                      let output = {
                          "ServiceIndex": cbusMsg.ServiceIndex,
                          "ServiceType": cbusMsg.ServiceType,
                          "ServiceVersion": cbusMsg.ServiceVersion,
                          "diagnostics": {}
                      }
                      if (this.ServiceDefs[cbusMsg.ServiceType]) {
                        output["ServiceName"] = this.ServiceDefs[cbusMsg.ServiceType]['name']
                      }
                      else {
                        output["ServiceName"] = "service type not found in ServiceDefs"
                      }
                      this.config.nodes[ref]["services"][cbusMsg.ServiceIndex] = output
                      this.saveNode(cbusMsg.nodeNumber)
                    }
                    else {
                          winston.warn({message: `mergAdminNode - SD: node config services does not exist for node ${cbusMsg.nodeNumber}`});
                    }
                  }
                  else {
                          winston.warn({message: `mergAdminNode - SD: node config does not exist for node ${cbusMsg.nodeNumber}`});
                  }
                }
            },
            'B0': (cbusMsg) => {//Accessory On Long Event 1
                this.eventSend(cbusMsg, 'on', 'long')
            },
            'B1': (cbusMsg) => {//Accessory Off Long Event 1
                this.eventSend(cbusMsg, 'off', 'long')
            },
            'B5': (cbusMsg) => {// NEVAL -Read of EV value Response REVAL
                if (this.config.nodes[cbusMsg.nodeNumber].storedEvents[cbusMsg.eventIndex] != null) {
                    if (this.config.nodes[cbusMsg.nodeNumber].storedEvents[cbusMsg.eventIndex].variables[cbusMsg.eventVariableIndex] != null) {
                        if (this.config.nodes[cbusMsg.nodeNumber].storedEvents[cbusMsg.eventIndex].variables[cbusMsg.eventVariableIndex] != cbusMsg.eventVariableValue) {
                            winston.debug({message: `mergAdminNode: Event Variable ${cbusMsg.variable} Value has Changed `});
                            this.config.nodes[cbusMsg.nodeNumber].storedEvents[cbusMsg.eventIndex].variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue
                            this.saveNode(cbusMsg.nodeNumber)
                        } else {
                            winston.debug({message: `mergAdminNode: NEVAL: Event Variable ${cbusMsg.eventVariableIndex} Value has not Changed `});
                        }
                    } else {
                        winston.debug({message: `mergAdminNode: NEVAL: Event Variable ${cbusMsg.variable} Does not exist on config - adding`});
                        this.config.nodes[cbusMsg.nodeNumber].storedEvents[cbusMsg.eventIndex].variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue
                        this.saveNode(cbusMsg.nodeNumber)
                    }
                } else {
                    winston.debug({message: `mergAdminNode: NEVAL: Event Index ${cbusMsg.eventIndex} Does not exist on config - skipping`});
                }
            },
            'B6': (cbusMsg) => { //PNN Recieved from Node
                const ref = cbusMsg.nodeNumber
                const moduleIdentifier = cbusMsg.encoded.toString().substr(13, 4).toUpperCase()
                
                if (ref in this.config.nodes) {
                  // already exists in config file...
                  winston.debug({message: `mergAdminNode: PNN (B6) Node found ` + JSON.stringify(this.config.nodes[ref])})
                } else {
                  // doesn't exist in config file, so create it (but note flag update/create done later)
                  let output = {
                      "nodeNumber": cbusMsg.nodeNumber,
                      "manufacturerId": cbusMsg.manufacturerId,
                      "moduleId": cbusMsg.moduleId,
                      "moduleIdentifier": moduleIdentifier,
                      "parameters": [],
                      "nodeVariables": [],
                      "storedEvents": {},
                      "status": true,
                      "eventCount": 0,
                      "services": {},
                      "component": 'mergDefault2',
                      "moduleName": 'Unknown'
                  }
                  this.config.nodes[ref] = output
                }
                // now update component & name if they exist in mergConfig
                if (this.merg['modules'][moduleIdentifier]) {
                  if (this.merg['modules'][moduleIdentifier]['name']) {
                    this.config.nodes[ref].moduleName = this.merg['modules'][moduleIdentifier]['name']
                  }
                  if (this.merg['modules'][moduleIdentifier]['component']) {
                    this.config.nodes[ref].component = this.merg['modules'][moduleIdentifier]['component']
                  }
                }
                // force variableConfig to be reloaded
                this.config.nodes[ref].variableConfig = undefined
                // always update/create the flags....
                this.config.nodes[ref].flags = cbusMsg.flags
                this.config.nodes[ref].flim = (cbusMsg.flags & 4) ? true : false
                this.config.nodes[ref].consumer = (cbusMsg.flags & 1) ? true : false
                this.config.nodes[ref].producer = (cbusMsg.flags & 2) ? true : false
                this.config.nodes[ref].bootloader = (cbusMsg.flags & 8) ? true : false
                this.config.nodes[ref].coe = (cbusMsg.flags & 16) ? true : false
                this.config.nodes[ref].learn = (cbusMsg.flags & 32) ? true : false
                this.config.nodes[ref].status = true
                this.cbusSend((this.RQEVN(cbusMsg.nodeNumber)))
                this.saveNode(cbusMsg.nodeNumber)
                // now update nodeName in layoutDetails
                this.update_nodeName(cbusMsg.nodeNumber)
            },
            'B8': (cbusMsg) => {//Accessory On Short Event 1
                this.eventSend(cbusMsg, 'on', 'short')
            },
            'B9': (cbusMsg) => {//Accessory Off Short Event 1
                this.eventSend(cbusMsg, 'off', 'short')
            },
            'C7': (cbusMsg) => {//Diagnostic
                winston.info({message: `DGN: ${cbusMsg.text}`})
                const ref = cbusMsg.nodeNumber
                if (cbusMsg.ServiceIndex > 0) {
                  // all valid service indexes start from 1 - service index 0 returns count of services
                  if (ref in this.config.nodes) {
                    if (this.config.nodes[ref]["services"][cbusMsg.ServiceIndex]) {
                      const ServiceType = this.config.nodes[ref]["services"][cbusMsg.ServiceIndex]['ServiceType']
                      const ServiceVersion = this.config.nodes[ref]["services"][cbusMsg.ServiceIndex]['ServiceVersion']
                      let output = {
                          "DiagnosticCode": cbusMsg.DiagnosticCode,
                          "DiagnosticValue": cbusMsg.DiagnosticValue
                      }
                      if (this.ServiceDefs[ServiceType]) {
                        if(this.ServiceDefs[ServiceType]['version'][ServiceVersion]){
                          if(this.ServiceDefs[ServiceType]['version'][ServiceVersion]['diagnostics'][cbusMsg.DiagnosticCode]){
                            output["DiagnosticName"] = this.ServiceDefs[ServiceType]['version'][ServiceVersion]['diagnostics'][cbusMsg.DiagnosticCode]['name']
                          }
                        }
                      }
                      this.config.nodes[ref]["services"][cbusMsg.ServiceIndex]['diagnostics'][cbusMsg.DiagnosticCode] = output
                      this.saveNode(cbusMsg.nodeNumber)
                    }
                    else {
                          winston.warn({message: `mergAdminNode - SD: node config services does not exist for node ${cbusMsg.nodeNumber}`});
                    }
                  }
                  else {
                          winston.warn({message: `mergAdminNode - SD: node config does not exist for node ${cbusMsg.nodeNumber}`});
                  }
                }
            },
            'D0': (cbusMsg) => {//Accessory On Long Event 2
                this.eventSend(cbusMsg, 'on', 'long')
            },
            'D1': (cbusMsg) => {//Accessory Off Long Event 2
                this.eventSend(cbusMsg, 'off', 'long')
            },
            'D8': (cbusMsg) => {//Accessory On Short Event 2
                this.eventSend(cbusMsg, 'on', 'short')
            },
            'D9': (cbusMsg) => {//Accessory Off Short Event 2
                this.eventSend(cbusMsg, 'off', 'short')
            },
            'E1': (cbusMsg) => { // PLOC
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
            'E7': (cbusMsg) => {//Service Discovery
                // mode
                winston.debug({message: `mergAdminNode: Service Delivery ${JSON.stringify(cbusMsg)}`})
                this.config.nodes[cbusMsg.nodeNumber]["services"][cbusMsg.ServiceNumber] = [cbusMsg.Data1, cbusMsg.Data2, cbusMsg.Data3, cbusMsg.Data4]
            },
            'EF': (cbusMsg) => {//Request Node Parameter in setup
                // mode
                //winston.debug({message: `mergAdminNode: PARAMS (EF) Received`});
            },
            'F0': (cbusMsg) => {//Accessory On Long Event 3
                this.eventSend(cbusMsg, 'on', 'long')
            },
            'F1': (cbusMsg) => {//Accessory Off Long Event 3
                this.eventSend(cbusMsg, 'off', 'long')
            },
            'F2': (cbusMsg) => {//ENSRP Response to NERD/NENRD
                // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
                //winston.debug({message: `mergAdminNode: ENSRP (F2) Response to NERD : Node : ${msg.nodeId()} Action : ${msg.actionId()} Action Number : ${msg.actionEventId()}`});
                const ref = cbusMsg.eventIndex
                if (!(ref in this.config.nodes[cbusMsg.nodeNumber].storedEvents)) {
                    this.config.nodes[cbusMsg.nodeNumber].storedEvents[cbusMsg.eventIndex] = {
                        "eventIdentifier": cbusMsg.eventIdentifier,
                        "eventIndex": cbusMsg.eventIndex,
                        "node": cbusMsg.nodeNumber,
                        "variables": []
                    }
                    if (this.config.nodes[cbusMsg.nodeNumber].module == "CANMIO") {
                        //winston.info({message:`mergAdminNode: ENSRP CANMIO: ${cbusMsg.nodeNumber} :: ${cbusMsg.eventIndex}`})
                        //if (["CANMIO","LIGHTS"].includes(this.config.nodes[cbusMsg.nodeNumber].module)){
                        /*setTimeout(() => {
                            this.cbusSend(this.REVAL(cbusMsg.nodeNumber, cbusMsg.eventIndex, 0))
                        }, 10 * ref)*/
                        setTimeout(() => {
                            this.cbusSend(this.REVAL(cbusMsg.nodeNumber, cbusMsg.eventIndex, 1))
                        }, 20 * ref)
                    }
                    if (this.config.nodes[cbusMsg.nodeNumber].module == "LIGHTS") {
                        setTimeout(() => {
                            this.cbusSend(this.REVAL(cbusMsg.nodeNumber, cbusMsg.eventIndex, 1))
                        }, 100 * ref)
                    }
                    this.saveConfig()
                }
                //this.saveConfig()
            },
            'F8': (cbusMsg) => {//Accessory On Short Event 3
                this.eventSend(cbusMsg, 'on', 'short')
            },
            'F9': (cbusMsg) => {//Accessory Off Short Event 3
                this.eventSend(cbusMsg, 'off', 'short')
            },
            'DEFAULT': (cbusMsg) => {
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
        this.cbusSend(this.QNN())
    }

    action_message(cbusMsg) {
        winston.info({message: "mergAdminNode: " + cbusMsg.mnemonic + " Opcode " + cbusMsg.opCode + ' processed'});
        if (this.actions[cbusMsg.opCode]) {
            this.actions[cbusMsg.opCode](cbusMsg);
        } else {
            this.actions['DEFAULT'](cbusMsg);
        }
    }

    removeNodeEvents(nodeId) {
        this.config.nodes[nodeId].storedEvents = {}
        this.saveConfig()
    }

    removeNode(nodeId) {
        delete this.config.nodes[nodeId]
        this.saveConfig()
    }

    removeEvent(eventId) {
        delete this.config.events[eventId]
        this.saveConfig()
    }

    clearCbusErrors() {
        this.cbusErrors = {}
        this.emit('cbusError', this.cbusErrors)
    }

    cbusSend(msg) {
        if (typeof msg !== 'undefined') {
            //winston.info({message: `mergAdminNode: cbusSend Base : ${JSON.stringify(msg)}`});
            let output = JSON.stringify(msg)
            this.client.write(output);


            //let outMsg = cbusLib.decode(msg);
            //this.emit('cbusTraffic', {direction: 'Out', raw: outMsg.encoded, translated: outMsg.text});
            //winston.info({message: `mergAdminNode: CBUS send >> ${output} `});
        }

    }

    refreshEvents() {
        this.emit('events', Object.values(this.config.events))
    }

    clearEvents() {
        winston.info({message: `mergAdminNode: clearEvents() `});
        this.config.events = {}
        this.saveConfig()
        this.emit('events', this.config.events)
    }

    eventSend(cbusMsg, status, type) {
        let eId = cbusMsg.encoded.substr(9, 8)
        //let eventId = ''
        if (type == 'short') {
            //cbusMsg.msgId = decToHex(cbusMsg.nodeNumber,4) + decToHex(cbusMsg.eventNumber,4)
            eId = "0000" + eId.slice(4)
        }
        if (eId in this.config.events) {
            this.config.events[eId]['status'] = status
            this.config.events[eId]['count'] += 1
            //this.config.events[cbusMsg.msgId]['data'] = cbusMsg.eventData.hex
        } else {
            let output = {}
            output['id'] = eId
            output['nodeNumber'] = cbusMsg.nodeNumber
            if (type == 'short') {
                output['eventNumber'] = cbusMsg.deviceNumber
            } else {
                output['eventNumber'] = cbusMsg.eventNumber
            }
            output['status'] = status
            output['type'] = type
            output['count'] = 1
            //output['data'] = cbusMsg.eventData.hex
            this.config.events[eId] = output
        }
        winston.info({message: 'mergAdminNode: EventSend : ' + JSON.stringify(this.config.events[eId])});
        //this.saveConfig()
        this.emit('events', this.config.events);
    }


    saveConfig() {
        //winston.debug({message: `mergAdminNode: Save Config `});
        //this.config.events = this.events
        //
        //
        //
        winston.info({message: 'mergAdminNode: Save Config : '});
        jsonfile.writeFileSync(this.configFile, this.config, {spaces: 2, EOL: '\r\n'})
        //let nodes = []
        /*for (let node in this.config.nodes){
            nodes.push(this.config.nodes[node])
        }*/
        this.emit('nodes', this.config.nodes);
        //this.emit('nodes', Object.values(this.config.nodes))
    }

    saveNode(nodeId) {
        winston.info({message: 'mergAdminNode: Save Node : '+nodeId});
        this.checkVariableConfig(nodeId);
        jsonfile.writeFileSync(this.configFile, this.config, {spaces: 2, EOL: '\r\n'})
        this.emit('node', this.config.nodes[nodeId]);
    }

    checkVariableConfig(nodeId){
      if (this.config.nodes[nodeId].variableConfig == undefined) {
        // only proceed if variableConfig doesn't exist, if it does exist, then just return, nothing to see here...
        var moduleName = this.config.nodes[nodeId].moduleName;                  // should be populated by PNN
        var moduleIdentifier = this.config.nodes[nodeId].moduleIdentifier;      // should be populated by PNN
        if (this.merg['modules'][moduleIdentifier]) {
          // if we get here then it's a module type we know about (present in mergConfig.json)
          if (moduleName == "Unknown") {
            // we can't handle a module we don't know about, so just warn & skip rest
            winston.warn({message: 'mergAdminNode: Variable Config : module unknown'});
          } else {
            // ok, so we recognise the module, but only get variable config if component is mergDefault2
            if (this.config.nodes[nodeId].component == 'mergDefault2') {
              // build filename
              var filename = moduleName + "-" + moduleIdentifier               
              // need major & minor version numbers to complete building of filename
              if ((this.config.nodes[nodeId].parameters[7] != undefined) && (this.config.nodes[nodeId].parameters[2] != undefined))
              {
                filename += "-" + this.config.nodes[nodeId].parameters[7]
                filename += String.fromCharCode(this.config.nodes[nodeId].parameters[2])
                filename += ".json"
                this.config.nodes[nodeId]['moduleDescriptorFilename'] = filename
                // ok - can get file now
                try {
                  const variableConfig = jsonfile.readFileSync('./VLCB-server/config/modules/' + filename)
                  this.config.nodes[nodeId].variableConfig = variableConfig
                  winston.info({message: 'mergAdminNode: Variable Config: loaded file ' + filename});
                }catch(err) {
                  winston.error({message: 'mergAdminNode: Variable Config: erro loading file ' + filename + ' ' + err});
                }
              }
            } else {
				winston.warn({message: 'mergAdminNode: Check Variable Config : module component not suitable ' + this.config.nodes[nodeId].component});
			}
          }
        } else {
            winston.warn({message: 'mergAdminNode: module not found in mergConfig ' + moduleIdentifier});
        }
      }
    }

    // layoutDetails functions
    //
    update_nodeName(nodeNumber){
      if (nodeNumber in this.layoutDetails.nodeDetails){
      } else {
        // need to create entry for node
        this.layoutDetails.nodeDetails[nodeNumber] = {}
        this.layoutDetails.nodeDetails[nodeNumber].colour = "black"
        this.layoutDetails.nodeDetails[nodeNumber].group = ""
      }
      if (this.layoutDetails.nodeDetails[nodeNumber].name) {
        // nodeName already exists, so do nothing
      } else {
        // check if module name exists
        if (this.config.nodes[nodeNumber].moduleName) {
          this.layoutDetails.nodeDetails[nodeNumber].name = this.config.nodes[nodeNumber].moduleName + ' (' + nodeNumber + ')'
        } else {
          this.layoutDetails.nodeDetails[nodeNumber].name = 'Unknown (' + nodeNumber + ')'
        }
        this.saveLayoutDetails()
      }
    }

    saveLayoutDetails(){
      jsonfile.writeFileSync(this.layoutDetailsFileName, this.layoutDetails, {spaces: 2, EOL: '\r\n'})
      this.emit('layoutDetails', this.layoutDetails)
    }

    
    QNN() {//Query Node Number
        winston.info({message: 'mergAdminNode: QNN '})
        for (let node in this.config.nodes) {
            this.config.nodes[node].status = false
        }
        this.saveConfig()
        let output = {}
        output['mnemonic'] = 'QNN'
        return output;
    }

    RQNP() {//Request Node Parameters
        return cbusLib.encodeRQNP();
    }

    RQNPN(nodeId, param) {//Read Node Parameter
        let output = {}
        output['mnemonic'] = 'RQNPN'
        output['nodeNumber'] = nodeId
        output['parameterIndex'] = param
        return output
        //return cbusLib.encodeRQNPN(nodeId, param);
    }

    NNLRN(nodeId) {

        if (nodeId >= 0 && nodeId <= 0xFFFF) {
            let output = {}
            output['mnemonic'] = 'NNLRN'
            output['nodeNumber'] = nodeId
            return output
            //return cbusLib.encodeNNLRN(nodeId);
        }

    }

    NNULN(nodeId) {
        let output = {}
        output['mnemonic'] = 'NNULN'
        output['nodeNumber'] = nodeId
        return output
        //return cbusLib.encodeNNULN(nodeId);
    }

    SNN(nodeId) {
        if (nodeId >= 0 && nodeId <= 0xFFFF) {
            let output = {}
            output['mnemonic'] = 'SNN'
            output['nodeNumber'] = nodeId
            return output
            //return cbusLib.encodeSNN(nodeId);
        }
    }

    NERD(nodeId) {//Request All Events
        let output = {}
        output['mnemonic'] = 'NERD'
        output['nodeNumber'] = nodeId
        return output
    }

    NENRD(nodeId, eventId) { //Request specific event
        return cbusLib.encodeNENRD(nodeId, eventId);
    }

    REVAL(nodeId, eventId, valueId) {//Read an Events EV by index
        //winston.info({message: 'mergAdminNode: REVAL '})
        let output = {}
        output['mnemonic'] = 'REVAL'
        output['nodeNumber'] = nodeId
        output['eventIndex'] = eventId
        output['eventVariableIndex'] = valueId
        return output;
        //return cbusLib.encodeREVAL(nodeId, eventId, valueId);
    }

    RQSD(nodeId, service) { //Request Service Delivery
        let output = {}
        output['mnemonic'] = 'RQSD'
        output['nodeNumber'] = nodeId
        output['ServiceIndex'] = service
        return output
        //return cbusLib.encodeRQSD(nodeNumber, ServiceNumber);
    }

    RDGN(nodeId, service, diagCode) { //Request Diagnostics
        let output = {}
        output['mnemonic'] = 'RDGN'
        output['nodeNumber'] = nodeId
        output['ServiceIndex'] = service
        output['DiagnosticCode'] = diagCode
        winston.info({message: 'mergAdminNode: RDGN : ' + JSON.stringify(output)})
        return output
        //return cbusLib.encodeRDGN(nodeNumber ServiceNumber, DiagnosticCode);
    }

    update_event(nodeId, event, eventIndex, variableId, value){
        this.config.nodes[nodeId].storedEvents[eventIndex].variables[variableId] = value
        return this.EVLRN(nodeId, event, variableId, value)
    }

    teach_event(nodeId, event, variableId, value) {
        if (this.config.nodes[nodeId].module == 'CANMIO') {
            return this.EVLRN(nodeId, event, 2, 2)
        } else {
            return this.EVLRN(nodeId, event, variableId, value)
        }
    }

    EVLRN(nodeId, event, variableId, value) {//Update Event Variable
        //let nodeNumber = parseInt(event.substr(0, 4), 16)
        //winston.info({message: `mergAdminNode: EVLRN ${event} ${eventIndex} ${variableId} ${value} ` })
        //winston.info({message: `mergAdminNode: Test ${JSON.stringify(this.config.nodes[nodeId])}` })
        //this.config.nodes[nodeId].storedEvents[eventIndex].variables[variableId] = value
        //this.config.nodes[parseInt(event.substr(0, 4), 16)].storedEvents[eventIndex].variables[variableId] = value
        this.saveNode(nodeId)
        let output = {}
        output['mnemonic'] = 'EVLRN'
        output['nodeNumber'] = parseInt(event.substr(0, 4), 16)
        output['eventNumber'] = parseInt(event.substr(4, 4), 16)
        output['eventVariableIndex'] = variableId
        output['eventVariableValue'] = value
        return output;
        //return cbusLib.encodeEVLRN(parseInt(event.substr(0, 4), 16), parseInt(event.substr(4, 4), 16), variableId, valueId);
    }

    EVULN(event) {//Remove an Event in Learn mMode
        let output = {}
        output['mnemonic'] = 'EVULN'
        output['nodeNumber'] = parseInt(event.substr(0, 4), 16)
        output['eventNumber'] = parseInt(event.substr(4, 4), 16)
        return output
        //return cbusLib.encodeEVULN(parseInt(event.substr(0, 4), 16), parseInt(event.substr(4, 4), 16));

    }

    NVRD(nodeId, variableId) {// Read Node Variable
        let output = {}
        output['mnemonic'] = 'NVRD'
        output['nodeNumber'] = nodeId
        output['nodeVariableIndex'] = variableId
        winston.info({message: `mergAdminNode: NVRD : ${nodeId} :${JSON.stringify(output)}`})
        return output
        //return cbusLib.encodeNVRD(nodeId, variableId);
    }

    RQEVN(nodeId) {// Read Node Variable

        let output = {}
        output['mnemonic'] = 'RQEVN'
        output['nodeNumber'] = nodeId
        //winston.info({message: `mergAdminNode: RQEVN : ${nodeId} :${JSON.stringify(output)}`})
        return output;
        //return cbusLib.encodeRQEVN(nodeId);
    }

    NVSET(nodeId, variableId, variableVal) {// Read Node Variable
        this.config.nodes[nodeId].nodeVariables[variableId] = variableVal
        this.saveConfig()
        let output = {}
        output['mnemonic'] = 'NVSET'
        output['nodeNumber'] = nodeId
        output['nodeVariableIndex'] = variableId
        output['nodeVariableValue'] = variableVal
        winston.info({message: `mergAdminNode: NVSET : ${nodeId} :${JSON.stringify(output)}`})
        return output

        //return cbusLib.encodeNVSET(nodeId, variableId, variableVal);

    }

    ACON(nodeId, eventId) {
        const eId = decToHex(nodeId, 4) + decToHex(eventId, 4)
        //winston.debug({message: `mergAdminNode: ACON admin ${eId}`});
        let output = {}
        if (eId in this.config.events) {
            this.config.events[eId]['status'] = 'on'
            this.config.events[eId]['count'] += 1
        } else {
            output['id'] = eId
            output['nodeId'] = nodeId
            output['eventId'] = eventId
            output['status'] = 'on'
            output['type'] = 'long'
            output['count'] = 1
            this.config.events[eId] = output
        }
        this.emit('events', Object.values(this.config.events))
        output = {}
        output['mnemonic'] = 'ACON'
        output['nodeNumber'] = nodeId
        output['eventNumber'] = eventId
        return output
        //return cbusLib.encodeACON(nodeId, eventId);
    }

    ACOF(nodeId, eventId) {
        const eId = decToHex(nodeId, 4) + decToHex(eventId, 4)
        //winston.debug({message: `mergAdminNode: ACOF admin ${eId}`});
        let output = {}
        if (eId in this.config.events) {
            this.config.events[eId]['status'] = 'off'
            this.config.events[eId]['count'] += 1
        } else {
            output['id'] = eId
            output['nodeId'] = nodeId
            output['eventId'] = eventId
            output['status'] = 'off'
            output['type'] = 'long'
            output['count'] = 1
            this.config.events[eId] = output
        }
        //this.config.events[eId]['status'] = 'off'
        //this.config.events[eId]['count'] += 1
        this.emit('events', Object.values(this.config.events))
        output = {}
        output['mnemonic'] = 'ACOF'
        output['nodeNumber'] = nodeId
        output['eventNumber'] = eventId
        return output
        //return cbusLib.encodeACOF(nodeId, eventId);
    }

    ASON(nodeId, deviceNumber) {
        const eId = decToHex(nodeId, 4) + decToHex(deviceNumber, 4)
        //winston.debug({message: `mergAdminNode: ASON admin ${eId}`});
        let output = {}
        if (eId in this.config.events) {
            this.config.events[eId]['status'] = 'on'
            this.config.events[eId]['count'] += 1
        } else {
            output['id'] = eId
            output['nodeId'] = nodeId
            output['eventId'] = deviceNumber
            output['status'] = 'on'
            output['type'] = 'short'
            output['count'] = 1
            this.config.events[eId] = output
        }
        this.emit('events', Object.values(this.config.events))
        output = {}
        output['mnemonic'] = 'ASON'
        output['nodeNumber'] = nodeId
        output['deviceNumber'] = deviceNumber
        return output

        //Format: [<MjPri><MinPri=3><CANID>]<98><NN hi><NN lo><DN hi><DN lo>
        //return cbusLib.encodeASON(nodeId, deviceNumber);

    }

    ASOF(nodeId, deviceNumber) {
        const eId = decToHex(nodeId, 4) + decToHex(deviceNumber, 4)
        //winston.debug({message: `mergAdminNode: ASOFadmin ${eId}`});
        let output = {}
        if (eId in this.config.events) {
            this.config.events[eId]['status'] = 'off'
            this.config.events[eId]['count'] += 1
        } else {
            output['id'] = eId
            output['nodeId'] = nodeId
            output['eventId'] = deviceNumber
            output['status'] = 'off'
            output['type'] = 'short'
            output['count'] = 1
            this.config.events[eId] = output
        }
        this.emit('events', Object.values(this.config.events))
        output = {}
        output['mnemonic'] = 'ASOF'
        output['nodeNumber'] = nodeId
        output['deviceNumber'] = deviceNumber
        return output
        //Format: [<MjPri><MinPri=3><CANID>]<99><NN hi><NN lo><DN hi><DN lo>
        //return cbusLib.encodeASOF(nodeId, deviceNumber);

    }

    QLOC(sessionId) {
        return cbusLib.encodeQLOC(sessionId);
    }

};


module.exports = {
    cbusAdmin: cbusAdmin
}


