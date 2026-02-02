# Linux Installer

Note: The `installMMC.sh` script currently only works on Debian based distros, as it uses `apt-get`

To run the installer, execute:

```
bash <(wget -q -O- https://raw.githubusercontent.com/david284/MMC-SERVER/refs/heads/main/InstallAndRun/Linux/installMMC.sh)
```

To view the installer help screen, execute:

```
bash <(wget -q -O- https://raw.githubusercontent.com/david284/MMC-SERVER/refs/heads/main/InstallAndRun/Linux/installMMC.sh) -h
```

Note that `sudo` privileges will be required if OS packages need to installed/updated

An MMC icon will added to the desktop and an MMC menu item added to the start application menu.

Note: Newer versions of `Gnome` have removed support for desktop icons; you may be able to restore the functionality by installing the [Desktop Icons NG extension](https://extensions.gnome.org/extension/2087/desktop-icons-ng-ding/) (I also needed to install the `gir1.2-gnomedesktop-3.0` apt package)

**Using USB (CANUSB / CANUSB4)**

The user account may not have permissions to access the usb ports. This may be solved this by running the following:

```
sudo usermod -aG dialout ${USER}
```

Note: You will need to log out & back in again for the change to take effect
