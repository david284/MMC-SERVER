@echo off

set "MMC_SERVER_APP_STORAGE_DIRECTORY=%LOCALAPPDATA%\MMC"

cd /d "%~dp0app"

"%~dp0runtime\node.exe" main.js
