const winston = require('winston');
const name = "app"
winston.info({message: name + ': Starting'});

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const fork = require('child_process').fork;

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

console.log("starting express");


const vlcbServer = fork('./VLCB-server/server.js')
vlcbServer.on('close', () => {
  console.log(`vlcbServer process exited`);
  console.log(`express process exited`);
  process.exit();
});


/*
const VLCB = require('./VLCB-server/server.js');
VLCB.run();
*/


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

require("openurl").open("http://localhost:" + 3000)


module.exports = app;
