# Troubleshooting

## Starting nodehub

| Symptom | Cause / fix |
|---|---|
| `start.cmd`: *Something failed (is Docker Desktop running?)* | Start Docker Desktop and wait until it says *running*, then retry. |
| *backend\.env is missing* | `copy backend\.env.example backend\.env` and fill it in ([configuration](configuration.md)). |
| *JWT_SECRET must be at least 32 characters* | Set a long random `JWT_SECRET` in `backend\.env` (the command is in `.env.example`). |
| *Forbidden host* when opening the server's IP | Add that IP (or name) to `ALLOWED_HOSTS` in the server's `backend\.env` and restart ([server.md](server.md)). |
| Other PCs can't open the server's dashboard | `HOST=0.0.0.0` in `backend\.env`, the firewall rule for port 8737 ([server.md](server.md)), and the server's IP hasn't changed. |
| Port 8737 or 5433 already in use | Change `PORT` in `backend\.env`, or `POSTGRES_PORT` (and `DATABASE_URL`). |
| Lost the first admin password | `docker exec -it nodehub-db psql -U nodehub -c "DELETE FROM users;"`, set `ADMIN_PASSWORD` in `.env` and run `npm run seed` in `backend\`. Only do this before other users exist. |

## Dashboard

| Symptom | Cause / fix |
|---|---|
| *Could not read Tailscale status* | Tailscale isn't running or signed in on this PC. Check `tailscale status`. Set `TAILSCALE_BIN` if it's installed elsewhere. |
| A new machine doesn't appear | It needs the client tag: check the auth key has `CLIENT_TAG`, and that `CLIENT_TAG` in `.env` matches. In the Tailscale console, check the device and its tags. |
| *Download installer* is disabled | The dialog lists what's missing: `TAILSCALE_AUTHKEY`, at least one active SSH key (**My SSH keys**), or a valid `CLIENT_TAG`. |
| *Open in Claude* does nothing | Register the protocol: `.\launcher\register-protocol.ps1`. Allow the browser's "open nodehub?" prompt. |
| *Machine … is not a client machine in the tailnet* (launcher) | The machine lost its tag or left the tailnet, or `CLIENT_TAG` in `.env` differs from the real tag. |
| Signed out unexpectedly | The session expired (`JWT_EXPIRES_IN`) or an admin deactivated your account. |

## SSH

| Symptom | Cause / fix |
|---|---|
| *Test SSH*: `Permission denied (publickey…)` | The key isn't on the machine: add it in **My SSH keys** and **Sync keys** (from a PC that has access). On a server, *Test SSH* uses the server's own key: add it as a service key. Check the SSH user (`nodehub`). |
| **Sync keys** does nothing | The `nodehub://` protocol isn't registered on this PC (`.\launcher\register-protocol.ps1`) or the CLI isn't built (`npm run build:cli` in `backend\`). |
| Sync: *None of this PC's keys is in the team list* | Add this PC's key (`%USERPROFILE%\.ssh\*.pub`) in **My SSH keys** first, so the sync doesn't lock this PC out. |
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

## CLI and connecting a PC

| Symptom | Cause / fix |
|---|---|
| *Open in Claude* opens a "connect this PC" window every time | The approval wasn't completed, or the PC was disconnected. Approve it in the browser tab that opens. |
| The browser tab doesn't open during `nodehub login` | Open the link printed in the terminal by hand. |
| Approved, but the terminal still waits | It checks every 2 seconds; if it keeps waiting, the request expired: run `.\nodehub.cmd login` again. |

More: [cli.md → Errors](cli.md#errors).

## Tests

| Symptom | Cause / fix |
|---|---|
| `database "nodehub_test" does not exist` | Create it once: see [development.md → Tests](development.md#tests). |
| *Refusing to run tests against …* | The test database must be named `nodehub_test`, or set `DATABASE_URL_TEST` explicitly. |
