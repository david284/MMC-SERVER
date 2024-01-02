const winston = require('winston')

/*
for rerference only, default_old npm logging levels used
lower number being higher priority
const levels = { 
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};
*/

// custom format to put timestamp first
var timeStampFirst = winston.format.combine(
  winston.format.timestamp({format: 'HH:mm:ss.SSS'}),
  winston.format.printf((info) => {
	  return info.timestamp + " " + info.level + "\t" + info.message;
}));

// custom format to put timestamp first
var consoleTimeStampFirst = winston.format.combine(
  winston.format.timestamp({format: 'HH:mm:ss.SSS'}),
  winston.format.printf((info) => {
	  return info.timestamp + " " + info.message;
}));

// custom format - replicate simple console.log output
var messageOnly = winston.format.combine(
  winston.format.printf((info) => {
    return info.message;
}));


var options = {
  fileDebug: {
    level: 'debug',
    filename: `./logs/debug.log`,
	options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
	format: timeStampFirst
  },
  fileInfo: {
    level: 'info',
    filename: `./logs/info.log`,
	options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
	format: timeStampFirst
  },
  fileWarn: {
    level: 'warn',
    filename: `./logs/warn.log`,
	options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 5242880, // 5MB
    maxFiles: 1,
	format: timeStampFirst
  },
  console: {
    level: 'info',
    handleExceptions: true,
	format: messageOnly
  },
};

//
// Use inbuilt default_old logger instead of creating another logger
// Config then only has to be specified once in highest level file, 
// and other included modules then just need require 'winston/js' with no config so they then pickup the default_old logger
// Thus allowing different root programs to specify different configs - i.e. different configs for run and test for example
// default_old logger is essentially a blank logger, and has no transports setup, so need to add them
//

winston.add(new winston.transports.File(options.fileDebug));
winston.add(new winston.transports.File(options.fileInfo));
winston.add(new winston.transports.File(options.fileWarn));
winston.add(new winston.transports.Console(options.console));


winston.stream = {
  write: function(message, encoding) {
    winston.info(message);
  },
};

module.exports = winston;
