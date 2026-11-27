# Installation

This guide sets up nodehub from scratch: the Tailscale network, the technicians' SSH keys and
nodehub itself. Adding client machines is covered in [Using the dashboard](usage.md#adding-a-machine).

## Choose a mode

| | **One PC** | **Office server** |
|---|---|---|
| For | Trying it out, or a single technician | A team: everyone shares the same machines and history |
| Dashboard + database | On your PC, at `http://127.0.0.1:8737` | On the server, at its IP, e.g. `http://192.168.1.50:8737` |
| Who opens the dashboard | Only that PC | Every PC on the office network |
| Claude Code (helpdesk sessions) | On that PC | On each technician's PC |
| Guide | [Installation](installation.md) | [Installation](installation.md) steps 1-3, then [Office server](server.md) |

In both modes, Claude always connects to client PCs **from the technician's PC**, with that
technician's SSH key; the server only keeps the dashboard and the data.

- **One PC:** follow this whole guide on that PC.
- **Office server:** do steps 1-3 here (requirements, Tailscale, SSH keys), then continue in
  [Office server](server.md): it covers the server and each technician's PC.

- [1. Requirements](#1-requirements)
- [2. Tailscale](#2-tailscale)
- [3. SSH keys](#3-ssh-keys)
- [4. Install nodehub (one PC)](#4-install-nodehub-one-pc)
- [5. First run](#5-first-run)
- [6. More technicians](#6-more-technicians)

---

## 1. Requirements

| On the technician PC | Why |
|---|---|
| Windows 10/11 | The launcher and installer are PowerShell |
| [Node.js](https://nodejs.org) 20+ | Backend, dashboard and CLI |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Runs PostgreSQL |
| [Tailscale](https://tailscale.com/download) | Reaches the client machines |
| [Claude Code](https://docs.anthropic.com/claude-code) | Does the helpdesk work |
| Git | To get the code |

Client machines need Windows 10 1809+ / Windows Server 2019+ (for the built-in OpenSSH Server)
and internet access during installation.

---

## 2. Tailscale

nodehub uses one Tailscale network (*tailnet*) for the support team and all client machines.
Client machines carry a **tag** (by default `tag:client`); the ACL lets the team reach them on
SSH only, and stops clients from reaching anything else.

### 2.1 Create the tailnet

Create a Tailscale account for the support team (e.g. with the company's Google or Microsoft
account) and install Tailscale on every technician PC, signed in to that account.

### 2.2 Access controls (ACL)

In the Tailscale admin console, **Access controls**, paste the policy from
[`tailscale-acl.example.hujson`](tailscale-acl.example.hujson):

```jsonc
{
  "tagOwners": {
    "tag:client": ["autogroup:admin"],
  },
  "grants": [
    // Technicians' devices can talk to each other
    {"src": ["autogroup:member"], "dst": ["autogroup:self"], "ip": ["*"]},
    // Technicians reach client machines on SSH only
    {"src": ["autogroup:member"], "dst": ["tag:client"], "ip": ["22"]},
  ],
  // Everything else is denied: clients can't reach technicians or each other.
}
```

If you use a different tag (e.g. in your language), change it here **and** set `CLIENT_TAG` in
`backend/.env` to the same value.

### 2.3 Auth key for the installer

In **Settings → Keys → Generate auth key**:

| Option | Value | Why |
|---|---|---|
| Reusable | **on** | One installer for every client machine |
| Pre-approved | **on** | Machines join without manual approval |
| Tags | **`tag:client`** | Applies the client tag (and its ACL) automatically |
| Expiration | your choice (max 90 days) | Generate a new one when it expires |

Copy the key (`tskey-auth-...`); it's shown only once. It goes into `TAILSCALE_AUTHKEY` in
step 4. Tagged devices don't expire, so machines stay connected after the key expires.

---

## 3. SSH keys

Every technician needs an SSH key pair. The **public** key goes to every client machine through
the installer and **Sync keys**.

```powershell
ssh-keygen -t ed25519 -C "<your name>"      # if you don't have one yet
```

After the first sign-in (step 5), add it in the dashboard: account menu → **My SSH keys** → **Add
key**, and paste the contents of `%USERPROFILE%\.ssh\id_ed25519.pub`. Keys belong to your
account. (Keys dropped in `public-keys\*.pub` are imported at startup, see
[public-keys/README.md](../public-keys/README.md).)

---

## 4. Install nodehub (one PC)

On the PC that will run nodehub *and* the helpdesk sessions.

```powershell
git clone https://github.com/MiguelSousa369/nodehub.git
cd nodehub
copy backend\.env.example backend\.env
```

Edit `backend\.env` (all settings: [configuration.md](configuration.md)):

| Setting | Value |
|---|---|
| `JWT_SECRET` | A long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_TAG` | `tag:client` (or the tag you chose in 2.2) |
| `TAILSCALE_AUTHKEY` | The key from 2.3 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Optional: the first admin account |

Register the `nodehub://` protocol, which lets the dashboard open Claude Code (no admin rights
needed):

```powershell
.\launcher\register-protocol.ps1
```

---

## 5. First run

Make sure Docker Desktop is running, then double-click **`start.cmd`** (or run it in a terminal).
It:

1. starts PostgreSQL (`docker compose up -d`);
2. installs dependencies the first time;
3. applies the database migrations;
4. creates the first admin if there are no users yet. Without `ADMIN_PASSWORD`, a random
   password is **printed once**: note it down;
5. builds and opens the dashboard at **http://127.0.0.1:8737**.

Then:

1. Sign in as `admin` and change the password (your initials, top right → **Change password**).
2. Click **Open in Claude** on any machine. The first time, a browser tab asks to **connect this
   PC** to your account: check the code and **Approve**. (Or run `.\nodehub.cmd login` beforehand.)
3. Add your first client machine: [usage.md → Adding a machine](usage.md#adding-a-machine).

---

## 6. More technicians

For each new technician:

1. An admin creates their account (**Users → + Add user**).
2. They add their public key (account menu → **My SSH keys**), and someone with access clicks
   **Sync keys** so existing client machines accept it.
3. **One PC mode:** they sign in on that same PC. For technicians working from their own PCs,
   switch to the [office server](server.md) mode: the dashboard and history then live on the
   server, and each technician's PC only needs Claude Code and the nodehub CLI
   ([Each technician PC](server.md#2-each-technician-pc)).
