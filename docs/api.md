# API

The backend exposes a REST API under `/api`. The interactive reference (Swagger UI) is at
**http://127.0.0.1:8737/api/docs**; the OpenAPI source is in
[`backend/src/docs/`](../backend/src/docs/).

## Authentication

Send `Authorization: Bearer <token>` with either:

- a **dashboard session** token from `POST /api/auth/login` (expires after `JWT_EXPIRES_IN`), or
- a **personal access token** (`nhk_…`) created in the dashboard.

Routes marked *session* reject access tokens with `403 SESSION_REQUIRED`. Each user has at most
one access token.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | – | Health check |
| **Auth** | | | |
| `POST` | `/api/auth/login` | – | `{ username, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | any | Current user |
| `POST` | `/api/auth/password` | session | `{ currentPassword, newPassword }` |
| **Access token** | | | |
| `GET` | `/api/token` | session | Your token without the secret (`null` if none) |
| `POST` | `/api/token` | session | Generate your token, replacing the previous one; shown once |
| `DELETE` | `/api/token` | session | Revoke your token |
| **Users** | | | |
| `GET` | `/api/users` | session, admin | List users |
| `POST` | `/api/users` | session, admin | `{ username, name, password, role }` |
| `PATCH` | `/api/users/:id` | session, admin | `{ name?, password?, role?, active? }` |
| `DELETE` | `/api/users/:id` | session, admin | Delete a user (their sessions are kept) |
| **Machines** | | | |
| `GET` | `/api/machines` | any | Client machines (Tailscale + configuration) and known clients |
| `GET` | `/api/machines/:host` | any | Configuration, profile, 10 latest sessions |
| `PUT` | `/api/machines/:host` | any | Configure / edit `{ client, sshUser?, notes? }` |
| `DELETE` | `/api/machines/:host` | any | Remove the configuration (history is kept) |
| `PUT` | `/api/machines/:host/profile` | any | `{ profile }` (Markdown) |
| `POST` | `/api/machines/:host/ssh-test` | any | `{ sshUser? }` → `{ ok, message }` |
| **Sessions** | | | |
| `GET` | `/api/sessions` | any | All sessions; filters `host`, `technicianId`, `result`, `q`, `limit`, `offset` |
| `GET` | `/api/machines/:host/sessions` | any | Sessions of one machine (`limit`, `offset`) |
| `POST` | `/api/machines/:host/sessions` | any | Record a session as the caller |
| **Installer** | | | |
| `GET` | `/api/installer/status` | any | `{ ready, missing[] }` |
| `GET` | `/api/installer` | any | Download `nodehub-install.ps1` |

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
| `SESSION_REQUIRED` | 403 | Account-level action attempted with an access token |
| `FORBIDDEN_HOST` | 403 | Request not addressed to `127.0.0.1`/`localhost` |
| `NOT_FOUND` | 404 | Unknown route, machine/user not found, or no token to revoke |
| `MACHINE_NOT_IN_TAILNET` | 404 | Configuring a machine that isn't in the tailnet with `CLIENT_TAG` |
| `MACHINE_NOT_CONFIGURED` | 404 | Recording a session or profile for an unconfigured machine |
| `USERNAME_TAKEN` | 409 | Username already exists |
| `LAST_ADMIN` | 409 | The change would leave no active admin |
| `CANNOT_DEMOTE_SELF` | 409 | Removing your own admin access |
| `CANNOT_DELETE_SELF` | 409 | Deleting your own account |
| `INSTALLER_NOT_CONFIGURED` | 409 | Missing auth key, public keys or client tag |
| `TAILSCALE_UNAVAILABLE` | 503 | Tailscale status couldn't be read |
| `INTERNAL_ERROR` | 500 | Anything else |
