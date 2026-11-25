# Architecture

## Components

```mermaid
flowchart TB
  subgraph PC["Technician's PC"]
    direction TB
    B["Browser<br/>dashboard (React)"]
    BE["Backend<br/>Express + TypeScript<br/>127.0.0.1:8737"]
    DB[("PostgreSQL<br/>Docker, 127.0.0.1:5433")]
    TS["Tailscale client"]
    L["Launcher<br/>launcher/open.ps1"]
    CC["Claude Code<br/>+ CLAUDE.md"]
    CLI["nodehub CLI<br/>nodehub.cmd"]
    B -- "REST /api (JWT)" --> BE
    BE --> DB
    BE -- "tailscale status --json" --> TS
    B -- "nodehub:// link" --> L
    L -- "checks host + tag" --> TS
    L --> CC
    CC --> CLI
    CLI -- "REST /api (access token)" --> BE
  end
  CC == "ssh nodehub@host<br/>(over the tailnet)" ==> CM["Client machine<br/>Tailscale + OpenSSH<br/>user nodehub"]
```

| Component | Location | Role |
|---|---|---|
| **Backend** | `backend/` | REST API, authentication, business rules; serves the built dashboard on the same origin. |
| **Dashboard** | `frontend/` | React single-page app: machines, history, users, tokens. |
| **Database** | `docker-compose.yml` | PostgreSQL 17 with Prisma migrations (`backend/prisma/`). |
| **Tailscale** | technician PC | Source of truth for which machines exist and whether they're online. No Tailscale API token is needed. |
| **Launcher** | `launcher/` | Handles `nodehub://` links: validates them and opens Claude Code with the machine context. |
| **CLI** | `backend/src/cli/` → `nodehub.cmd` | Lets Claude (and technicians) read profiles/history and record sessions. |
| **Installer** | `installer/` | Template of the script that prepares client PCs; the backend fills in the secrets. |
| **Claude rules** | `CLAUDE.md` | How Claude runs a helpdesk session and what it may do. |

## Data model

```mermaid
erDiagram
  users ||--o{ api_tokens : owns
  users |o--o{ sessions : "recorded by"
  clients ||--o{ machines : has
  machines ||..o{ sessions : "host (no FK)"

  users {
    int id PK
    string username UK
    string name
    string password_hash "scrypt"
    enum role "ADMIN | TECHNICIAN"
    bool active
  }
  api_tokens {
    int id PK
    int user_id FK
    string name
    string prefix
    string token_hash UK "SHA-256"
    datetime last_used_at
  }
  clients {
    int id PK
    string name UK
    string notes
  }
  machines {
    string host PK "unique tailnet name"
    int client_id FK
    string ssh_user
    string notes
    string profile "Markdown"
  }
  sessions {
    int id PK
    string host
    int technician_id FK "SET NULL on user delete"
    string summary
    string problem
    string diagnosis
    string actions
    enum result "FIXED | PARTIAL | UNRESOLVED"
    string pending
    datetime created_at
  }
```

Design choices:

- **Live state is not stored.** Online/offline, IP, OS and last seen come from Tailscale on every
  request, so they're never stale.
- **Machines are keyed by their tailnet name** (first label of the MagicDNS name), which is unique
  even if two clients both have a PC called `SERVIDOR`.
- **Sessions reference the machine by host, not by foreign key**, so removing a machine from the
  dashboard keeps its history; it reappears if the machine is configured again.
- **Clients are matched case-insensitively** when configuring a machine, so "silva bakery" reuses
  "Silva Bakery".
- **Deleting a user keeps their sessions**, with the technician set to null ("deleted user").

## Flows

### Adding a machine

```mermaid
sequenceDiagram
  actor T as Technician
  participant D as Dashboard
  participant B as Backend
  participant P as Client PC
  participant TS as Tailscale
  T->>D: + Add machine → Download installer
  D->>B: GET /api/installer
  B-->>D: script with auth key, SSH keys, client tag
  T->>P: Run with PowerShell
  P->>TS: join tailnet (auth key applies the client tag)
  P->>P: create nodehub user, OpenSSH, firewall rule, self-delete
  D->>B: GET /api/machines (every 30 s)
  B->>TS: tailscale status --json
  B-->>D: new machine, unassigned
  T->>D: Configure → client
  D->>B: PUT /api/machines/:host (checks it's in the tailnet with the tag)
```

### Opening a session

1. The dashboard builds `nodehub://open?host=…&client=…&user=…`.
2. Windows runs `launcher/open.ps1` with the link.
3. The launcher validates every value **and checks with the local Tailscale client that the host
   exists and carries `CLIENT_TAG`**: a link from an arbitrary web page can't point Claude at
   another machine.
4. It opens Windows Terminal in the repository with `claude "<start message>"`.
5. Claude follows `CLAUDE.md`: `nodehub machine <host>`, SSH, diagnosis, record.

### Authentication

| Credential | Created by | Used by | Lifetime | Can manage users/tokens/password |
|---|---|---|---|---|
| **Dashboard session** (JWT) | `POST /api/auth/login` | Browser | `JWT_EXPIRES_IN` (12 h) | Yes (by role) |
| **Access token** (`nhk_…`) | Dashboard → Access tokens | CLI / Claude | Until revoked | **No** |

Both are sent as `Authorization: Bearer …`. Every request reloads the user, so deactivating a user
cuts all their credentials immediately.

## Backend layering

Following [fullstack-ts-standards](https://github.com/MiguelSousa369/fullstack-ts-standards):

```
routes/       HTTP method + path → controller (+ middlewares). No logic.
controllers/  Parse input with Zod, call a service, shape the response.
services/     Business rules and data access (Prisma, Tailscale, ssh).
schemas/      Zod schemas + inferred types: one source of truth for validation and types.
middlewares/  authGuard, sessionOnly, requireRole, localHostOnly, errorMiddleware.
lib/          Singletons/clients: prisma, tailscale, swagger.
utils/        Stateless helpers: logger, password hashing, HttpError.
docs/         OpenAPI YAML, one file per resource, merged at runtime.
cli/          The nodehub CLI.
```
