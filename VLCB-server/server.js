'use strict';
const winston = require('winston');
const name = "server.js"
winston.info({message: name + ': Loaded'});
const utils = require('./utilities.js');

// pass in the system directory based on the directory of this module
const config = require('../VLCB-server/configuration.js')(__dirname + '/config')

// set config items
config.setSocketServerPort(5552);

//run()

let status = {
  "busConnection":{
  "state":true
  },
  mode: 'STARTUP'
}

exports.run = async function run(){
// async function run(){

  // instantiate objects and pass to socketServer
  // this is so we can use mocks for unit testing
  // a technique sometimes called dependancy injection
  const socketServer = require('./socketServer')
  const cbusServer = require('./cbusServer')(config)
  const messageRouter = require('./messageRouter')(config)
  const mergAdminNode = require('./mergAdminNode.js')(config)
  const programNode = require('../VLCB-server/programNodeMMC.js')(config)
  socketServer.socketServer(config, mergAdminNode, messageRouter, cbusServer, programNode, status)

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

