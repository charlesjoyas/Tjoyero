@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE_BIN=node"
where node >nul 2>&1
if errorlevel 1 set "NODE_BIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_BIN%" if not "%NODE_BIN%"=="node" (
  echo No se encontro un ejecutable de Node.js.
  pause
  exit /b 1
)

"%NODE_BIN%" -e "if(Number(process.versions.node.split('.')[0])<24){console.error('Se requiere Node.js 24 o superior.');process.exit(1)};require('node:sqlite')"
if errorlevel 1 (
  echo Actualiza Node.js a la versión 24 o superior antes de continuar.
  pause
  exit /b 1
)

echo ====================================================
echo   Iniciando Áurea Taller en Localhost...
echo   Abre: http://127.0.0.1:4183
echo   Conserva esta ventana abierta. Ctrl+C para detener.
echo ====================================================

powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:4183/api/session' -TimeoutSec 2; if($null -ne $r.setupRequired) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
  start "" http://127.0.0.1:4183
  exit /b 0
)

start "" http://127.0.0.1:4183
"%NODE_BIN%" server.cjs
pause
