## 'application generated' files

### Overview

Whilst running, the application will generate certain files e.g.:

A few node information files are written in the application installation directory e.g.

```
[INSTALL_DIRECTORY]
└── config
    └── nodeConfig.json
    └── nodeDescriptors.json
```

Also, logs are written to the directory from where the application was launched:

```
[LAUNCH_DIRECTORY]
└── logs
    ├── bootloaderData.txt
    ├── bustraffic.txt
    ├── console.log
    ├── debug.log
    ├── error.log
    ├── info.log
    └── warn.log
```

In certain scenarios, the installation directory may not be writeable by the application; if this is the case, you are able to change where these files are written to by defining an environment variable (`MMC_SERVER_SYSTEM_DIRECTORY`] that points to a suitable location

Once defined, both sets of files are then written to the defined location:

```
[MMC_SERVER_SYSTEM_DIRECTORY]
└── config
│   └── nodeConfig.json
│   └── nodeDescriptors.json
└── logs
    ├── bootloaderData.txt
    ├── bustraffic.txt
    ├── console.log
    ├── debug.log
    ├── error.log
    ├── info.log
    └── warn.log
```

### Setting the variable

There are differing ways to set the variable, dependening on your use-case and your OS:

#### "Temp" setting via command line

e.g. `MMC_SERVER_SYSTEM_DIRECTORY=/tmp/MMS-SERVER npm start`

#### Permanently setting the variable

If you are on Linux or macOS, you could set the variable in your `${HOME}/.bash_profile` file (if using `bash` shell), or `${HOME}/.profile`

e.g. insert the following line into the file: `export MMC_SERVER_SYSTEM_DIRECTORY=/tmp/MMS-SERVER`

If you're on Windows, then you'll probably set it via `System Properties`:

1. Click on `Start` -> `System` -> `Advanced system settings`
2. Click on the `Environment Variables` button at the bottom of the dialog
3. You can now add a new variable
4. Enter `MMC_SERVER_SYSTEM_DIRECTORY` for the name, and the directory location in the value field
5. Save your settings and you should be done


