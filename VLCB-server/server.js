'use strict';
const path = require('path')
const winston = require(path.join(process.cwd(), '/VLCB-server/winston.js'));
const name = "server.js"
winston.info({message: name + ': Loaded'});

const {SerialPort} = require("serialport");
const canUSB = require('./canUSB')
const cbusServer = require('./cbusServer')
const socketServer = require('./socketServer')
const jsonServer = require('./jsonServer')
const utils = require('./utilities.js');

// look for the config folder based on the directory of this module
const config = require('../VLCB-server/configuration.js')(__dirname + '/config')

// set config items if they don't exist
if (!config.getServerAddress()){
  config.setServerAddress("localhost")
}
if (!config.getCbusServerPort()){
  config.setCbusServerPort(5550);
}
if (!config.getJsonServerPort()){
  config.setJsonServerPort(5551);
}
if (!config.getSocketServerPort()){
  config.setSocketServerPort(5552);
}

//run()

let status = {"busConnection":{
  "state":true
  }
}

exports.run = async function run(){
// async function run(){


  // use config to get target serial port if it exists
  // otherwise look for a CANUSBx
  // if all else fails try plain network connection
  var serialPorts = await getSerialPorts()
  status.busConnection["serialPortList"] = serialPorts
  var targetSerial = config.getSerialPort()
  if (targetSerial){
    winston.info({message: name + ': Using serial port ' + targetSerial});
    if (serialPorts.find(({ path }) => path === targetSerial) ){
      canUSB.canUSB(targetSerial, config.getCbusServerPort(), config.getServerAddress())
      cbusServer.cbusServer(config)
      status.busConnection.state = true
      winston.info({message: 'Starting cbusServer...\n'});
        } else {
      //await terminateApp('serial port ' +try targetSerial + ' not found \n');
      winston.info({message: name + ': serial port ' + targetSerial + ' not found \n'});
      winston.info({message: name + ': trying network connection'});
      status.busConnection.state = true // assume true until network fails
    }
  } else {
    winston.info({message: 'Finding CANUSBx...'});
    if ( await connectCANUSBx() ) {
      cbusServer.cbusServer(config)
      winston.info({message: name + ': Starting cbusServer...\n'});
      status.busConnection.state = true
    } else {
      winston.info({message: name + ': Failed to find CANUSBx...'});
      winston.info({message: name + ': trying network connection'});
      status.busConnection.state = true // assume true until network fails
    }
  }


  await utils.sleep(2000);   // allow time for connection to establish

  winston.info({message: name + ': status' + JSON.stringify(status)});
  

  jsonServer.jsonServer(config)
  socketServer.socketServer(config, status)


}

async function connectCANUSBx(){
	return new Promise(function (resolve, reject) {
    SerialPort.list().then(ports => {
      ports.forEach(function(port) {
        if (port.vendorId != undefined && port.vendorId.toString().toUpperCase() == '04D8' && port.productId.toString().toUpperCase() == 'F80C') {
          // CANUSB4
          winston.info({message: 'CANUSB4 : ' + port.path});
          canUSB.canUSB(port.path, config.getCbusServerPort(), config.getServerAddress())
          resolve(true);
        } else if (port.vendorId != undefined && port.vendorId.toString().toUpperCase() == '0403' && port.productId.toString().toUpperCase() == '6001') {
          // Old CANUSB
          winston.info({message: 'CANUSB : ' + port.path});
          canUSB.canUSB(port.path, config.getCbusServerPort(), config.getServerAddress())
          resolve(true);
        }
      })
      resolve(false);
    })
  })
}

async function getSerialPorts() {
	return new Promise(function (resolve, reject) {
    var serialports= [];
    var portIndex = 0;
    SerialPort.list().then(ports => {
      ports.forEach(function(port) {
        serialports[portIndex] = port
        winston.info({message: 'serial port ' + portIndex + ': ' + serialports[portIndex].path});
        winston.debug({message: 'serial port ' + portIndex + ': ' + JSON.stringify(serialports[portIndex])});
        portIndex++
      })
      if (portIndex == 0){
        winston.info({message: 'No active serial ports found...\n'});
      }
      resolve(serialports);
    })
  })
}


function CommandLineArgument(argument){
	// command line arguments will be 'node' <javascript file started> '--' <arguments starting at index 3>
	for (var item in process.argv){
//    winston.info({message: 'main: argv ' + item + ' ' + process.argv[item]});
    if (process.argv[item].toLowerCase().includes(argument)){
      return process.argv[item];
    }
	}
  return undefined;
}

async function terminateApp(message){
  winston.info({message: "App terminate : " + message});
  utils.sleep(500);   // allow time for logs to catch up
  winston.info({message: "Exiting.... "});
  process.exit()
}

