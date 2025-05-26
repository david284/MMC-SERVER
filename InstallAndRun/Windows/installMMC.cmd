@echo off
REM 
REM  **************************************************************************
REM  **************************************************************************
REM  **************************************************************************
REM  This is the MMC install and upgrade script for Windows
REM 
REM  Ian Hogg 10 May 2025
REM 
REM  **************************************************************************
REM  **************************************************************************
REM  **************************************************************************

REM  First some setting which may be changed but mostly these will be ok
set NODEJS_DL_URL=https://nodejs.org/en/download
	REM  Good enough, Git doesn't need to be latest
set GIT_VERSION=2.49.
set MMCSERVER_URL=https://github.com/david284/MMC-SERVER.git
set INSTALL_DIR=C:\MMC

setlocal enabledelayedexpansion
echo Welcome to the MMC installer for Windows.
echo Checking for Administrator permission...
net session >nul 2>&1
if %errorLevel% == 0 (
        echo Administrative permissions confirmed.
) else (
	echo Insufficient permissions. You need to run this as Administrator.
	pause
	exit /b 1
)
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
FOR /F "delims=" %%i IN ('systeminfo ^| findstr /C:"System Type"') DO (
	set stype=%%i
)
REM a string of the form "System Type:                   x64-based PC"
REM remove the first 31 chars
set stype2=%stype:~31%
if "%stype2%"=="x64-based PC" (
	set SYSTEM_ARCH=x64
	set GIT_PROCESSOR=64-bit
)
if "%stype2%"=="ARM64-based PC" (
	set SYSTEM_ARCH=arm64
	set GIT_PROCESSOR=arm64
)
if "%stype2%"=="x86-based PC" (
	set SYSTEM_ARCH=x86
	set GIT_PROCESSOR=64-bit
)
if "%SYSTEM_ARCH%x"=="x" (
	echo Unknown system architecture
	pause
	exit /b 2
)
echo Architecture determined to be %SYSTEM_ARCH%
REM 
REM  **************************************************************************
REM  The next big block works out what the latest version of npm/Node is. 
REM  To do this we pull down the download page from the nodejs.org website 
REM  and search through the page for the Long Term Support (LTS) version.
REM  **************************************************************************
REM 

echo Working out the latest NodeJS version...
REM  Unfortunately cmd seems to fail to store the entire page in a variable so
REM  my solution is to read 1000 bytes at a time. Actually read 1050 
REM  overlapping with the next read so that if the version number is split by 
REM  a read then the next read will encompass the entire version number.
set s=0
set e=1050
:parts
	REM  get part of the page
	FOR /F "delims=" %%i IN ('curl -fsSLk -r %s%-%e%  %NODEJS_DL_URL%') DO set h=%%i
	REM  does it contain the LTS string?
	REM  if not then add 1000 and loop 
	if "x!h:(LTS)=!"=="x!h!" (
		set /a s=%s%+1000
		set /a e=%e%+1000
		goto parts
	) 
REM  The page segment currently in h now contains the LTS string.
REM  next extract the version number between ...v version LTS....

:retry
REM  split on the letter v, discarding stuff before the v it it doesn't 
REM  contain LTS and keep the stuff after and loop.
FOR /F "tokens=1,* delims=v" %%i IN ("!h!") DO (
	set buffer="%%i"
	if NOT "x!buffer:(LTS)=!"=="x!buffer!" (
		FOR /f "tokens=1" %%b IN (!buffer!) do (
		    set NODEJS_VERSION=%%b
		)
	) else (
		set h=%%j
		goto retry
	)
)
REM  We now have the version number of the LTS on the nodejs.org website.
echo Latest NodeJS version was found to be v%NODEJS_VERSION%


REM 
REM  **************************************************************************
REM  The next block works out whether npm/Node needs to be installed or updated. 
REM 
REM 
REM  **************************************************************************
REM 

REM  Get the NodeJS LTS download filename
set NODEJS_DL_FILE=node-v%NODEJS_VERSION%-%SYSTEM_ARCH%.msi
set NODEJS_DIST_URL=https://nodejs.org/dist/v%NODEJS_VERSION%/%NODEJS_DL_FILE%

cd "%INSTALL_DIR%"
md temp 2>NUL
cd temp


REM  check to see if node is installed
node --version >NUL
REM  if node is not present then install it
REM  the user should selct to Automatically install all the tools
REM  Will install chocolatey, Python
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
) else (
	FOR /F "delims=" %%i IN ('node --version') DO (
		set this_version=%%i
	)
	echo NodeJS version !this_version! already installed.
	if "!this_version!"=="v%NODEJS_VERSION%" (
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
git --version > NUL
if %ERRORLEVEL% NEQ 0 (
	echo Git is not present so it will be installed...
	if not exist %GIT_DL_FILE% (
		echo Git installation file not detected - getting...
		curl -fLk -o %GIT_DL_FILE% %GIT_DL_URL%
	) else (echo Git installer already downloaded.)
	echo Installing Git...
	.\%GIT_DL_FILE%
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
cd "%INSTALL_DIR%"

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
FOR /F %%i IN ('git fetch --dry-run origin main 2^>^&1') DO (
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

