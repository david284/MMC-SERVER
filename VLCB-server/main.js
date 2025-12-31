let path = require('path')
const winston = require('../config/winston.js').winston;
const name = "main"
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

var debug = require('debug')('express:server');

