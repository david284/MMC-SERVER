# MMC

Module Management Console (MMC) is an application for managing MERG CBUS/VLCB modules.

MMC consists of two components:

1. **MMC-SERVER** handles communication with CBUS/VLCB modules and provides the web server used by the application.
2. **MMC-CLIENT** provides the browser-based user interface.

MMC-SERVER releases include the corresponding pre-built MMC-CLIENT, so end users only need to install MMC-SERVER.

When MMC is started, the user interface is opened automatically in the default web browser. It can also be accessed from other devices on the same local network.

# Installation

Pre-built packages are available for Windows, Linux and macOS.

See **[INSTALLATION.md](INSTALLATION.md)** for downloads, installation instructions, application data locations, logs, upgrades and uninstalling MMC.

# Using MMC

On startup, MMC displays a dialog for selecting a layout and connection method.

A default layout is created if none exists. Multiple layouts can be created, each with its own configuration and data.

By default, the connection is set to `auto`, which attempts to find a connected CANUSB or CANUSB4 device automatically.

The INFO button on the startup dialog provides further information about the available connection options.

MMC's embedded web server uses port `3000` by default.

# Development

The source repository is intended for development and testing. Building or running MMC from source requires additional development tools and dependencies.

* **Contributors:** See [CONTRIBUTING.md](CONTRIBUTING.md).
* **Maintainers and developers:** See [DEVELOPMENT.md](DEVELOPMENT.md).

# Testing with the CBUS simulator

A software simulation of a CBUS network is available for development and testing without physical CBUS hardware.

See [CbusNetworkSimulator](https://github.com/david284/CbusNetworkSimulator) for details.

