# Linux Installer

**installMMC.sh** is the install script for Ubuntu Linux systems and is found in the folder **InstallAndRun/Linux**.

This uses the **apt** package manager and so this may not work on Debian based systems as they normally use **dpkg** instead. **apt** may be installed on some distributions so it is worth giving it a go.

The installer installs just for the current user. This means that the majority of the script does not need to be run as root (no need to sudo) but it will sudo in order to install or update nodeJS or git if
required. It will prompt the user for the administrator password if required.

The attached files would normally be stored in ***~*/MMC/MMC-SERVER/InstallAndRun/Linux**/****** but the **installMMC.sh** can be savedto a temporary directory and run from there. Execute permission will need to be set on the install script after saving it to the temporary directory:

**chmod 755 installMMC.sh**

Then execute the install script:

**./installMMC.sh**

This should then get the necessary dependences of git, npm, nodejs before downloading MMC itself. It will now install the MMC program into **~/MMC**. 

A MMC icon will added to the desktop and a MMC menu item added to the start application menu. Note that MMC is now added to the desktop but the icon may initially be a cog. When the user double clicks on the icon they are prompted whether to trust the file and if they select "Always trust" then the icon is updated correctly. Trusting the file is necessary to run MMC.

Note The run script does NOT currently check the MMC version when MMC is started.

Ian Hogg

**Using USB (CANUSB / CANUSB4)**

The user account may not have permissions to access the usb ports. This may be solved this by running the following:

*sudo usermod -aG dialout `<username>`*
