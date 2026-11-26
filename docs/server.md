# Running nodehub on an office server

By default nodehub runs on one technician's PC and only that PC can open it. To share it with the
whole team, run it on a server (or any always-on PC) on the office network, and open the dashboard
at the server's address, e.g. **http://192.168.1.50:8737**.

```mermaid
flowchart LR
  subgraph Server["Office server"]
    API["nodehub backend + dashboard<br/>:8737"] --- DB[("PostgreSQL<br/>127.0.0.1 only")]
    API -- "tailscale status" --> TS["Tailscale"]
  end
  subgraph Tech["Each technician PC"]
    B["Browser"] -- "http://192.168.1.50:8737" --> API
    C["Claude Code + nodehub CLI"] -- "history, records" --> API
  end
  C == "SSH over Tailscale<br/>(the technician's own key)" ==> M["Client PCs"]
```

- The **server** keeps the dashboard, the database (users, machines, history) and the installer.
- **Claude runs on each technician's PC**, with that technician's SSH key. The server never connects
  to client PCs (except the optional *Test SSH*, see below).

---

## 1. The server (once)

**Needs:** Windows, always on, with a **fixed IP** (or a DHCP reservation) on the office network;
Docker Desktop, Node.js 20+, Git, and **Tailscale signed in to the support tailnet** as a team device
(not with the client tag). nodehub reads machine status from it.

1. Install nodehub as in [installation.md](installation.md) (clone, `backend\.env`, `start.cmd`).
2. In `backend\.env`, let the office network in:

   ```ini
   HOST=0.0.0.0
   ALLOWED_HOSTS=192.168.1.50
   ```

   `ALLOWED_HOSTS` is the address the team types in the browser (the IP, and/or the server's name,
   comma-separated). Requests to any other address are refused, which also blocks DNS rebinding.
3. Allow the port in the Windows firewall, only from the local network (PowerShell as administrator):

   ```powershell
   New-NetFirewallRule -Name nodehub-dashboard -DisplayName 'nodehub dashboard' `
     -Direction Inbound -Protocol TCP -LocalPort 8737 -RemoteAddress LocalSubnet -Action Allow
   ```
4. Run `start.cmd`. The log shows `open it from other PCs at http://192.168.1.50:8737`.
5. Keep it running after reboots: a Task Scheduler task *At startup* that runs `start.cmd` (with
   *Run whether user is logged on or not*), or run it inside the server's own session.
6. Add every technician's **public** SSH key in the dashboard (**Users → SSH keys**). They are
   stored in `public-keys\` on the server; the installer adds them to new client PCs, and
   `nodehub keys sync` to existing ones (see [Adding or removing a technician](#adding-or-removing-a-technician)).

PostgreSQL stays on `127.0.0.1` of the server: nothing but nodehub talks to it.

**Back up the database** regularly, e.g. a daily scheduled task:

```powershell
docker exec nodehub-db pg_dump -U nodehub nodehub > D:\backups\nodehub-$(Get-Date -Format yyyy-MM-dd).sql
```

---

## 2. Each technician PC

### Only the dashboard

Open **http://192.168.1.50:8737** and sign in with the account an admin created for you
(**Users → Add user**). Nothing to install: machines, history, users and the installer all work
from the browser.

### Helpdesk sessions ("Open in Claude")

Claude connects to client PCs from **your** PC, so it needs:

1. **Tailscale**, signed in to the support tailnet as a team device.
2. **Claude Code**, **Node.js 20+**, **Git** and Windows Terminal.
3. **An SSH key** (`ssh-keygen -t ed25519`): send the `.pub` file to an admin, who adds it in
   **Users → SSH keys** and runs `nodehub keys sync` (next section).
4. **The nodehub folder**, with only the CLI built (no database or `.env` needed on this PC):

   ```powershell
   git clone <repository> nodehub
   cd nodehub\backend
   npm install
   npm run build:cli
   cd ..
   .\launcher\register-protocol.ps1
   .\nodehub.cmd login --url http://192.168.1.50:8737
   ```

   `nodehub login` opens the server's dashboard in the browser: approve the PC there. The CLI then
   remembers the server address. The `nodehub://` launcher gets the team language and the client tag
   from the server, so nothing else needs configuring.
5. Click **Open in Claude** on a machine.

---

## Adding or removing a technician

Client PCs accept exactly the keys in **Users → SSH keys**, once they are synced:

1. An admin adds (or removes) the key in the dashboard.
2. Someone whose PC **already has access** runs, in the nodehub folder:

   ```powershell
   .\nodehub.cmd keys sync --dry-run   # shows what would change on each machine
   .\nodehub.cmd keys sync             # applies it
   ```

   Every **online** client PC is updated over SSH: new keys start working, removed keys stop
   working. Offline machines are listed as skipped: run the sync again later.

Safety: the sync refuses to run with an empty list, and refuses if none of the keys of the PC
running it is in the list (it would lock that PC out). Keys added by hand on a machine are removed:
the dashboard list is the only source of truth. When someone leaves, also deactivate their nodehub
account and remove their devices from the tailnet.

---

## Good to know

- **HTTP, not HTTPS.** On the office network the dashboard is plain HTTP, so passwords and session
  tokens travel unencrypted on the LAN. Acceptable on a trusted office network; otherwise put a
  reverse proxy with a certificate in front of it (and add its name to `ALLOWED_HOSTS`).
- **Sign-in protection** works per username (5 wrong passwords in 15 minutes) and per PC address
  (20 in 15 minutes), and every sign-in is in `backend\logs\audit.log` with the address.
- **Test SSH** (in the machine's edit dialog) runs on the server, with the SSH key of the Windows
  account running nodehub there. If that key isn't on the client PCs it reports *Permission denied*;
  that only affects the test, not helpdesk sessions.
- **Team language, users and history** are shared: everyone sees the same machines and sessions,
  each session under the technician whose PC recorded it.
