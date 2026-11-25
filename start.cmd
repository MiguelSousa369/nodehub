@echo off
rem Builds and starts nodehub (backend + dashboard) on http://127.0.0.1:8737
cd /d "%~dp0"

if not exist backend\.env (
  echo backend\.env is missing. Copy backend\.env.example to backend\.env and fill in API_KEY.
  pause
  exit /b 1
)

if not exist backend\node_modules ( pushd backend & call npm install & popd )
if not exist frontend\node_modules ( pushd frontend & call npm install & popd )

pushd frontend & call npm run build || goto :error & popd
pushd backend  & call npm run build || goto :error

start "" http://127.0.0.1:8737
call npm start
popd
exit /b 0

:error
echo Build failed.
pause
exit /b 1
