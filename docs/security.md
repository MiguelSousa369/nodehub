# Security

nodehub gives a small team administrator access to many client PCs. This page lists what it
protects against and how, and the responsibilities that stay with you.

## Network access to client machines

| Protection | How |
|---|---|
| **No open ports** | Client PCs are reached only through Tailscale (WireGuard). Nothing is exposed to the internet or to the client's LAN. |
| **Firewall** | The installer allows SSH (port 22) only from `100.64.0.0/10`, the Tailscale range. |
| **Tailscale ACL** | Only the team's devices can reach client machines, only on port 22. Clients can't reach the team or each other ([example ACL](tailscale-acl.example.hujson)). |
| **SSH key only** | Password authentication is disabled; only the technicians' public keys are accepted. |
| **Dedicated account** | Support uses the local `nodehub` user: no client passwords, clearly separated in the Windows logs, easy to remove. Its password is random and unknown, and it's hidden from the sign-in screen. |
| **Installer hygiene** | The installer contains the Tailscale auth key and deletes itself after running. The key is tagged, so a leaked key can only add machines *as clients*, which the ACL isolates. Use an expiry and rotate it. |

## The dashboard and API

| Protection | How |
|---|---|
| **Local by default** | The backend listens on `127.0.0.1`; PostgreSQL always does. On an [office server](installation.md#5-mode-b-office-server) it listens on the network, answering only at the addresses in `ALLOWED_HOSTS`, with the firewall rule limited to the local subnet. |
| **DNS rebinding** | Requests whose `Host` isn't `127.0.0.1`/`localhost` or one of `ALLOWED_HOSTS` are rejected. |
| **Other websites** | A page from another site, open in a technician's browser, can still send requests to nodehub's address. Every request with an `Origin` that isn't nodehub itself is refused (`FORBIDDEN_ORIGIN`), and there is no CORS: such a page can't sign in, guess passwords or read anything. |
| **Accounts** | Every technician has their own account. Passwords are hashed with scrypt (random salt). Login errors and response times don't reveal whether a username exists. |
| **Password guessing** | After 5 wrong passwords in 15 minutes, that username is locked for the rest of the 15 minutes; after 20 from one address (any usernames), that address is (`TOO_MANY_ATTEMPTS`). |
| **Sessions** | Dashboard sign-ins are JWTs signed with HS256 only (other algorithms, including `none`, are rejected) and a secret of at least 32 characters. Changing your password signs out your other sessions; an admin resetting a password signs that user out everywhere. |
| **Roles** | Only admins manage users. You can't remove your own admin access or delete yourself; there is always one active admin. |
| **Immediate revocation** | Each request reloads the user: deactivating someone ends their dashboard sessions and disconnects their PCs at once. |
| **Connected PCs** | Each PC gets its own token through a browser approval (`nodehub login`): nobody copies tokens around. Tokens are stored only as SHA-256 hashes, show *last used*, and can be disconnected one by one (e.g. a lost laptop). They can only do what Claude needs (read machines and history, record sessions, update profiles): they **cannot** manage PCs, users or passwords, change or remove machines, or download the installer with the Tailscale key (`SESSION_REQUIRED`), so a token leaked from a Claude session can't take over the account or join new devices to the tailnet. |
| **PC approval** | The approval page shows the PC name and a code to compare with the terminal; requests expire after 10 minutes, can be answered once, only by a signed-in dashboard session; the secret device code is stored hashed and the token is handed out exactly once. |
| **Input validation** | Every request body, parameter and query is validated with Zod. Values that end up on a command line (client name, notes, SSH user, hostname) can't contain quotes, `;` or `$`. |
| **Only tagged machines** | Machines can only be configured, and the SSH test only runs, if they are in the tailnet with `CLIENT_TAG`: the backend can't be used to reach other hosts. |
| **Security headers** | `helmet()` defaults, including a Content-Security-Policy that only allows scripts from nodehub itself. |
| **Rendering** | React escapes all text; machine profiles are rendered as Markdown without raw HTML. |
| **SSH keys** | Each key belongs to an account: technicians manage their own, admins any (dashboard session only, never with a PC token); private keys are refused. Keys of deactivated accounts are no longer applied. The server never connects to client PCs to distribute them: the sync runs on a technician PC that already has access, shows the changes and asks before applying (so a `nodehub://keys-sync` link from another site can't change anything by itself), and refuses to empty a machine or lock out the PC running it. |
| **Audit log** | `backend/logs/audit.log` records sign-ins (and failures, lockouts), password changes, user changes, PCs approved / connected / disconnected, installer downloads, SSH keys added or removed, machine list changes and refused cross-site requests: one JSON line each, with who and when, never passwords or tokens. |
| **Errors** | Unexpected errors answer a generic message; the details (SQL, paths, stack) go only to `backend/logs/error.log`. |

## The `nodehub://` launcher

A `nodehub://` link can be triggered by any web page (the browser asks for confirmation first). The
launcher therefore:

- takes only the host and SSH user from the link, both checked against strict patterns: no free
  text from a web page can reach Claude's prompt (the client name comes from `nodehub machine`);
- **checks with the local Tailscale client that the host is in the tailnet with `CLIENT_TAG`**,
  so a link can't point Claude at an arbitrary machine;
- only starts Claude Code in the nodehub folder with a fixed start message.

## Claude Code

- [`CLAUDE.md`](../CLAUDE.md) restricts Claude to read-only diagnostics unless the technician
  approves a change, and forbids touching antivirus, firewall, Tailscale, OpenSSH, the `nodehub`
  user or user data.
- Content from client machines is treated as **data, not instructions** (protection against
  prompt injection from files or logs).
- Claude Code's own permission prompts still apply to every command it runs.
- Every session is recorded under the technician the PC is connected as.

## OWASP Top 10 (2021) review

How nodehub stands against each category, reviewed on 2026-11-26.

| Category | Status | In nodehub |
|---|---|---|
| **A01 Broken Access Control** | ✅ | Every API route except sign-in and `nodehub login` needs a token. Admin-only routes check the role; account, user, machine-list and installer routes refuse PC tokens. Users only see and disconnect their own PCs. Cross-site requests are refused. |
| **A02 Cryptographic Failures** | ✅ | scrypt for passwords, SHA-256 for PC tokens and device codes (random 256-bit secrets), HS256 JWTs with a long secret. Traffic to client machines goes through WireGuard (Tailscale) and SSH. The dashboard is plain HTTP: on `127.0.0.1` nothing leaves the PC; on an office server it crosses the LAN unencrypted (see Known limits). |
| **A03 Injection** | ✅ | Prisma (parameterised queries); `ssh` is run with `execFile` (no shell) and validated host/user; values written into the installer are validated and quoted; React escapes output and Markdown has no raw HTML. |
| **A04 Insecure Design** | ✅ | Tagged auth keys + ACL isolate clients; Claude needs the technician's approval to change anything; PC tokens have only the rights Claude needs; `nodehub://` links carry no free text and are checked against Tailscale. |
| **A05 Security Misconfiguration** | ✅ | Local-only by default (backend and PostgreSQL); helmet headers and CSP; no CORS; generic 500 errors; the backend refuses to start with a missing or short `JWT_SECRET`. |
| **A06 Vulnerable Components** | ✅ | `npm audit` clean in backend and frontend (Prisma's `effect` dependency is pinned with an `overrides` entry until Prisma updates it). Run `npm audit` when updating. |
| **A07 Identification and Authentication Failures** | ✅ | Per-user accounts, minimum password length 10, sign-in lockout, no username enumeration, sessions expire (`JWT_EXPIRES_IN`) and end on password change or deactivation. |
| **A08 Software and Data Integrity Failures** | ✅ | The client installer only installs Tailscale if its MSI is validly signed by Tailscale Inc.; dependencies are pinned by `package-lock.json`. |
| **A09 Logging and Monitoring Failures** | ✅ | Security audit log (`backend/logs/audit.log`) and error log; every helpdesk session is recorded with its technician. |
| **A10 Server-Side Request Forgery** | ✅ | The backend only connects to Tailscale (local CLI) and, for the SSH test, to client machines it has checked are in the tailnet with `CLIENT_TAG`. |

**Known limits** (accepted for a tool that runs on the technician's own PC):

- The PostgreSQL password defaults to `nodehub`. The database only listens on `127.0.0.1`; set
  `POSTGRES_PASSWORD` (and `DATABASE_URL`) if other people use the same PC.
- The dashboard token lives in the browser's `localStorage`. The CSP and React's escaping protect
  it from scripts; signing out removes it, and it expires after `JWT_EXPIRES_IN`.
- Connected PC tokens don't expire by themselves: disconnect PCs you no longer use.
- The sign-in lockout is per username (and per address), so someone could lock an account for 15 minutes.
- On an office server the dashboard is plain HTTP on the LAN: passwords and session tokens can be
  read by anyone able to capture office traffic. Use a reverse proxy with HTTPS if the network isn't
  trusted.

## Your responsibilities

- **Protect the technicians' private SSH keys.** Anyone with a private key and access to the
  tailnet can reach every client machine. Use a passphrase (with `ssh-agent`) or a hardware key.
  When someone leaves: deactivate their nodehub account (their keys stop being applied), click
  **Sync keys**, and remove their devices from the tailnet.
- **Protect `backend/.env`**: it holds the JWT secret and the Tailscale auth key.
- **Client consent:** permanent remote access must be agreed with each client (e.g. in the support
  contract).
- **Keep the technician PC secure:** it holds the keys to every client.
