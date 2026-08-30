@echo off

cd /d "%~dp0app"

"%~dp0runtime\node.exe" main.js
