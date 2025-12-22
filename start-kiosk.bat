@echo off
REM SF Transit Board - Windows Kiosk Startup
REM Requires Python 3 installed

SET PORT=8080
SET DIR=%~dp0

echo Starting SF Transit Board...
echo Directory: %DIR%

REM Start web server in background
start /B python -m http.server %PORT%

REM Wait for server
timeout /t 2 /nobreak > nul

REM Launch Chrome in kiosk mode
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --incognito --disable-infobars "http://localhost:%PORT%"

echo.
echo Press Ctrl+C to stop the server when done.
pause
