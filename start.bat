@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  CaseRecord - Local Server (no cache)
echo  URL: http://localhost:8081/
echo  Close this window to stop the server.
echo ============================================
start "" "http://localhost:8081/"
python server.py
pause
