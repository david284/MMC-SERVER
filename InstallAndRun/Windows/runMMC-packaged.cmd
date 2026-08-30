@echo off

set "MMC_SERVER_APP_STORAGE_DIRECTORY=%LOCALAPPDATA%\MMC"
set "MMC_SERVER_LOG_DIRECTORY=%MMC_SERVER_APP_STORAGE_DIRECTORY%\logs"

cd /d "%~dp0app"

"%~dp0runtime\node.exe" main.js
