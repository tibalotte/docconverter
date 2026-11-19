@echo off
REM Double-cliquer pour lancer la copie des examens vers le dossier Correction
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0CopierExamens.ps1"
if errorlevel 1 pause
