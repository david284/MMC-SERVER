
# MMC
Module Manangement Console
This is a nodejs program to manage VLBC & CBUS modules
Being based on NodeJS, it is a cross platform application, running on windows, linux & MacOS

There are essentially two components:
1. **The MMC-Server** - this handles all the communications to&from the module, has the majority of the logic, and also starts a it's own simple web server to host the web pages for the MMC-Client. For the web pages, a pre-built version of the MMC-Client is embedded into the MCC_Server, so only the MMC-Server is needed to be distributed
2. **The MMC-Client**, which is a web based application that provides the user interface, and uses web sockets to talk to the MMC-Server to get its data

Once run, the program will start the client on the same machine in the default browser, but like any other web server, it will accept connections from browsers on other machines on the same network - no need to load software on those machines
In principal, another machine could be a tablet or mobile on the same network, but very little testing has been done for this situation

# To run the application using NodeJS (all platforms)

## Requirements
The following is needed to run the application from the github project

1. Node.js - see Node.js section
2. a connection to the device to be tested  - see Connection section
3. this application - see installation section

## Node.js
This application requires Node.js (& npm) to run   
Useful guide to installing NodeJS ->https://www.pluralsight.com/resources/blog/guides/getting-started-with-nodejs

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
A startup dialog will expect a layout to be selected before the 'proceed' option can be clicked 
By default, the application will attempt to automatically find a CANUSB or CANUSB4 device connected via USB, and then use that to connect to the CANBUS network
There is an INFO button on the startup dialog that provides more information

For testing purposes, there is a software simulation of a CBUS network available, again using the 'network' option, 
which avoids the need for any other physical hardware   
This application provides a simulation of multiple modules on a VLCB network, and has been used to test operation of this conformance test   
https://github.com/david284/CbusNetworkSimulator.git

## Execution:
To run the app, use 'npm start' at the command line
The program will open a web page using the default web browser

# 'user' data
Data entered by the user, such as the user configured layouts and the associated names & groups, are stored independently of the application, so upgrading or moving the application won't lose this information
See the [User Data](UserData.md) page for information about how user data is stored

# Pre-Built version of MMC
There was a pre-built version of MMC for windows only, using NW.js (previously known as node-webkit)
Unfortunately, it no longer works
It is likely my ignorance of this, but I found it difficult to create, and had reports of others not being able to use it
I would welcome any help from anyone who has experience in creating installable nodejs applications


