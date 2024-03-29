#!/usr/bin/env node
let path = require('path')
const winston = require(path.join(process.cwd(), 'config/winston.js'));
const name = "www"
winston.info({message: name + ': Starting'});
winston.info({message: name + ': current working directory ' + process.cwd()});
winston.info({message: name + ': file location ' + __dirname});

try {
  var win = nw.Window.open('bin/index.html', {}, function(win) {});
  winston.info({message: name + ': nw window open'});
  win.setShowInTaskbar(false)
  win.hide()
  winston.info({message: name + ': nw window hidden'});

} catch (e){}




/**
 * Module dependencies.
 */

var app = require(path.join(process.cwd(), 'app'));
var debug = require('debug')('express:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
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
  debug('Listening on ' + bind);
}
