# nodehub CLI

`nodehub.cmd` (at the repository root) reads and records machine history through the nodehub API.
Claude Code uses it during [helpdesk sessions](helpdesk-sessions.md); technicians can use it too.

The CLI is built together with the backend (`start.cmd` or `npm run build` in `backend/`).

## Signing in

The CLI authenticates with a **personal access token**, so everything it records is attributed to
you.

1. In the dashboard: **Access tokens → Create token** (e.g. *Office laptop*). Copy the token
   (`nhk_...`); it's shown only once.
2. In the nodehub folder:
   ```powershell
   .\nodehub.cmd login
   ```
   Paste the token when asked. To point at another server: `--url http://host:8737`.

The token is saved in `%APPDATA%\nodehub\cli.json`. `.\nodehub.cmd logout` deletes it.

## Commands

| Command | Description |
|---|---|
| `login [--token nhk_...] [--url URL]` | Save and check an access token |
| `logout` | Forget the token on this PC |
| `whoami` | Show who the CLI is signed in as |
| `machine <host> [--json]` | Client, SSH user, notes, profile and the 10 latest sessions |
| `history <host> [--limit 50] [--json]` | Session history of a machine |
| `log <host> --file session.json` | Record a session from a JSON file |
| `log <host> --summary "..." --result fixed [--problem ...] [--diagnosis ...] [--actions ...] [--pending ...]` | Record a session from flags |
| `profile <host> --file profile.md` | Replace the machine profile (Markdown) |
| `profile <host> --text "..."` | Same, from text |

### Session JSON

```json
{
  "summary"  : "Disk almost full",
  "problem"  : "PC very slow since yesterday",
  "diagnosis": "C: at 98%: 40 GB of Windows Update cache and temp files",
  "actions"  : "Cleaned the update cache and temp files (approved by the technician)",
  "result"   : "fixed",
  "pending"  : ""
}
```

| Field | Required | Notes |
|---|---|---|
| `summary` | yes | One line, up to 200 characters |
| `result` | yes | `fixed`, `partial` or `unresolved` |
| `problem`, `diagnosis`, `actions`, `pending` | no | Up to 10,000 characters each |

Sessions can only be recorded for machines that are configured in the dashboard.

### Example

```text
> .\nodehub.cmd machine srv-bakery
# srv-bakery

Client:   Silva Bakery
SSH user: nodehub
Notes:    Back office server

## Profile

- **Role:** server (file shares, accounting software)
- **OS:** Windows Server 2022
- **Quirks:** backup job runs at 13:00, the machine is slow then

## Recent sessions (1 of 1)

### 2026-11-20 10:12: Disk almost full
- Technician: Ana Costa
- Problem: PC very slow since yesterday
- Diagnosis: C: at 98%: 40 GB of Windows Update cache and temp files
- Actions: Cleaned the update cache and temp files
- Result: fixed
```

## Errors

| Message | Fix |
|---|---|
| *Not signed in* | Run `.\nodehub.cmd login` |
| *Token rejected* | The token was revoked or your user deactivated: create a new token |
| *Cannot reach nodehub* | Start the dashboard (`start.cmd`) or check `--url` |
| *Machine ... is not configured* | Configure the machine in the dashboard first |
| *The nodehub CLI is not built yet* | Run `start.cmd` or `npm run build` in `backend/` |
