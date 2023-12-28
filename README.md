
# MMC-SERVER
Module Manangement Console
This is a nodejs program which will connect to one or more CANUSB's, and opens a web page to manage VLBC & CBUS modules

# Requirements
1. Node.js - see Node.js section
2. a connection to the device to be tested  - see Connection section
3. this application - see installation section

# Node.js
This application requires Node.js (& npm) to run   
Get Node.js from -> https://nodejs.org/en/download/package-manager/

# Installation:
Once Node.js is installed, clone the application, or take the zip file, & extract to your location of choice   
Use the green 'code' button near the top of this page   
(cloning is recommended, as it's easier to update)

After the repo is cloned locally, at the root of the repo, run 'npm install' to load all dependancies - this may take a little while

On windows, once installed, if you then get npm failing to run (I get mixed '\' and '/' trying to load files),  you may need to "Set the npm run shell" by running the following
	npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"   
Original source for this fix -> https://digipie.github.io/digidocs/nodejs/set-npm-run-shell/

# Connection
By default, the application will attempt to automatically find a CANUSB or CANUSB4 device connected via USB,
and then use that to connect to the CANBUS network
A specific serial port can be selected using the 'serialPort=<xxxx>' option - see 'command line options' below
This would be used for a serial port that doesn't use a CANUSB4

Alternatively, a network connection can be used, using an optional command line parameter 'network', so that applications like 'cbusServer' can be used, typically on a remote machine
The cbusServer service here -> See https://www.merg.org.uk/merg_wiki/doku.php?id=cbus_server:cbus_server&s[]=cbusserver   
See details on cbusServer on setting up the serial port   

The default IP settings should work 'out the box'   
But the ip & port settings are in the server.js file, and can easily changed for a remote IP connection or a different port if required   

Alternatively, there is a software simulation of a CBUS network available, again using the 'network' option, 
which avoids the need for any other physical hardware   
This application provides a simulation of multiple modules on a VLCB network, and has been used to test operation of this conformance test   
https://github.com/david284/CbusNetworkSimulator.git

# Execution:
To run the app, use 'npm start' at the command line
or  'npm start [command line options]' - see below for command line options
The program will open a web page using the default web browser

# Command line options
use 'npm start [command line options]'
   auto             - (or just 'npm start') attempts to automatically find CANUSB4
   network          - uses tcp connection
   serialPort=<XXX> - selects specific serial port (e.g. COM3)



