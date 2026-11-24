@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-ai-workflow.ps1"
set "workflow_exit=%ERRORLEVEL%"
echo.
pause
exit /b %workflow_exit%
