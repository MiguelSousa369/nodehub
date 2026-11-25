@echo off
rem Starts the database, builds and starts nodehub (backend + dashboard) on http://127.0.0.1:8737
cd /d "%~dp0"

if not exist backend\.env (
  echo backend\.env is missing. Copy backend\.env.example to backend\.env and fill in JWT_SECRET.
  pause
  exit /b 1
)

echo Starting the database...
docker compose up -d --wait || goto :error

if not exist backend\node_modules ( pushd backend & call npm install & popd )
if not exist frontend\node_modules ( pushd frontend & call npm install & popd )

pushd backend
call npx prisma migrate deploy || goto :error
rem Creates the first admin only when there are no users yet (password printed once)
call npm run seed || goto :error
popd

pushd frontend & call npm run build || goto :error & popd
pushd backend  & call npm run build || goto :error

start "" http://127.0.0.1:8737
call npm start
popd
exit /b 0

:error
echo Something failed (is Docker Desktop running?).
pause
exit /b 1
