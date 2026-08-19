'use strict';
const winston = require('winston');
const name = "server.js"
winston.info({message: name + ': Loaded'});
const path = require('path');

// pass in the system directory based on the directory of this module
// and the logs path, based on the root directory of the project
const config = require('../VLCB-server/configuration.js')(__dirname, path.join(process.cwd(), "logs"))

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
  const programNode = require('./programNodeMMC.js')(config)
  socketServer.socketServer(config, mergAdminNode, messageRouter, cbusServer, programNode, status)

}

