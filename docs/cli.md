# nodehub CLI

`nodehub.cmd` (at the repository root) reads and records machine history through the nodehub API.
Claude Code uses it during [helpdesk sessions](helpdesk-sessions.md); technicians can use it too.

The CLI is built together with the backend (`start.cmd` or `npm run build` in `backend/`).

## Connecting a PC

Each PC is connected to a nodehub account once, by approving it in the browser (like
`gh auth login`). Everything the CLI records on that PC is attributed to that account.

**Usually you don't do anything:** the first time you click **Open in Claude** on a PC, the launcher
runs `nodehub login` for you.

By hand:

```powershell
.\nodehub.cmd login
```

```text
Connecting "MIGUEL-LAPTOP" to nodehub.

  Approve it in the browser: http://127.0.0.1:8737/connect?code=WDJB-MJHT
  Code: WDJB-MJHT

Waiting for approval... (Ctrl+C to cancel)

Connected. This PC now works as Miguel Sousa (miguel.sousa).
```

1. The browser opens the dashboard (sign in if needed) on **Connect this PC?**
2. Check that the code matches the terminal and click **Approve**.
3. The CLI receives a token for this PC and saves it in `%APPDATA%\nodehub\cli.json`.

The request expires after 10 minutes. Connecting the same PC again replaces its previous token.
Options: `--url http://host:8737` (another server), `--name PC-NAME` (default: the computer name),
`--no-browser` (just print the link).

To disconnect a PC, use **Connected PCs** in the dashboard. `.\nodehub.cmd logout` only makes this
PC forget its token.

## Commands

| Command | Description |
|---|---|
| `login [--url URL] [--name PC-NAME] [--no-browser]` | Connect this PC (approve it in the browser) |
| `logout` | Forget this PC's token (disconnect it in the dashboard to revoke it) |
| `whoami [--quiet]` | Show which account this PC is connected as (`--quiet`: exit code only) |
| `machine <host> [--json]` | Client, SSH user, notes, profile and the 10 latest sessions |
| `history <host> [--limit 50] [--json]` | Session history of a machine |
| `log <host> --file session.json` | Record a session from a JSON file |
| `log <host> --summary "..." --result fixed [--problem ...] [--diagnosis ...] [--actions ...] [--pending ...]` | Record a session from flags |
| `update <id> --file changes.json` | Correct a recorded session: only the fields in the file change, e.g. `{"pending": "", "result": "fixed"}` |
| `update <id> --pending "" --result fixed` | The same with flags |
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

## Using a nodehub server

On a technician PC that uses a [shared server](server.md), only the CLI is needed:
`npm install` and `npm run build:cli` in `backend\`, then
`.\nodehub.cmd login --url http://<server-ip>:8737`. The address is remembered.

## Language

The CLI prints its messages in the **team language** (English or Portuguese), chosen by an admin in
the dashboard (**Users → Team settings**). `nodehub machine` starts with a *Records language* line:
Claude writes session records and profiles in that language. JSON keys and `result` values
(`fixed`, `partial`, `unresolved`) are always in English.

## Errors

| Message | Fix |
|---|---|
| *This PC is not connected* | Run `.\nodehub.cmd login` and approve it in the browser |
| *This PC was disconnected* | It was disconnected in the dashboard or your user deactivated: run `.\nodehub.cmd login` again |
| *The connection request expired* / *was denied* | Run `.\nodehub.cmd login` again and approve within 10 minutes |
| *Cannot reach nodehub* | Start the dashboard (`start.cmd`) or check `--url` |
| *Machine ... is not configured* | Configure the machine in the dashboard first |
| *The nodehub CLI is not built yet* | Run `start.cmd` or `npm run build` in `backend/` |
