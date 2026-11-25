# Troubleshooting

## Starting nodehub

| Symptom | Cause / fix |
|---|---|
| `start.cmd`: *Something failed (is Docker Desktop running?)* | Start Docker Desktop and wait until it says *running*, then retry. |
| *backend\.env is missing* | `copy backend\.env.example backend\.env` and fill it in ([configuration](configuration.md)). |
| *JWT_SECRET is not set* | Set `JWT_SECRET` in `backend\.env`. |
| Port 8737 or 5433 already in use | Change `PORT` in `backend\.env`, or `POSTGRES_PORT` (and `DATABASE_URL`). |
| Lost the first admin password | `docker exec -it nodehub-db psql -U nodehub -c "DELETE FROM users;"`, set `ADMIN_PASSWORD` in `.env` and run `npm run seed` in `backend\`. Only do this before other users exist. |

## Dashboard

| Symptom | Cause / fix |
|---|---|
| *Could not read Tailscale status* | Tailscale isn't running or signed in on this PC. Check `tailscale status`. Set `TAILSCALE_BIN` if it's installed elsewhere. |
| A new machine doesn't appear | It needs the client tag: check the auth key has `CLIENT_TAG`, and that `CLIENT_TAG` in `.env` matches. In the Tailscale console, check the device and its tags. |
| *Download installer* is disabled | The dialog lists what's missing: `TAILSCALE_AUTHKEY`, a key in `public-keys/`, or a valid `CLIENT_TAG`. |
| *Open in Claude* does nothing | Register the protocol: `.\launcher\register-protocol.ps1`. Allow the browser's "open nodehub?" prompt. |
| *Machine … is not a client machine in the tailnet* (launcher) | The machine lost its tag or left the tailnet, or `CLIENT_TAG` in `.env` differs from the real tag. |
| Signed out unexpectedly | The session expired (`JWT_EXPIRES_IN`) or an admin deactivated your account. |

## SSH

| Symptom | Cause / fix |
|---|---|
| *Test SSH*: `Permission denied (publickey…)` | Your public key isn't on the machine: add it to `public-keys/` and re-run the installer there. Check the SSH user (`nodehub`). |
| *Test SSH*: timeout | Machine offline, or `sshd` stopped, or the firewall rule missing. Check the machine in the Tailscale console. |
| `Host key verification failed` | The machine was reinstalled. Remove its line from `%USERPROFILE%\.ssh\known_hosts` (`ssh-keygen -R <host>`). |
| Warning about *post-quantum key exchange* | Harmless: the client PC has an older OpenSSH. |

## Client installer

See [client-installer.md → Requirements and known limitations](client-installer.md#requirements-and-known-limitations).
The log on the client PC is `C:\ProgramData\nodehub\install.log`.

| Symptom | Cause / fix |
|---|---|
| *Could not install OpenSSH Server through Windows Update* | Windows Update is blocked/WSUS. Allow it temporarily or install Win32-OpenSSH manually, then re-run. |
| *tailscale up failed* | Auth key expired or revoked (generate a new one and update `.env`), or the PC is signed in to another tailnet. |
| The machine kept its old name | Expected: if it was already on the tailnet with the client tag, the installer leaves Tailscale untouched. |

## CLI

See [cli.md → Errors](cli.md#errors).

## Tests

| Symptom | Cause / fix |
|---|---|
| `database "nodehub_test" does not exist` | Create it once: see [development.md → Tests](development.md#tests). |
| *Refusing to run tests against …* | The test database must be named `nodehub_test`, or set `DATABASE_URL_TEST` explicitly. |
