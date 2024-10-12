'use strict';

const winston = require('winston');

const name = "server.js"
winston.info({message: name + ': Loaded'});

const socketServer = require('./socketServer')
const utils = require('./utilities.js');


// look for the config folder based on the directory of this module
const config = require('../VLCB-server/configuration.js')(__dirname + '/config')

// set config items if they don't exist
if (!config.getRemoteAddress()){
  config.setRemoteAddress("127.0.0.1")
}
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

  // instantiate objects and pass to socketServer
  // this is so we can use mocks for unit testing
  //
  const cbusServer = require('./cbusServer')
  const jsonServer = require('./jsonServer')(config.getJsonServerPort(), config.eventBus)
  const mergAdminNode = require('./mergAdminNode.js')(config)
  const programNode = require('../VLCB-server/programNodeMMC.js')
  socketServer.socketServer(config, mergAdminNode, jsonServer, cbusServer, programNode, status)

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

