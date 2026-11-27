# Configuration

All settings live in **`backend/.env`** (copy it from [`backend/.env.example`](../backend/.env.example)).
This file holds secrets and is never committed.

## Required

| Setting | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://nodehub:nodehub@127.0.0.1:5433/nodehub` | PostgreSQL connection. The default matches `docker-compose.yml`. |
| `JWT_SECRET` | 96 hex characters | Signs dashboard sign-in tokens (HS256). At least 32 characters, or the backend refuses to start. Changing it signs everyone out. |

## Tailscale and the client installer

| Setting | Default | Description |
|---|---|---|
| `CLIENT_TAG` | `tag:client` | Tag that marks client machines. Must match the ACL and the auth key. Only machines with this tag can be configured or opened. |
| `TAILSCALE_AUTHKEY` | – | Reusable, pre-approved auth key tagged with `CLIENT_TAG`. Needed to download the installer. |
| `TAILSCALE_BIN` | `C:\Program Files\Tailscale\tailscale.exe` | Tailscale CLI used to read machine status. |

## Accounts

| Setting | Default | Description |
|---|---|---|
| `JWT_EXPIRES_IN` | `12h` | How long a dashboard sign-in lasts (`8h`, `7d`, ...). Connected PCs don't expire; disconnect them instead. |
| `ADMIN_USERNAME` | `admin` | First admin, created by `npm run seed` only when there are no users. |
| `ADMIN_PASSWORD` | random, printed once | Password of that first admin. Remove it from the file after signing in. |

## Team language

Not in `.env`: an admin sets it in the dashboard (**Users → Team settings**), stored in the database
(`settings` table). English by default. See [usage.md → Language](usage.md#language-english-or-portuguese).

## Server

| Setting | Default | Description |
|---|---|---|
| `PORT` | `8737` | HTTP port of the backend and dashboard. |
| `HOST` | `127.0.0.1` | Interface to listen on. `127.0.0.1`: only this PC. `0.0.0.0`: the office network (with `ALLOWED_HOSTS`, see [Mode B: office server](installation.md#5-mode-b-office-server)). |
| `ALLOWED_HOSTS` | – | Comma-separated addresses the team opens nodehub at, besides `localhost` (office server), e.g. `192.168.1.50,nodehub-srv`. Requests to other addresses get `FORBIDDEN_HOST`. |
| `LOG_LEVEL` | `info` | Winston level (`error`, `warn`, `info`, `debug`). Logs go to `backend/logs/`. |

## Paths

| Setting | Default | Description |
|---|---|---|
| `PUBLIC_KEYS_DIR` | `../public-keys` | Folder whose `*.pub` files are imported into the database at startup (keys are managed in the dashboard). |
| `INSTALLER_TEMPLATE` | `../installer/install-client.ps1` | Installer template. |
| `FRONTEND_DIST` | `../frontend/dist` | Built dashboard served at `/`. |
| `DATABASE_URL_TEST` | `DATABASE_URL` with database `nodehub_test` | Database used by `npm test`. |

## Database container

`docker-compose.yml` reads two optional variables from the environment (or a `.env` file next to
it):

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `nodehub` | Password of the `nodehub` database user. If you change it, update `DATABASE_URL`. |
| `POSTGRES_PORT` | `5433` | Port on `127.0.0.1`. |

The database only listens on `127.0.0.1`.
