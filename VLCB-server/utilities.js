'use strict';
const winston = require('winston');		// use config from root instance
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

exports.getEventIdentifier = function getEventTableIndex(node, eventIndex){
  var result = undefined
  try{
//    winston.debug({message: name +': getEventTableIndex: data ' + JSON.stringify(node) + ' ' + eventIdentifier});
    for (let eventIdentifier in node.storedEventsNI){
//        winston.debug({message: name + ': getEventTableIndex: event ' + JSON.stringify(node.storedEvents[eventIndex])})
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

exports.getEventTableIndex = function getEventTableIndex(node, eventIdentifier){
  var tableIndex = undefined
  try{
//    winston.debug({message: name +': getEventTableIndex: data ' + JSON.stringify(node) + ' ' + eventIdentifier});
    for (let eventIndex in node.storedEvents){
//        winston.debug({message: name + ': getEventTableIndex: event ' + JSON.stringify(node.storedEvents[eventIndex])})
      if (node.storedEvents[eventIndex].eventIdentifier == eventIdentifier){
        tableIndex = eventIndex
      }
    }
  } catch (err) {}
  winston.debug({message: name + ': getEventTableIndex:  result ' + tableIndex})
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




