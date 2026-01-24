@echo off
REM ***************************************************************************
REM ***************************************************************************
REM ***************************************************************************
REM Script to run MMC
REM 
REM by Ian Hogg   14 May 2025
REM
REM 13-November-2025 Greg Palmer - added prompting to update MMC and launch 
REM                                the installer in privileged mode
REM
REM ***************************************************************************
REM ***************************************************************************
REM ***************************************************************************
setlocal enabledelayedexpansion
set INSTALL_DIR=C:\MMC

REM  check to see if MMC-SERVER is up to date
cd "%INSTALL_DIR%\MMC-SERVER"
set cnt=0
FOR /F %%i IN ('git fetch --dry-run origin main 2^>^&1 ^| findstr /C:origin/main') DO (
	set /a cnt=!cnt!+1
)
REM  check if not up to date
REM  ask user if they want to update it
if NOT !cnt!==0 (
	echo MMC is out of date!
	choice /C YN /m "Do you want to run the installer to update MMC now^?"
	if !ERRORLEVEL! EQU 1 (
		set INSTALLER_PATH=%~dp0installMMC.cmd
		
		REM Check if installer exists
		if NOT EXIST "!INSTALLER_PATH!" (
			echo.
			echo ========================================================================
			echo ERROR: Installer not found!
			echo Expected location: !INSTALLER_PATH!
			echo.
			echo The installer script appears to be missing or in an unexpected location.
			echo Please visit the MMC-SERVER repository to download the latest installer:
			echo https://github.com/david284/MMC-SERVER
			echo ========================================================================
			echo.
			pause
			exit /b 1
		)
		
		echo.
		echo ========================================================================
		echo The MMC installer needs to run in administrator mode. You will be 
		echo requested to allow this privilege escalation before it will run.
		echo.
		echo A Windows security prompt will appear asking for permission.
		echo Click YES to proceed with the update, or NO to cancel.
		echo ========================================================================
		echo.
		pause
		
		echo Requesting administrator privileges...
		REM Create VBScript to launch installer with elevation
		set TEMP_VBS=%TEMP%\Run_InstallMMC_Elevated.vbs
		(
			echo Set objShell = CreateObject^("Shell.Application"^)
			echo objShell.ShellExecute "!INSTALLER_PATH!", "", "", "runas", 1
		)1>"!TEMP_VBS!"
		cscript //nologo "!TEMP_VBS!"
		del "!TEMP_VBS!" 2>NUL
		exit /b 0
	) else (
		echo Installer not run.
		choice /C YN /m "Continue running MMC anyway^?"
		if !ERRORLEVEL! NEQ 1 (
			exit /b 0
		)
	)
)

REM  start MMC
REM
echo Starting MMC to display on browser
npm start
