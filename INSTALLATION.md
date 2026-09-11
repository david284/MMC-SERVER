# Installing MMC

MMC is available as pre-built packages for Windows, Linux and macOS.

The pre-built packages include the required Node.js runtime, production dependencies and MMC-CLIENT. **End users do not need to install Node.js, npm or Git.**

## Downloading MMC

Download the appropriate package for your operating system from the [MMC-SERVER Releases](https://github.com/david284/MMC-SERVER/releases) page.

Release assets are provided for the supported operating systems and architectures.

## Windows

Download and run the Windows x64 installer:

```text
MMC-<version>-windows-x64-setup.exe
```

Follow the installer prompts. MMC is added to the Windows Start Menu, with an option to create a desktop shortcut.

Start MMC using the Start Menu or desktop shortcut.

### Application data and logs

MMC stores writable application state separately from the installed program:

```text
%LOCALAPPDATA%\MMC
```

Typically this is:

```text
C:\Users\<username>\AppData\Local\MMC
```

Configuration is stored under:

```text
%LOCALAPPDATA%\MMC\config
```

Logs are stored under:

```text
%LOCALAPPDATA%\MMC\logs
```

### Uninstalling

MMC can be removed using the normal Windows installed-apps interface.

The installed application files are removed, but the files under `%LOCALAPPDATA%\MMC` are retained so that configuration is preserved if MMC is subsequently reinstalled.

## Linux

### Debian, Ubuntu and Linux Mint

For Debian-based distributions, download the `.deb` package:

```text
MMC-<version>-linux-x64.deb
```

Install it with:

```bash
sudo apt install ./MMC-<version>-linux-x64.deb
```

MMC can then be started from the desktop application menu or from a terminal:

```bash
mmc
```

### Application data and logs

MMC stores its writable state under:

```text
~/.local/state/mmc
```

Configuration is stored under:

```text
~/.local/state/mmc/config
```

Logs are stored under:

```text
~/.local/state/mmc/logs
```

### Uninstalling

Remove the Debian package with:

```bash
sudo apt remove mmc
```

The files under `~/.local/state/mmc` are retained so that configuration is preserved if MMC is subsequently reinstalled.

### Generic Linux archive

A generic Linux x64 archive is also available from the Releases page.

This may be useful on Linux distributions that do not support Debian packages. Compatibility depends on the target distribution.

## macOS

Download the archive appropriate for the Mac:

* `arm64` — Apple Silicon Macs
* `x64` — Intel Macs

To check the architecture, run:

```bash
uname -m
```

`arm64` indicates Apple Silicon and `x86_64` indicates an Intel Mac.

Extract the downloaded archive and run MMC using the supplied `runMMC` launcher.

### macOS security

Current MMC packages are not signed with an Apple Developer ID. macOS may therefore prevent MMC from running because it cannot verify the developer.

For testing, MMC can be explicitly allowed using the macOS Privacy & Security settings.

### Application data and logs

MMC stores writable application state under:

```text
~/Library/Application Support/MMC
```

Configuration is stored under:

```text
~/Library/Application Support/MMC/config
```

Logs are stored under:

```text
~/Library/Application Support/MMC/logs
```

These files are separate from the downloaded application and can be retained when upgrading or replacing MMC.

## Starting MMC

When MMC starts, it launches the user interface in the default web browser.

The startup dialog allows a layout and connection method to be selected. A default layout is created if none exists.

By default, MMC's web server uses port `3000`.

## Upgrading MMC

Download and install the newer release for your operating system.

MMC's writable configuration and state are stored separately from the installed application, so replacing or reinstalling the application does not normally remove the existing configuration.

## Troubleshooting

If MMC fails to start or behaves unexpectedly, the logs can be found at:

| Platform | Log directory                            |
| -------- | ---------------------------------------- |
| Windows  | `%LOCALAPPDATA%\MMC\logs`                |
| Linux    | `~/.local/state/mmc/logs`                |
| macOS    | `~/Library/Application Support/MMC/logs` |

When reporting a problem, information from these logs may help diagnose the issue.

Developers who want to build, modify or test MMC from source should use the development instructions in [CONTRIBUTING.md](CONTRIBUTING.md) and [DEVELOPMENT.md](DEVELOPMENT.md).

