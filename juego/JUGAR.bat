@echo off
cd /d "%~dp0"
echo Iniciando servidor del juego...
start "" /min cmd /c "node server.js"
timeout /t 1 /nobreak >nul
start "" http://localhost:8123/index.html
