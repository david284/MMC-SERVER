#!/usr/bin/bash
#set -x
# 
#  **************************************************************************
#  **************************************************************************
#  **************************************************************************
#  This is the MMC install and upgrade script for Linux
# 
#  Ian Hogg 16 June 2025
# 
#  **************************************************************************
#  **************************************************************************
#  **************************************************************************

#  First some setting which may be changed but mostly these will be ok
MMCSERVER_URL="https://github.com/david284/MMC-SERVER.git"
INSTALL_DIR="$HOME/MMC"

echo "Welcome to the MMC installer for Linux. Version 29 July 2025 20:24"

echo "Installation directory set to $INSTALL_DIR"
#  ensure installation directory can be created
mkdir $INSTALL_DIR
if [ ! -d $INSTALL_DIR ]; then
	echo "You need to run this as Administrator."
	read
	exit 1
fi


# 
#  **************************************************************************
#  The next block works out whether npm/NodeJS needs to be installed or 
#  updated. 
# 
#  **************************************************************************
# 
nodejs --version 2>/dev/nul
if [ $? -ne 0 ]; then
	read -p "Do you wish to ensure NodeJS is up to date? (Y/N)" input
	if [ "X$input" = "XY" ]; then
		# ensure it is up to date
		sudo apt-get update
		sudo apt-get install nodejs
		sudo apt-get install npm
	fi
else
	# not present so do an install
	sudo apt-get update
	sudo apt-get install nodejs
	sudo apt-get install npm
fi

# 
#  **************************************************************************
#  The next block works out whether Git already is present or needs to be 
#  installed. 
# 
#  **************************************************************************
# 
git --version 2>/dev/null
if [ $? -eq 0 ]; then
	read -p "Do you wish to ensure Git is up to date? (Y/N)" input
	if [ "X$input" = "XY" ]; then
		# ensure it is up to date
		sudo apt-get update
		sudo apt-get install git
	fi
else
	# not present so do an install
	sudo apt-get update
	sudo apt-get install git
fi

# 
#  **************************************************************************
#  The next block gets a copy of MMC-SERVER if it is not already present 
#  and also will update it if not already the latest and the user approves.
# 
#  **************************************************************************
# 
#  test if node is running - which is likely to be the MMC-SERVER. 
#  Stop server if it is running
kill -TERM node 2>/dev/null
# 
cd $INSTALL_DIR

#  Do we already have a cloned copy?
#  if not then clone it and install it

echo "Checking that MMC exists..."
if [ ! -d "MMC-SERVER" ]; then
	echo "MMC is not present so a copy will be obtained..."
	git clone "$MMCSERVER_URL"
	git config --global --add safe.directory $INSTALL_DIR/MMC-SERVER
	echo "Installing MMC..."
	cd MMC-SERVER
	npm install
	git config --global --add safe.directory $INSTALL_DIR/MMC_SERVER
	cd ..
fi
# Now check that MMC is up to date
echo "Checking if MMC is up to date..."
cd MMC-SERVER
cnt=`git fetch --dry-run origin main | wc -l`
#  check if not up to date
#  ask user if they want to update it
if [ $cnt -ne 0 ]; then 
	echo "MMC is out of date."
	read -p "Do you want to upgrade MMC now? (Y/N)" input
	if [ "X$input" = "XY" ]; then 
		echo "Updating MMC..."
		git pull
		npm update
	fi 
else
	echo "MMC is up to date."
fi
cd ..


# 
#  **************************************************************************
#  ADD Links from Desktop for all users at end of this code block
# 
#  **************************************************************************
# Create a link from users Desktop and System menu
echo "Creating link from Desktop and System menu..."
cat << _EOF_ > $HOME/MMC/MMC.desktop
[Desktop Entry] 
Encoding=UTF-8
Version=1.0
Name=MMC
Comment=Start the CBUS/VLCB Module Management Configuration tool
GenericName=Module Management Configuration
Type=Application
Terminal=true
Categories=System;
Exec=bash -c "cd $INSTALL_DIR/MMC-SERVER;npm start"
Icon=$INSTALL_DIR/MMC-SERVER/InstallAndRun/Linux/MMCicon-256.png
_EOF_

cp $INSTALL_DIR/MMC.desktop $HOME/Desktop
cp $INSTALL_DIR/MMC.desktop $HOME/.local/share/applications


echo Completed installation of MMC!
read
exit 0

