@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  CaseRecord - Local Server
echo  URL: http://localhost:8080/
echo  Close this window to stop the server.
echo ============================================
start "" "http://localhost:8080/"
python -m http.server -d app 8080
pause
