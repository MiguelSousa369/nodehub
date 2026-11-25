# nodehub

A central dashboard of all client PCs connected through **Tailscale**, organised by client, from which you do **remote helpdesk with Claude Code**: diagnostics, troubleshooting and malware checks, without the client having to do anything.

---

## The idea

Client PCs join our private Tailscale network with an SSH server that only accepts our keys. That gives us direct, secure access to every machine, with no ports open to the internet.

nodehub uses that access for two things:

1. **See everything organised:** a dashboard with every machine, grouped by client, with its status.
2. **Act with Claude Code:** pick a machine in the dashboard and Claude Code connects to it over SSH to diagnose and fix the problem.

```
 Technician's PC                                           Client PCs
 ┌──────────────────────────────┐                          ┌───────────────────────┐
 │ nodehub (dashboard)          │                          │ Client A              │
 │   machine list               │                          │   srv-a   ● online    │
 │   [Open in Claude] [Copy]    │                          │   pc1     ● online    │
 │            │                 │                          ├───────────────────────┤
 │            ▼                 │   tailnet (WireGuard)    │ Client B              │
 │ Claude Code ── ssh ──────────┼═════════════════════════▶│   srv-b   ○ offline   │
 │                              │   no open ports          │   ...                 │
 └──────────────────────────────┘                          └───────────────────────┘
```

### Connecting to Claude Code

Each configured machine has two buttons:

- **Open in Claude**: a `nodehub://open?host=<machine>` link, registered in Windows, opens a terminal with Claude Code already working on that machine.
- **Copy**: copies a ready-made prompt to paste into any Claude Code session opened in this folder.

The dashboard only identifies the machine. What Claude needs to know to work lives in the repository: [`CLAUDE.md`](CLAUDE.md) (helpdesk rules: how to connect, what it may do alone, when to ask, how to log) and `clients/<Client>/<host>.md` (each machine's history).

---

## Stack

Follows [`fullstack-ts-standards`](https://github.com/MiguelSousa369/fullstack-ts-standards):

| Part | Tech |
|---|---|
| `backend/` | Node.js, Express, TypeScript, Zod, Winston, Swagger (`/api/docs`), helmet, cors |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS |
| Data | JSON file store: `backend/data/machines/<host>/entity.json` |
| Auth | Static API key (`Authorization: Bearer <API_KEY>`) |
| Machine status | Local Tailscale client (`tailscale status --json`); no Tailscale API token needed |

The backend serves the built dashboard on the same origin: **http://127.0.0.1:8737**.

---

## Setup (technician's PC)

**Requirements:** Node.js 20+, Tailscale (logged in to the support tailnet), Claude Code, an SSH key accepted on the client machines.

1. **Backend config:** copy `backend/.env.example` to `backend/.env` and fill in:
   - `API_KEY`: any long random string (the dashboard asks for it once).
   - `TAILSCALE_AUTHKEY`: in the Tailscale console (**Settings → Keys → Generate auth key**), a **reusable**, **pre-approved** key tagged **`tag:cliente`**.
2. **SSH public keys:** each technician's key in `public-keys/<name>.pub`.
3. **`nodehub://` protocol** (once, no admin needed):
   ```powershell
   .\launcher\register-protocol.ps1
   ```
4. **Start:** double-click `start.cmd` (installs dependencies the first time, builds and opens the dashboard).

Development: `npm run dev` in `backend/` and in `frontend/` (Vite on http://127.0.0.1:5173, proxying `/api`).

---

## Adding a machine

1. In the dashboard: **+ Add machine → Download installer**. The file already contains the Tailscale auth key and the SSH keys.
2. On the client PC: **right-click → Run with PowerShell** and accept the administrator prompt. Nothing needs to be typed. The installer:
   - installs Tailscale and joins the tailnet with `tag:cliente` (left untouched if the machine is already on it);
   - creates the local user **`nodehub`** (administrator, hidden from the sign-in screen, no known password);
   - installs OpenSSH Server, key authentication only;
   - limits SSH to the Tailscale network in the firewall (`nodehub-SSH` rule);
   - deletes itself and leaves a log in `C:\ProgramData\nodehub\install.log`.
3. The machine shows up on its own under **Unassigned**. Click **Configure**, pick the client (or type a new one) and **Save**.

To change or drop a machine: **⋯ → Edit / Remove**.

Machines are identified by their unique tailnet name: two clients can both have a PC called "SERVIDOR"; Tailscale tells them apart.

---

## API

Documented with Swagger at **http://127.0.0.1:8737/api/docs**.

| Method | Path | |
|---|---|---|
| `GET` | `/api/health` | Health check (no auth) |
| `GET` | `/api/machines` | Machines (Tailscale + configuration), known clients |
| `PUT` | `/api/machines/:host` | Configure / edit `{ client, sshUser, notes }` |
| `DELETE` | `/api/machines/:host` | Remove the configuration |
| `POST` | `/api/machines/:host/ssh-test` | Test SSH `{ sshUser }` |
| `GET` | `/api/installer/status` | Whether the installer can be generated |
| `GET` | `/api/installer` | Download the client installer |

Errors always use `{ "error": "...", "code": "...", "details": [...] }`:

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid body or params (Zod issues in `details`) |
| `INVALID_JSON` | 400 | Malformed JSON body |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN_HOST` | 403 | Request not addressed to localhost |
| `NOT_FOUND` | 404 | Unknown route or machine not configured |
| `MACHINE_NOT_IN_TAILNET` | 404 | Machine not in the tailnet with `tag:cliente` |
| `INSTALLER_NOT_CONFIGURED` | 409 | Missing auth key or public keys |
| `TAILSCALE_UNAVAILABLE` | 503 | Could not read Tailscale status |
| `INTERNAL_ERROR` | 500 | Anything else |

Tests: `npm test` in `backend/`.

---

## Structure

```
nodehub/
├── CLAUDE.md                   helpdesk rules for Claude Code
├── start.cmd                   builds and starts everything
├── backend/                    Express API (+ serves the built dashboard)
│   ├── src/                    routes → controllers → services → schemas, middlewares, lib, utils, docs
│   ├── tests/
│   ├── data/                   machine configuration store (gitignored)
│   └── .env.example
├── frontend/                   React dashboard
├── installer/
│   └── install-client.ps1      client installer template (the backend fills in the keys)
├── launcher/
│   ├── open.ps1                opens Claude Code connected to a machine
│   └── register-protocol.ps1   registers / removes (-Remove) the nodehub:// protocol
├── public-keys/                technicians' SSH public keys
└── clients/
    ├── _template.md            machine history template
    └── <Client>/<host>.md      profile and session history
```

---

## Security

- **Client isolation:** Tailscale ACLs only let the technicians' devices reach the client machines, and no client sees another.
- **SSH key only:** no passwords, and only from the Tailscale network.
- **Local-only dashboard:** listens on `127.0.0.1`, rejects requests addressed to any other host (DNS rebinding) and requires the API key.
- **Launcher input:** only simple machine names configured in the dashboard are accepted, because a `nodehub://` link can come from any web page.
- **Only tagged machines:** new machines can only be configured if they are in the tailnet with `tag:cliente`.
- **Session log:** every session is recorded in the client's folder.
- **Rules for Claude:** `CLAUDE.md` defines what it may do without asking and what needs the technician's confirmation.
- **No secrets in git:** `backend/.env` (API key, Tailscale auth key) and `backend/data/` stay out of the repository.

---

## To do

- [ ] **PostgreSQL database** (Prisma) instead of the JSON store.
- [ ] **Everything in containers** (Docker Compose: backend, frontend, Postgres). Notes:
  - a containerised backend can't see the PC's Tailscale: use the Tailscale API or a Tailscale sidecar container;
  - the `nodehub://` launcher and Claude Code keep running on the technician's PC.
- [ ] **Shared dashboard** for the whole team (follows from the above).
- [ ] **Client uninstaller**: remove the `nodehub` user, the keys and the firewall rule, and take the machine off the tailnet.
