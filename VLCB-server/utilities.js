'use strict';
const winston = require('winston');		// use config from root instance
const {SerialPort} = require("serialport");


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), and can't be changed through reassigment or redeclared

/*

// add separate logger just for failures
const failLogger = winston.createLogger({
  format: winston.format.printf((info) => { return info.message;}),
  transports: [
    new winston.transports.File({ filename: './Test_Results/fails.txt', level: 'error', options: { flags: 'w' } }),
  ],
});

*/


exports.decToHex = function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}



exports.sleep = function sleep(timeout) {
	return new Promise(function (resolve, reject) {
		//here our function should be implemented 
		setTimeout(()=>{
			resolve();
			;} , timeout
		);
	});
};
	


