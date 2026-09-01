/* global nw */
const fs = require('fs');
const path = require('path')
const logsPath = path.join(process.env.MMC_SERVER_APP_STORAGE_DIRECTORY || process.cwd(), 'logs');

// lets ensure the logs folder is empty
if (fs.existsSync(logsPath)) {
  fs.rmSync(logsPath, { recursive: true })
}
fs.mkdirSync(logsPath, { recursive: true })

const winston = require(path.join(process.cwd(), 'config/winston.js'));
const name = "main"
winston.info({message: name + ': Starting'});
winston.info({message: name + ': current working directory ' + process.cwd()});
winston.info({message: name + ': file location ' + __dirname});


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
const vlcbStartup = VLCB.run();
vlcbStartup.catch(handleVLCBStartupError)



/**
 * Module dependencies.
 */

var app = require(path.join(process.cwd(), 'app'));
var debug = require('debug')('express:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.MMC_SERVER_HTTP_PORT || '3000');
console.log (`using port ` + port)
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

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
// SIGTERM terminates a child process directly on Windows, so it cannot be used
// to exercise graceful shutdown there.  An IPC parent may request the same
// shutdown path without exposing a network-facing control mechanism.
process.on('message', (message) => {
  if (message && message.type === 'shutdown') {
    shutdown('IPC')
  }
})

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

let shuttingDown = false

async function shutdown(signal) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  winston.info({message: `${name}: shutting down after ${signal}`})

  await Promise.all([
    closeHttpServer(),
    closeVLCBServer()
  ])

  process.exit(0)
}

async function closeVLCBServer() {
  const closeTimeout = new Promise((resolve) => {
    setTimeout(() => {
      winston.error({message: `${name}: VLCB shutdown timed out`})
      resolve()
    }, 5000)
  })

  await Promise.race([
    vlcbStartup.then((vlcbServer) => vlcbServer.close()),
    closeTimeout
  ])
}

function closeHttpServer() {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close(resolve)
  })
}

function handleVLCBStartupError(error) {
  const message = `${name}: VLCB startup failed: ${error.message}`
  winston.error({message})
  console.error(message)
  process.exit(1)
}

if (process.env.MMC_SERVER_DISABLE_UI !== '1') {
  try {
    // open a window with the port used by express
    var win = nw.Window.open("http://localhost:" + port, {}, function() {
      win.on('loaded', function() {
        win.maximize()
      });
    });
  } catch {
    // if it fails, probably not using nw, so use openurl
    require("openurl").open("http://localhost:" + port, (e) => {
      if (e != undefined) {
        winston.error({message: `${name}: Error when using openurl: ${e}`})
      }
    });
  }
}
