let path = require('path')
const logger = require('./config/winston.js');
const winston = logger.winston;
logger.initLogsPath();
const name = "main"
winston.info({message: name + ': Starting'});
winston.info({message: name + ': current working directory ' + process.cwd()});
winston.info({message: name + ': file location ' + __dirname});
const fork = require('child_process').fork;


/*
try {
  var win = nw.Window.open('bin/index.html', {}, function(win) {});
  winston.info({message: name + ': nw window open'});
  win.setShowInTaskbar(false)
  win.hide()
  winston.info({message: name + ': nw window hidden'});

} catch (e){}
*/

/*
const vlcbServer = fork('./VLCB-server/server.js')

vlcbServer.on('close', () => {
  console.log(`vlcbServer process exited`);
  console.log(`express process exited`);
  process.exit();
});
*/



const VLCB = require('./VLCB-server/server.js');
VLCB.run();



/**
 * Module dependencies.
 */

var app = require('./app.js');
var debug = require('debug')('express:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.MMC_SERVER_HTTP_PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  winston.info({message: `${name}: Listening on ${bind}`})
  debug('Listening on ' + bind);
}

try {
  // open a window with the port used by express
  var win = nw.Window.open("http://localhost:" + port, {}, function(win) {
    win.on('loaded', function() {
      win.maximize()
    });
  });
} catch (e){
  // if it fails, probably not using nw, so use openurl
  require("openurl").open("http://localhost:" + port, (e) => {
    if (e != undefined) {
      winston.error({message: `${name}: Error when using openurl: ${e}`})
    }
  });
}
