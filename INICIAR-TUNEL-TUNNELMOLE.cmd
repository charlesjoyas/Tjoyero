@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================================
echo   Iniciando Tunel Tunnelmole para Áurea Taller (4183)
echo ====================================================
powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:4183/api/session' -TimeoutSec 2; if($r.setupRequired -eq $false) { exit 0 } } catch {}; exit 1" >nul 2>&1
if errorlevel 1 (
  echo Inicia el taller y configura al administrador antes de compartir el acceso.
  pause
  exit /b 1
)
if exist "data\tunnel-client\node_modules\tunnelmole\dist\bin\tunnelmole.js" (
  set "NODE_BIN=node"
  where node >nul 2>&1
  if errorlevel 1 set "NODE_BIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
) else (
  tmole.exe 4183
  pause
  exit /b
)

"%NODE_BIN%" "data\tunnel-client\node_modules\tunnelmole\dist\bin\tunnelmole.js" 4183
pause
