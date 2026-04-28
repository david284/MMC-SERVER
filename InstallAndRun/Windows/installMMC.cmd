@echo off
REM 
REM  **************************************************************************
REM  **************************************************************************
REM  **************************************************************************
REM  This is the MMC install and upgrade script for Windows
REM 
REM  Ian Hogg
REM 
REM  **************************************************************************
REM  **************************************************************************
REM  **************************************************************************

REM  First some setting which may be changed but mostly these will be ok
REM  Good enough, Git doesn't need to be latest
set GIT_VERSION=2.49.0
set MMCSERVER_URL=https://github.com/david284/MMC-SERVER.git
set INSTALL_DIR=C:\MMC
set GIT=C:\Program Files\Git\cmd

setlocal enabledelayedexpansion
echo Checking for Administrator permission...
whoami /groups | findstr /i "S-1-16-12288" >nul 2>&1
if %errorLevel% == 0 (
        echo Administrative permissions confirmed.
) else (
	echo Insufficient permissions. You need to run this as Administrator.
	pause
	exit /b 1
)

if "%~1"=="__PHASE_TWO__" (
    goto :installmmc
)

echo Welcome to the MMC installer for Windows. Version 27 July 2025 16:58
echo Installation directory set to %INSTALL_DIR%
REM  ensure installation directory can be created
md "%INSTALL_DIR%" 2>NUL
if NOT EXIST "%INSTALL_DIR%\" (
	echo You need to run this as Administrator.
	pause
	exit /b 1
)

REM 
REM  **************************************************************************
REM  Next we will determine the system architecture. This is needed later in
REM  order to download the correct version of npm/Node and Git.
REM  systeminfo has the architect listed under "System Type"
REM  **************************************************************************
REM 
FOR /F "tokens=2 delims=:" %%i IN ('systeminfo ^| findstr /C:"System Type"') DO (
	set stype=%%i
)
REM a string of the form "System Type:                   x64-based PC"
REM REM strip out spaces
set stype2=%stype: =%
if "%stype2%"=="x64-basedPC" (
	set SYSTEM_ARCH=x64
	set GIT_PROCESSOR=64-bit
)
if "%stype2%"=="ARM64-basedPC" (
	set SYSTEM_ARCH=arm64
	set GIT_PROCESSOR=arm64
)
if "%stype2%"=="x86-basedPC" (
	set SYSTEM_ARCH=x86
	set GIT_PROCESSOR=64-bit
)
if "%SYSTEM_ARCH%x"=="x" (
	echo Unknown system architecture
	pause
	exit /b 2
)
echo Architecture determined to be %SYSTEM_ARCH%

echo Working out the latest NodeJS version...
REM We need jq to parse the json from nodejs.org; if it's not available, we'll temp install it
WHERE jq >NUL 2>NUL
if %ERRORLEVEL% EQU 0 (
    set JQ=jq
) else (
    echo Fetching jq...
    if "%GIT_PROCESSOR%"=="arm64" (
        set "JQ_EXE=jq-windows-amd64.exe"
    ) else (
        set "JQ_EXE=jq-win64.exe"
    )
    curl -sLo "%TEMP%\!JQ_EXE!" "https://github.com/jqlang/jq/releases/latest/download/!JQ_EXE!"
    set "JQ=%TEMP%\!JQ_EXE!"
)

REM Fetch the latest LTS version from the nodejs.org website.
FOR /F "delims=" %%F IN ('curl -fsSL https://nodejs.org/download/release/index.json ^
                           ^| "%JQ%" -r "[.[]|select (.lts != false)][0] | .version"') DO (
   set NODEJS_VERSION=%%F
)
echo Latest NodeJS version was found to be %NODEJS_VERSION%

REM  **************************************************************************
REM  The next block works out whether npm/Node needs to be installed or updated. 
REM  **************************************************************************

REM  Get the NodeJS LTS download filename
set NODEJS_DL_FILE=node-%NODEJS_VERSION%-%SYSTEM_ARCH%.msi
set NODEJS_DIST_URL=https://nodejs.org/dist/%NODEJS_VERSION%/%NODEJS_DL_FILE%

cd /d "%INSTALL_DIR%"
md temp 2>NUL
cd temp

REM  check to see if node is installed
node --version >NUL
REM  if node is not present then install it
REM  Note that there is no need for the user to select to
REM  "Automatically install the necessary tools"
if %ERRORLEVEL% NEQ 0 (
	echo NodeJs is not installed...
	if not exist %NODEJS_DL_FILE% (
		echo Getting NodeJS and npm from %NODEJS_DIST_URL%
		curl -fsSLk -o %NODEJS_DL_FILE% %NODEJS_DIST_URL%
	) else (
		echo NodeJS installation file already downloaded.
	)
	echo Installing NodeJS...
	msiexec /i %NODEJS_DL_FILE%
	set relaunch_required="true"
) else (
	FOR /F "delims=" %%i IN ('node --version') DO (
		set this_version=%%i
	)
	echo NodeJS version !this_version! already installed.
	if "!this_version!"=="%NODEJS_VERSION%" (
		echo NodeJS is up to date.
	) else (
		echo NodeJS should be updated.
		choice /m "Do you want to upgrade NodeJS now^?"
		if !ERRORLEVEL! EQU 1 (
			if not exist %NODEJS_DL_FILE% (
				echo Getting NodeJS and npm from %NODEJS_DIST_URL%...
				curl -fsSLk -o %NODEJS_DL_FILE% %NODEJS_DIST_URL%
			) else (
				echo NodeJS installation file already downloaded,
			)
			echo Installing NodeJS...
			msiexec /i %NODEJS_DL_FILE%
			set relaunch_required="true"
		)
	)
)

REM
REM  **************************************************************************
REM  The next block works out whether Git already is present or needs to be 
REM  installed. 
REM 
REM  **************************************************************************
REM 
REM 
set GIT_DL_FILE=Git-%GIT_VERSION%-%GIT_PROCESSOR%.exe
set GIT_DL_URL=https://github.com/git-for-windows/git/releases/download/v%GIT_VERSION%.windows.1/%GIT_DL_FILE%

REM  get Git if not already installed
REM
REM  A problem has been reported in which after installing Git the Git commands don't work.
REM  This seems to be an issue where Git doesn't set the path in the current shell so we need
REM  to explicitly add it so git will work later in this script.
git --version > NUL
if %ERRORLEVEL% NEQ 0 (
	echo Git is not present so it will be installed...
	if not exist %GIT_DL_FILE% (
		echo Git installation file not detected - getting...
		curl -fLk -o %GIT_DL_FILE% %GIT_DL_URL%
	) else (echo Git installer already downloaded.)
	echo Installing Git...
	.\%GIT_DL_FILE%
	set relaunch_required="true"
) else (echo Git is already installed.)

REM 
REM  **************************************************************************
REM  The next block gets a copy of MMC-SERVER if it is not already present 
REM  and also will update it if not already the latest and the user approves.
REM 
REM  **************************************************************************
REM 
REM  test if node is running - which is likely to be the MMC-SERVER. 
REM  Setop server if it is running
taskkill /IM node.exe 2>NUL
REM 

if %relaunch_required%=="true" (
    echo Injecting new PATH into current session...
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('PATH','Machine')"`) do set "MPATH=%%i"
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('PATH','User')"`) do set "UPATH=%%i"
    if "!UPATH!"=="" (
        set "PATH=!MPATH!"
    ) else (
        set "PATH=!MPATH!;!UPATH!"
    )
    echo "Relaunching..."
    cmd /c "%~f0" __PHASE_TWO__
    exit /b
)

:installmmc

cd /d "%INSTALL_DIR%"

REM  Do we already have a cloned copy?
REM  if not then clone it and install it

echo Checking that MMC exists...
if NOT EXIST "MMC-SERVER\" (
	echo MMC is not present so a copy will be obtained...
	cmd /c "git clone %MMCSERVER_URL%"
	set LINUX_INSTALL_DIR=%INSTALL_DIR:\=/%
	git config --global --add safe.directory !LINUX_INSTALL_DIR!/MMC-SERVER
	echo Installing MMC...
	cd MMC-SERVER
	cmd /c npm install
	cd ..
)
REM Now check that MMC is up to date
echo Checking if MMC is up to date...
cd MMC-SERVER
set cnt=0
FOR /F %%i IN ('git fetch --dry-run origin main 2^>^&1 ^| findstr /C:origin/main') DO (
	set /a cnt=!cnt!+1
)
REM  check if not up to date
REM  ask user if they want to update it
if NOT !cnt!==0 (
	echo MMC is out of date.
	choice /m "Do you want to upgrade MMC now^?"
	if !ERRORLEVEL! EQU 1 (
		echo Updating MMC...
		git pull
		npm update
	) 
) else (
	echo MMC is up to date.
)
cd ..

REM 
REM  **************************************************************************
REM  ADD Links from start menu for all users at end of this code block
REM 
REM  **************************************************************************
REM Create a link from users start menu
echo Creating link from Start Menu...
md "%ProgramData%\Microsoft\Windows\Start Menu\Programs\MMC" 2>NUL
(
	echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
	echo sLinkFile = "%ProgramData%\Microsoft\Windows\Start Menu\Programs\MMC\MMC.lnk"
	echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
	echo oLink.TargetPath = "!INSTALL_DIR!\MMC-SERVER\InstallAndRun\Windows\runMMC.cmd"
	echo oLink.IconLocation = "!INSTALL_DIR!\MMC-SERVER\InstallAndRun\Windows\MMCicon-16.ico"
	echo oLink.Save
)1>CreateShortcut.vbs
cscript //nologo .\CreateShortcut.vbs


REM 
REM  **************************************************************************
REM  ADD Links from Desktop for all users at end of this code block
REM 
REM  **************************************************************************
REM Create a link from users Desktop
echo Creating link from Desktop...
(
	echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
	echo sLinkFile = "%public%\Desktop\MMC.lnk"
	echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
	echo oLink.TargetPath = "%INSTALL_DIR%\MMC-SERVER\InstallAndRun\Windows\runMMC.cmd"
	echo oLink.IconLocation = "%INSTALL_DIR%\MMC-SERVER\InstallAndRun\Windows\MMCicon-256.ico"
	echo oLink.Save
)1>CreateShortcut.vbs
cscript //nologo .\CreateShortcut.vbs

echo Completed installation of MMC!
pause
exit /b 0

