'use strict';
const winston = require('winston');		// use config from root instance
const fs = require('fs');
var path = require('path');
const AdmZip = require("adm-zip");
const name = 'utilities'


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), and can't be changed through reassigment or redeclared

/*

// add separate logger just for failures
const failLogger = winston.createLogger({
  format: winston.format.printf((info) => { return info.message;}),
  transports: [
    new winston.transports.File({ filename: './Test_Results/fails.txt', level: 'error', options: { flags: 'w' } }),
  ],
});

*/


exports.decToHex = function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

// get CAN ID from modified Grid Connect message
// CANID is bits 0 to 6 of the CAN Identifier
exports.getMGCCANID = function getMGCCANID(MGC_message){
	var CANID = 0;
	if (MGC_message.length > 6){
		if (MGC_message[1] == 'S'){
			// CANID is bits 0 to 6 of the 11 bit CAN Identifier
			var identifier = MGC_message.substring(2, 6);
			CANID = (parseInt(identifier, 16) >> 5) & 127
		}
	}
	return CANID
}

exports.sleep = function sleep(timeout) {
	return new Promise(function (resolve, reject) {
		//here our function should be implemented 
		setTimeout(()=>{
			resolve();
			;} , timeout
		);
	});
};
	
///////////////////////////////////////////////////////////////////////////////
//
// nodeConfig based functions
//

exports.getEventIdentifier = function getEventIdentifier(node, eventIndex){
  var result = undefined
  try{
    for (let eventIdentifier in node.storedEventsNI){
      if (node.storedEventsNI[eventIdentifier].eventIndex == eventIndex){
        result = eventIdentifier
      }
    }
  } catch (err) {
    winston.debug({message: name + `: getEventIdentifier: error ${err}`});
  }
  winston.debug({message: name + ': getEventIdentifier:  result ' + result})
  return result
}


exports.getEventTableIndexNI = function getEventTableIndexNI(node, eventIdentifier){
  var tableIndex = undefined
  try{
    tableIndex = node.storedEventsNI[eventIdentifier].eventIndex
  } catch (err) {}
  winston.debug({message: name + ': getEventTableIndexNI:  result ' + tableIndex})
  return tableIndex
}


exports.getMaxNumberOfEventVariables = function getMaxNumberOfEventVariables(nodeConfig, nodeNumber){
  winston.debug({message: name + ': getMaxNumberOfEventVariables: ' + nodeNumber + ' ' + JSON.stringify(nodeConfig)});
  var number = 0
  if (nodeConfig.nodes[nodeNumber]){
    if (nodeConfig.nodes[nodeNumber].parameters){
      number = nodeConfig.nodes[nodeNumber].parameters[5]
    }
  }
  winston.debug({message: name + ': getMaxNumberOfEventVariables: result ' + number});
  return number
}


exports.createServiceEntry = function createServiceEntry(nodeConfig, nodeNumber, ServiceIndex, ServiceType, ServiceVersion, ServiceDefs){

  // all valid service indexes start from 1 - service index 0 returns count of services
  if (nodeNumber in nodeConfig.nodes) {
    if (nodeConfig.nodes[nodeNumber]["services"]) {
      if (ServiceIndex > 0) {
        let output = {
          "ServiceIndex": ServiceIndex,
          "ServiceType": ServiceType,
          "ServiceVersion": ServiceVersion,
          "diagnostics": {},
          "ESD":{1:{}, 2:{}, 3:{}}
        }

        try {
          if (ServiceDefs[ServiceType]) {
            output["ServiceName"] = ServiceDefs[ServiceType]['name']
            if (ServiceDefs[ServiceType].version){
              winston.debug({message: name + `: createServiceEntry: version `});
              // there is an entry for this version
              if (ServiceDefs[ServiceType].version[ServiceVersion]){
                winston.debug({message: name + `: createServiceEntry: version ` + ServiceVersion});
                // there are ESD bytes defined
                for (let key of Object.keys(ServiceDefs[ServiceType].version[ServiceVersion].ESD)){
                  output.ESD[key] = {"name": ServiceDefs[ServiceType].version[ServiceVersion].ESD[key].name}
                }
              }
            }
          }
          else {
            output["ServiceName"] = "service type not found in ServiceDefs"
          }
        } catch (err) {
          winston.debug({message: name + `: createServiceEntry: ` + err});
        }
        nodeConfig.nodes[nodeNumber]["services"][ServiceIndex] = output
      }
      else {
        // service index is zero, so count returned
        nodeConfig.nodes[nodeNumber]['serviceCount'] = ServiceVersion
      }
    }
    else {
      winston.warn({message: `mergAdminNode - SD: node config services does not exist for node ${nodeNumber}`});
    }
  }
  else {
    winston.warn({message: `mergAdminNode - SD: node config does not exist for node ${nodeNumber}`});
  }
}

exports.addESDvalue = function addESDvalue(nodeConfig, nodeNumber, ServiceIndex, ESDIndex, value){
  if(nodeConfig.nodes[nodeNumber]["services"][ServiceIndex].ESD == undefined){
    nodeConfig.nodes[nodeNumber]["services"][ServiceIndex]["ESD"] = {}
  }
  if(nodeConfig.nodes[nodeNumber]["services"][ServiceIndex].ESD[ESDIndex] == undefined){
    nodeConfig.nodes[nodeNumber]["services"][ServiceIndex].ESD[ESDIndex] = {}
  }
  nodeConfig.nodes[nodeNumber]["services"][ServiceIndex].ESD[ESDIndex].value = value
}


exports.createTimestamp = function createTimestamp(){
  //create timestamp for filename
  var date = new Date()
  var timestamp = date.getFullYear()  + '-' +
    (date.getMonth() + 1).toString().padStart(2, '0') + '-' +       // getMonth starts at 0
    date.getDate().toString().padStart(2, '0')  + '_' +
    date.getHours().toString().padStart(2, '0')  + '-' +
    date.getMinutes().toString().padStart(2, '0')  + '-' +
    date.getSeconds().toString().padStart(2, '0') + '.' +
    date.getMilliseconds().toString().padStart(3, '0')
  return timestamp
}

exports.getTimestamp = function getTimestamp(){
  var time = new Date()
  var timeStamp = String(time.getSeconds()).padStart(2, '0') + '.' 
  + String(time.getMilliseconds()).padStart(3, '0')
  return timeStamp
}

exports.createLogsArchive = function createLogsArchive(){
  const zip = new AdmZip();

 	// now create timestamp
	const date = new Date()
	const timestamp = date.toISOString().substring(0, 10)
			+ '_' + date.getHours()
			+ '-' + date.getMinutes()
			+ '-' + date.getSeconds();

  // create filename
  const archiveFile = 'logs_' + timestamp + '.zip'

  let logsFolder = './logs'
  // get list of files in logs folder
  var list = fs.readdirSync(logsFolder).filter(function (file) {
    return fs.statSync(path.join(logsFolder, file)).isFile();
  },(this));

  // now add all files in list to zip
  try{
    list.forEach(logFile => {
      winston.info({message: name + `: archive: ` + path.join(logsFolder, logFile)});
      zip.addLocalFile(path.join(logsFolder, logFile))
    })
    // create archive folder if it doesn't exist
    const archiveFolderName = './archives'
    try {
      if (!fs.existsSync(archiveFolderName)) {
        fs.mkdirSync(archiveFolderName)
      }
    } catch (err) {
      winston.info({message: name + `: createLogsArchive: ${err}`});
    }
    // now write zip to disk
    zip.writeZip(path.join(archiveFolderName, archiveFile));
  } catch(err){
    winston.info({message: name + `: logsArchive: ${err}`});
  }


	winston.info({message: name + `: createLogsArchive: archive saved ${archiveFile}`});

}