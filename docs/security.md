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
| **Local only** | The backend listens on `127.0.0.1`; PostgreSQL too. |
| **DNS rebinding** | Requests whose `Host` isn't `127.0.0.1`/`localhost` are rejected. |
| **Accounts** | Every technician has their own account. Passwords are hashed with scrypt (random salt). Login errors don't reveal whether a username exists. |
| **Roles** | Only admins manage users. You can't remove your own admin access or delete yourself; there is always one active admin. |
| **Immediate revocation** | Each request reloads the user: deactivating someone ends their dashboard sessions and disconnects their PCs at once. |
| **Connected PCs** | Each PC gets its own token through a browser approval (`nodehub login`): nobody copies tokens around. Tokens are stored only as SHA-256 hashes, show *last used*, and can be disconnected one by one (e.g. a lost laptop). They can only do what Claude needs (read machines and history, record sessions, update profiles): they **cannot** manage PCs, users or passwords, change or remove machines, or download the installer with the Tailscale key (`SESSION_REQUIRED`), so a token leaked from a Claude session can't take over the account or join new devices to the tailnet. |
| **PC approval** | The approval page shows the PC name and a code to compare with the terminal; requests expire after 10 minutes, can be answered once, only by a signed-in dashboard session; the secret device code is stored hashed and the token is handed out exactly once. |
| **Input validation** | Every request body, parameter and query is validated with Zod. Values that end up on a command line (client name, notes, SSH user, hostname) can't contain quotes, `;` or `$`. |
| **Only tagged machines** | Machines can only be configured if they are in the tailnet with `CLIENT_TAG`. |
| **Security headers** | `helmet()` defaults; CORS restricted in production. |
| **Errors** | Internal error messages are hidden when `NODE_ENV=production`. |

## The `nodehub://` launcher

A `nodehub://` link can be triggered by any web page (the browser asks for confirmation first). The
launcher therefore:

- validates the host, client and SSH user against strict patterns;
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

## Your responsibilities

- **Protect the technicians' private SSH keys.** Anyone with a private key and access to the
  tailnet can reach every client machine. Use a passphrase (with `ssh-agent`) or a hardware key.
  When someone leaves: remove their key from `public-keys/`, re-run the installer on machines (or
  remove the line from `administrators_authorized_keys`), deactivate their nodehub account and
  remove their devices from the tailnet.
- **Protect `backend/.env`**: it holds the JWT secret and the Tailscale auth key.
- **Client consent:** permanent remote access must be agreed with each client (e.g. in the support
  contract).
- **Keep the technician PC secure:** it holds the keys to every client.
