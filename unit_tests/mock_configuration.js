'use strict';
const winston = require('winston');		// use config from root instance
const EventEmitter = require('events').EventEmitter;

class mock_configuration {

  constructor() {
    //                        012345678901234567890123456789987654321098765432109876543210
    winston.debug({message:  '-------------- mock_configuration Constructor --------------'});
    this.eventBus = new EventEmitter();
  } // end constructor

}


module.exports = () => { return new mock_configuration() }


