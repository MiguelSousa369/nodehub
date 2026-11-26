# API

The backend exposes a REST API under `/api`. The interactive reference (Swagger UI) is at
**http://127.0.0.1:8737/api/docs**; the OpenAPI source is in
[`backend/src/docs/`](../backend/src/docs/).

## Authentication

Send `Authorization: Bearer <token>` with either:

- a **dashboard session** token from `POST /api/auth/login` (expires after `JWT_EXPIRES_IN`), or
- a **PC token** (`nhk_…`), issued to a PC by the browser authorisation flow (`/api/cli-login`).

Routes marked *session* reject PC tokens with `403 SESSION_REQUIRED`. Each connected PC has its own
token.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | – | Health check |
| **Auth** | | | |
| `POST` | `/api/auth/login` | – | `{ username, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | any | Current user |
| `POST` | `/api/auth/password` | session | `{ currentPassword, newPassword }` → `{ token }`; signs out your other sessions |
| **Connecting a PC** (`nodehub login`) | | | |
| `POST` | `/api/cli-login` | – | `{ deviceName }` → `{ deviceCode, userCode, expiresIn, interval }` |
| `POST` | `/api/cli-login/poll` | – | `{ deviceCode }` → `202` pending, `200` `{ token, user }` once approved |
| `GET` | `/api/cli-login/:userCode` | session | Show a request (dashboard `/connect` page) |
| `POST` | `/api/cli-login/:userCode/approve` | session | Connect the PC to your account |
| `POST` | `/api/cli-login/:userCode/deny` | session | Deny the request |
| **Connected PCs** | | | |
| `GET` | `/api/tokens` | session | Your connected PCs (without the secret) |
| `DELETE` | `/api/tokens/:id` | session | Disconnect one of your PCs |
| **Users** | | | |
| `GET` | `/api/users` | session, admin | List users |
| `POST` | `/api/users` | session, admin | `{ username, name, password, role }` |
| `PATCH` | `/api/users/:id` | session, admin | `{ name?, password?, role?, active? }` |
| `DELETE` | `/api/users/:id` | session, admin | Delete a user (their sessions are kept) |
| **Machines** | | | |
| `GET` | `/api/machines` | any | Client machines (Tailscale + configuration) and known clients |
| `GET` | `/api/machines/:host` | any | Configuration, profile, 10 latest sessions |
| `PUT` | `/api/machines/:host` | session | Configure / edit `{ client, sshUser?, notes? }` |
| `DELETE` | `/api/machines/:host` | session | Remove the configuration (history is kept) |
| `PUT` | `/api/machines/:host/profile` | any | `{ profile }` (Markdown) |
| `POST` | `/api/machines/:host/ssh-test` | session | `{ sshUser? }` → `{ ok, message }` |
| **Sessions** | | | |
| `GET` | `/api/sessions` | any | All sessions; filters `host`, `technicianId`, `result`, `q`, `limit`, `offset` |
| `GET` | `/api/sessions/technicians` | any | Users who recorded at least one session (history filter) |
| `GET` | `/api/machines/:host/sessions` | any | Sessions of one machine (`limit`, `offset`) |
| `POST` | `/api/machines/:host/sessions` | any | Record a session as the caller |
| **Installer** | | | |
| `GET` | `/api/installer/status` | session | `{ ready, missing[] }` |
| `GET` | `/api/installer` | session | Download `nodehub-install.ps1` (contains the Tailscale auth key) |

## Errors

Every error has the same shape; branch on `code`, not on the message:

```json
{ "error": "Human-readable message.", "code": "MACHINE_READABLE_CODE", "details": [] }
```

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid body, params or query (Zod issues in `details`) |
| `INVALID_JSON` | 400 | Malformed JSON body |
| `WRONG_PASSWORD` | 400 | Current password is wrong when changing it |
| `UNAUTHORIZED` | 401 | No token, expired session, revoked token or deactivated user |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `FORBIDDEN` | 403 | Admin-only action |
| `SESSION_REQUIRED` | 403 | Action reserved for the dashboard (account, users, machine list, installer) attempted with a PC token |
| `LOGIN_DENIED` | 403 | The PC connection request was denied |
| `FORBIDDEN_HOST` | 403 | Request not addressed to `127.0.0.1`/`localhost` |
| `TOO_MANY_ATTEMPTS` | 429 | 5 wrong passwords for this username in 15 minutes: wait and try again |
| `FORBIDDEN_ORIGIN` | 403 | Request sent by a page from another site (its `Origin` is not `127.0.0.1`/`localhost`) |
| `NOT_FOUND` | 404 | Unknown route, or machine/user/connected PC not found |
| `LOGIN_NOT_FOUND` | 404 | Unknown or expired PC connection request (dashboard) |
| `MACHINE_NOT_IN_TAILNET` | 404 | Configuring a machine that isn't in the tailnet with `CLIENT_TAG` |
| `MACHINE_NOT_CONFIGURED` | 404 | Recording a session or profile for an unconfigured machine |
| `USERNAME_TAKEN` | 409 | Username already exists |
| `LAST_ADMIN` | 409 | The change would leave no active admin |
| `CANNOT_DEMOTE_SELF` | 409 | Removing your own admin access |
| `CANNOT_DELETE_SELF` | 409 | Deleting your own account |
| `LOGIN_ALREADY_DECIDED` | 409 | The PC connection request was already approved or denied |
| `INSTALLER_NOT_CONFIGURED` | 409 | Missing auth key, public keys or client tag |
| `LOGIN_EXPIRED` | 410 | PC connection request expired, unknown, or token already collected (CLI) |
| `TOO_MANY_REQUESTS` | 429 | Too many pending PC connection requests |
| `TAILSCALE_UNAVAILABLE` | 503 | Tailscale status couldn't be read |
| `INTERNAL_ERROR` | 500 | Anything else |
