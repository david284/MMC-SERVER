# 'user' data
Data entered by the user, such as the user configured layouts and the associated names & groups, are stored independently of the application, so upgrading or moving the application won't lose this information. This also includes any module descriptor files uploaded by the user

The location of this data is dependant on the Operating System being used
Windows: c:\ProgramData\MMC-SERVER
linux & MAC\OS: home\MMC-SERVER
Note that for windows, all users share the same user data
But for the other platforms, the 'user' data is specific to the user thats signed-in

For normal operation this is expected to be transparent to the user, however it is also possible to change this to a custom location (even a different drive), using a 'customUserDirectory' setting - but this should be treated as an 'advanced' level option

There is an appSettings.json file, which has a userDataMode setting - by default this is 'APP', and the user data will be stored as described above 
Hoever, if this userDataMode setting is changed to 'CUSTOM', then the MMC will expect a 'customUserDirectory' setting in the appSettings.json file, which would point to this new location
Note that as this is a JSON file, any special characters need to be preceeded by the escape character '\'
e.g. "c:\\temp\\MMC-SERVER"
It is strongly recommended that any changes made to appSettings.json are tested using an online JSON validator (there are many easily available online) before attempting to run MMC 
This appSettings.json file is always stored in the directories described above (so won't be overwritten by an upgrade), but unlike the 'user' data, won't be affected by the 'CUSTOM' setting
It is the users responsibility to ensure the custom directory is accessible by the system and has the correct permissions
