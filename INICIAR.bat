@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22 ou superior para iniciar o jogo localmente.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo A pasta dist nao existe. Rode: npm ci ^&^& npm run build
  pause
  exit /b 1
)
node scripts\serve-dist.mjs
pause
