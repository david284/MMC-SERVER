'use strict';
const winston = require('./winston.js');
const {SerialPort} = require("serialport");
const canUSB = require('./canUSB')
const cbusServer = require('./cbusServer')
const jsonServer = require('./jsonServer')
const socketServer = require('./socketServer')
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

run()

async function run(){

    // use command line to suppress starting cbusServer, so network port can be used
  // command line arguments will be 'node' <javascript file started> '--' <arguments starting at index 3>
    var serialPorts = await getSerialPorts()
    var targetSerial = config.getSerialPort()
    if (targetSerial){
      winston.info({message: 'Using serial port ' + targetSerial});
      if (serialPorts.find(({ path }) => path === targetSerial) ){
        canUSB.canUSB(targetSerial, config.getCbusServerPort(), config.getServerAddress())
        cbusServer.cbusServer(config)
        winston.info({message: 'Starting cbusServer...\n'});
          } else {
        await terminateApp('serial port ' + targetSerial + ' not found \n');
      }
    } else {
      winston.info({message: 'Finding CANUSBx...'});
      if ( await connectCANUSBx() ) {
        cbusServer.cbusServer(config)
        winston.info({message: 'Starting cbusServer...\n'});
      } else {
        winston.info({message: 'Failed to find CANUSBx...'});
        winston.info({message: 'Assuming network connection'});
      }
    }


  await utils.sleep(2000);   // allow time for connection to establish

  jsonServer.jsonServer(config)
  socketServer.socketServer(config)


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

