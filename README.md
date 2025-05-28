
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
2. this application - see installation section
3. a connection to the device to be tested  - see Connection section

## Node.js
This application requires Node.js (& npm) to run   
Useful guide to installing NodeJS ->https://www.pluralsight.com/resources/blog/guides/getting-started-with-nodejs

Get Node.js from -> https://nodejs.org/en/download/package-manager/

## Installation:
### All Platforms
Once Node.js is installed, clone the application, or take the zip file, & extract to your location of choice   
Use the green 'code' button near the top of this page
See the [Git Cloning](GitCloning.md) page for more about cloning a repository

In the folder where MMC is cloned or copied locally, at the command line run 'npm install' to load all dependancies - this may take a little while, so please be patient

### Windows
There is a dedicated [Windows install stript](InstallAndRun/Windows/installMMC.cmd). You may download this to your local machine and "Run as Administrator". After confirming the execution at the Windows prompts the script will check and install NodeJS, Git and MMC. It will also create MMC link icons on the Desktop and in the start menu to run MMC.

## Connection
On startup, a dialog will be displayed, expecting a layout to be selected before the 'proceed' option can be clicked
A default layout will be created if none exist, but it's recommended that an appropriately named layout is created. Multiple layouts can be created, each with their own configuration & data (names & groups etc..) 
By default, layouts will be set to 'auto', which will attempt to automatically find a CANUSB or CANUSB4 device connected via USB, and then use that to connect to the CANBUS network
There is an INFO button on the startup dialog that provides more information on the options that can be selected

## Execution:
To run the app, use 'npm start' at the command line
The program will open a web page using the default web browser, and the 'startup' dialog displayed as mentioned above

# 'user' data
Data entered by the user, such as the user configured layouts and the associated names & groups, are stored independently of the application, so upgrading or moving the application won't lose this information
See the [User Data](UserData.md) page for information about how user data is stored

# Pre-Built version of MMC
There was a pre-built version of MMC for windows only, using NW.js (previously known as node-webkit)
Unfortunately, it no longer works
It is likely my ignorance of this, but I found it difficult to create, and had reports of others not being able to use it
I would welcome any help from anyone who has experience in creating installable nodejs applications

# testing
For testing purposes, there is a software simulation of a CBUS network available, again using the 'network' option, 
which avoids the need for any other physical hardware   
This application provides a simulation of multiple modules on a VLCB network, and has been used to test operation of this conformance test   
https://github.com/david284/CbusNetworkSimulator.git

