var winston = require('winston');

/*
for reference only, default npm logging levels used
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

// custom format - replicate simple console.log output
var messageOnly = winston.format.combine(
  winston.format.printf((info) => {
    return info.message;
}));


var options = {
  console: {
    level: 'error',
    handleExceptions: true,
  	format: messageOnly
  },
  fileDebug: {
    level: 'debug',
    filename: `./unit_tests/logs/unit-test-debug.log`,
	  options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 1000000,
    maxFiles: 5,
	  format: timeStampFirst
  },
  fileError: {
    level: 'error',
    filename: `./unit_tests/logs/unit-test-error.log`,
	  options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 1000000,
    maxFiles: 5,
	  format: timeStampFirst
  },
  fileInfo: {
    level: 'info',
    filename: `./unit_tests/logs/unit-test-info.log`,
	  options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 1000000,
    maxFiles: 5,
	  format: timeStampFirst
  },
  fileWarn: {
    level: 'warn',
    filename: `./unit_tests/logs/unit-test-warn.log`,
	  options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 1000000,
    maxFiles: 5,
	  format: timeStampFirst
  }
};

//
// Use inbuilt default logger instead of creating another logger
// Config then only has to be specified once in highest level file, 
// and other included modules then just need require 'winston/js' with no config so they then pickup the default logger
// Thus allowing different root programs to specify different configs - i.e. different configs for run and test for example
// default logger is essentially a blank logger, and has no transports setup, so need to add them
//

winston.add(new winston.transports.Console(options.console));
winston.add(new winston.transports.File(options.fileDebug));
winston.add(new winston.transports.File(options.fileError));
winston.add(new winston.transports.File(options.fileInfo));
winston.add(new winston.transports.File(options.fileWarn));


winston.stream = {
  write: function(message, encoding) {
    winston.info(message);
  },
};

module.exports = winston;
