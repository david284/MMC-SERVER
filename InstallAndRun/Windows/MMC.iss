#define MyAppName "MMC"
#define MyAppPublisher "MERG"
#define MyAppExeName "runMMC.cmd"

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

[Setup]
AppId=MMC
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}

DefaultDirName={autopf}\MMC
DefaultGroupName=MMC

DisableProgramGroupPage=yes

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

OutputDir=..\..\dist\installer
OutputBaseFilename=MMC-{#MyAppVersion}-windows-x64-setup

Compression=lzma2
SolidCompression=yes
WizardStyle=modern

SetupIconFile=MMCicon-256.ico
UninstallDisplayIcon={app}\MMCicon-256.ico
UninstallDisplayName=MMC {#MyAppVersion}

[Files]
Source: "..\..\dist\MMC\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "MMCicon-256.ico"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Icons]
Name: "{group}\MMC"; Filename: "{app}\runMMC.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\MMCicon-256.ico"
Name: "{autodesktop}\MMC"; Filename: "{app}\runMMC.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\MMCicon-256.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\runMMC.cmd"; Description: "Launch MMC"; Flags: postinstall nowait skipifsilent
