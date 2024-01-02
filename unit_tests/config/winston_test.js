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
  file: {
    level: 'debug',
    filename: `./unit_tests/logs/unit_tests.log`,
	options: { flags: 'w' },
    handleExceptions: true,
    maxsize: 50*1024*1024, // 50MB
    maxFiles: 5,
	format: timeStampFirst
  },
  console: {
    level: 'warn',
    handleExceptions: true,
	format: messageOnly
  },
};

//
// Use inbuilt default logger instead of creating another logger
// Config then only has to be specified once in highest level file, 
// and other included modules then just need require 'winston/js' with no config so they then pickup the default logger
// Thus allowing different root programs to specify different configs - i.e. different configs for run and test for example
// default logger is essentially a blank logger, and has no transports setup, so need to add them
//

winston.add(new winston.transports.File(options.file));
winston.add(new winston.transports.Console(options.console));


winston.stream = {
  write: function(message, encoding) {
    winston.info(message);
  },
};

module.exports = winston;
