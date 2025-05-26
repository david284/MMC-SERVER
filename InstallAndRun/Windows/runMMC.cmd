@echo off
REM ***************************************************************************
REM ***************************************************************************
REM ***************************************************************************
REM Script to run MMC
REM 
REM by Ian Hogg   14 May 2025
REM
REM ***************************************************************************
REM ***************************************************************************
REM ***************************************************************************
setlocal enabledelayedexpansion
set INSTALL_DIR=C:\MMC

REM  check to see if MMC-SERVER is up to date
cd "%INSTALL_DIR%\MMC-SERVER"
set cnt=0
FOR /F %%i IN ('git fetch --dry-run origin main 2^>^&1') DO (
	set /a cnt=!cnt!+1
)
REM  check if not up to date
REM  ask user if they want to update it
if NOT !cnt!==0 (
	echo MMC is out of date! You should re-run the installation script to update MMC.
	choice /m "Continue anyway^?"
	if !ERRORLEVEL! NEQ 1 (
		exit /b 0
	) 
)

REM  start MMC
REM
echo Starting MMC to display on browser
npm start
