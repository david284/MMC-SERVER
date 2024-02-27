
# MMC
Module Manangement Console
This is a nodejs program to manage VLBC & CBUS modules
Being based on NodeJS, it is a cross platform application, running on windows, linux & MacOS

There are essentially two components:
1. **The MMC-Server** - this handles all the communications to&from the module, has the majority of the logic, and also starts a it's own simple web server to host the web pages for the MMC-Client. For the web pages, a pre-built version of the MMC-Client is embedded into the MCC_Server, so only the MMC-Server is needed to be distributed
2. **The MMC-Client**, which is a web based application that provides the user interface, and uses web sockets to talk to the MMC-Server to get its data

Once run, the program will start the client on the same machine in the default browser, but like any other web server, it will accept connections from browsers on other machines on the same network - no need to load software on those machines
In principal, another machine could be a tablet or mobile on the same network, but very little testing has been done for this situation

# Pre-Built version of MMC
There is a pre-built version of MMC for windows only
[MMC v0.3.4](https://drive.google.com/drive/folders/13aIiK6aS5IIsKclI7LTy1RCsYEfLOEQG?usp=sharing)
This is wholly self contained, including a pre-built version of NodeJS for windows, and needs no additional downloads or setup. This will auto detect and use either CANUSB or CANUSB4

# To run the application using NodeJS (all platforms)

## Requirements
The following is needed to run the application from the github project

1. Node.js - see Node.js section
2. a connection to the device to be tested  - see Connection section
3. this application - see installation section

## Node.js
This application requires Node.js (& npm) to run   
Get Node.js from -> https://nodejs.org/en/download/package-manager/

## Installation:
Once Node.js is installed, clone the application, or take the zip file, & extract to your location of choice   
Use the green 'code' button near the top of this page   
(cloning is recommended, as it's easier to update)

After the repo is cloned locally, at the root of the repo, run 'npm install' to load all dependancies - this may take a little while

On windows, once installed, if you then get npm failing to run (I get mixed '\' and '/' trying to load files),  you may need to "Set the npm run shell" by running the following
	npm config set script-shell "C:\\Program Files\\git\\bin\\bash.exe"   
Original source for this fix -> https://digipie.github.io/digidocs/nodejs/set-npm-run-shell/

## Connection
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

## Execution:
To run the app, use 'npm start' at the command line
or  'npm start [command line options]' - see below for command line options
The program will open a web page using the default web browser

## Command line options
use 'npm start [command line options]'
   auto             - (or just 'npm start') attempts to automatically find CANUSB4
   network          - uses tcp connection
   serialPort=<XXX> - selects specific serial port (e.g. COM3)



