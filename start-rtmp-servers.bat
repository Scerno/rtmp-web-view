@echo off
setlocal

REM Always work relative to the folder this BAT file lives in.
set "RTMP_ROOT=%~dp0"

echo Starting RTMP services...

REM Check MediaMTX exists.
if not exist "%RTMP_ROOT%mediamtx.exe" (
	echo.
	echo ERROR: mediamtx.exe was not found in:
	echo %RTMP_ROOT%
	echo.
	pause
	exit /b 1
)

REM Check the web viewer exists.
if not exist "%RTMP_ROOT%web\package.json" (
	echo.
	echo ERROR: web\package.json was not found in:
	echo %RTMP_ROOT%web
	echo.
	pause
	exit /b 1
)

REM Check npm is available.
where npm >nul 2>&1
if errorlevel 1 (
	echo.
	echo ERROR: npm was not found in PATH.
	echo Make sure Node.js is installed correctly.
	echo.
	pause
	exit /b 1
)

REM Start MediaMTX in its own terminal window.
start "MediaMTX Server" /D "%RTMP_ROOT%" cmd /k "mediamtx.exe"

REM Give MediaMTX a moment to initialise before starting the web viewer.
timeout /t 1 /nobreak >nul

REM Start the Node web viewer in its own terminal window.
start "RTMP Web Viewer" /D "%RTMP_ROOT%web" cmd /k "npm start"

echo.
echo MediaMTX and the web viewer have been started.
echo You can close this window.
timeout /t 2 /nobreak >nul

endlocal
exit /b 0
