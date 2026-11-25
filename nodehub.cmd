@echo off
rem nodehub CLI (see docs/cli.md). Requires the backend to be built: start.cmd or "npm run build" in backend\.
if not exist "%~dp0backend\dist\cli\nodehub.js" (
  echo The nodehub CLI is not built yet. Run start.cmd, or "npm run build" in backend\.
  exit /b 1
)
node "%~dp0backend\dist\cli\nodehub.js" %*
