const fs = require('fs');
// lets ensure the logs folder is empty
if (fs.existsSync("./unit_tests/logs")) {
  fs.rmSync("./unit_tests/logs", { recursive: true }) 
  console.log("unit test logs deleted...")
}


const winston = require('./config/winston_test.js')
winston.info({message: 'FILE: AAAA-preUnitTest.spec.js'});

//
// File to clear down logs at the start of any unit tests
//

