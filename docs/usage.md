# Using the dashboard

The dashboard runs at **http://127.0.0.1:8737** (start it with `start.cmd`). Sign in with your
nodehub account.

- [Machines](#machines)
- [Quick search](#quick-search)
- [Adding a machine](#adding-a-machine)
- [Editing and removing machines](#editing-and-removing-machines)
- [History and profiles](#history-and-profiles)
- [Users](#users)
- [Your account: password, connected PCs, theme and language](#your-account)
- [Language: English or Portuguese](#language-english-or-portuguese)
- [Links you can bookmark](#links-you-can-bookmark)

---

## Machines

The **Machines** tab lists every client machine, grouped by client. Each client's heading shows
how many of its machines are online (e.g. **6/10 online**) and opens or closes its machines.

| On the card | Meaning |
|---|---|
| **PC-PEDRO** + `desktop-7f3k2lq` | The friendly name you gave it (if any), with the name in the tailnet underneath |
| **New** | Added in the last 2 hours (configured, or joined the tailnet if still unassigned) |
| ● green (pulsing) / ○ grey | Online / offline in Tailscale. Offline cards say when the machine was last seen |
| `100.x.y.z` | Tailscale IP |
| `nodehub` | SSH user Claude connects with |
| `windows` | Operating system reported by Tailscale |
| *session 2 days ago* | When the last helpdesk session on this machine was recorded |
| Machine name | Opens the [machine's page](#history-and-profiles) |
| **Open in Claude** | Opens a terminal with Claude Code connected to the machine (see [helpdesk sessions](helpdesk-sessions.md)) |
| **Copy** | Copies the same start message, to paste into a Claude Code session opened in the nodehub folder |
| **⋯** | History & profile, Edit, Remove |

Machines with the client tag that aren't assigned to a client yet appear at the top under
**Unassigned**, with a dashed border and a **Configure** button.

### Finding machines among many clients

The toolbar above the list is built for a large number of clients:

- **Search** by machine, client, notes or IP.
- **All / Online / Offline / New / Unassigned** narrows the list by status.
- **Search** also finds machines by their friendly name.
- **Sort** machines by name (natural order: `pc2` before `pc10`), online first, or most recent session.
- **Expand all / Collapse all.** With more than 40 machines, clients start collapsed; nodehub
  remembers which ones you opened. While searching or filtering, every matching client is open.
- Clients with more than 60 machines show the first 60 and a **Show all** button.

The list refreshes every 30 seconds while the tab is visible (it pauses in background tabs).
**Updated … ago** shows when, and the ⟳ button refreshes now.

---

## Quick search

Press **Ctrl+K** (or **/**) on any page, or click **Search…** in the top bar, and type part of a
machine or client name:

- **Enter** on a machine opens it **in Claude** straight away; **Shift+Enter** opens its page.
- Online machines are listed first. Clients and pages (Machines, History, Users) are listed too.
- **↑ ↓** move between results, **Esc** closes.

---

## Adding a machine

1. **+ Add machine → Download installer.** The file (`nodehub-install.ps1`) already contains the
   Tailscale auth key, the technicians' SSH keys and the client tag.
   If the button is disabled, the dialog lists what's missing in the configuration.
2. Take the file to the client PC (remote session, USB drive, email) and **right-click → Run with
   PowerShell**. Accept the administrator prompt. Nothing needs to be typed.
   Details of what it changes: [client-installer.md](client-installer.md).
3. Within 30 seconds the machine shows up under **Unassigned**. Click **Configure**:
   - **Client:** pick an existing client or type a new one (letter case doesn't matter).
   - **Name (optional):** how the team calls it, e.g. *PC-PEDRO*. The machine keeps its name in the
     tailnet (the Windows computer name in lowercase, e.g. `desktop-7f3k2lq`), which is what SSH and
     the history use, so you can change the friendly name at any time.
   - **SSH user:** leave `nodehub` (the account the installer creates).
   - **Notes:** optional, e.g. *Front desk PC*.
   - **Test SSH** checks the connection before saving.
4. **Save.** The machine moves to its client and gets the *Open in Claude* button.

> The installer contains a key to the support network and deletes itself when it finishes.
> Don't leave copies in emails or on USB drives.

---

## Editing and removing machines

- **⋯ → Edit:** change the client, friendly name, SSH user or notes.
- **⋯ → Remove:** takes the machine out of the dashboard. It **keeps its access**: if it's still
  in the tailnet, it reappears under *Unassigned*, and its history is kept (it comes back if the
  machine is configured again). To cut access for good, see
  [client-installer.md → Removing access](client-installer.md#removing-access).

---

## History and profiles

**Per machine:** click the machine's name (or **⋯ → History & profile**) to open its page,
`/machines/<host>`. It shows:

- the live **status**, IP and SSH user, with **Open in Claude**, **Copy** and **Edit**;
- the **profile**: role, OS, hardware, important software, quirks. Claude keeps it up to date;
  you can also edit it here. It is written in Markdown and shown formatted;
- the **sessions**, newest first. Click a session to see the problem, diagnosis, actions and
  anything pending. **Search in history** opens the History tab filtered to this machine.

**Across all clients:** the **History** tab lists every session, grouped by day, with:

- text search (machine, summary, problem, diagnosis, actions, pending);
- a result filter (*Fixed*, *Partial*, *Unresolved*): handy to find open issues;
- a technician filter (you are listed first);
- a machine filter, when you come from a machine's page.

Each session shows who did it: the technician the PC running Claude is connected as.

---

## Users

*Admins only.* The **Users** tab manages who can sign in, the team language and the team's SSH keys.

**SSH keys** lists every key with its owner: who can reach client PCs. Admins can add a key for
anyone, or a *service key* (no owner), and remove any key. Keys of deactivated accounts are marked
*not applied*. After a change, **Sync keys** updates every online client PC (details in
[server.md](server.md#adding-or-removing-a-technician)). New installers always include the active keys.

| Role | Can |
|---|---|
| **Technician** | Everything with machines, clients, sessions and their own connected PCs |
| **Admin** | The same, plus managing users |

- **+ Add user:** username (lowercase letters, digits, `.` `_` `-`), name, initial password (at
  least 10 characters) and role. Share the password privately; the user changes it on first sign-in.
- **Edit:** change name, role, reset the password, or untick **Active** to block access while
  keeping their history. Deactivating someone signs them out and disconnects their PCs
  immediately.
- **Delete:** removes the account. Their past sessions stay, marked *deleted user*.

Safety rules: you can't remove your own admin access or delete yourself, and there is always at
least one active admin.

---

## Your account

Click your initials in the top-right corner:

- **Change password.**
- **My SSH keys:** the keys you reach client PCs with. **Add key** (paste the `.pub` file),
  **Remove**, and **Sync keys** to apply the change to the client PCs.
- **Connected PCs:** the PCs where Claude Code can read history and record sessions **in your
  name**, with when each was connected and last used.
  - A PC connects the first time you click **Open in Claude** on it: a browser tab asks
    **Connect this PC?** Check the code and click **Approve**. (By hand: `.\nodehub.cmd login`,
    see [cli.md](cli.md#connecting-a-pc).)
  - **Disconnect** a PC you no longer use, or one that was lost. The others keep working.
  - A connected PC can't manage PCs, users or passwords: those need a dashboard sign-in.
- **Sign out.** Sessions also expire after `JWT_EXPIRES_IN` (12 hours by default).
- **Theme:** *System* (follows Windows), *Light* or *Dark*. Remembered in this browser.
- **Language:** *Team* (the team language, see below), *English* or *Português*. Changes only your
  dashboard, in this browser.

---

## Language: English or Portuguese

nodehub works in **English** or **Portuguese (Portugal)**. An admin sets the **team language** in
**Users → Team settings**. It decides:

| What | Language |
|---|---|
| The dashboard | The team language by default; each person can switch their own in the account menu |
| Session records and machine profiles written by Claude | The team language (`nodehub machine` tells Claude) |
| Claude's replies in the conversation | The language you write to it in |
| The `nodehub` CLI messages, the `nodehub://` launcher and the start message | The team language |
| The client installer's messages (what the client sees) | The team language |

Changing the team language doesn't translate existing records: they stay in the language they were
written in. The technical documentation in `docs/` is in English.

---

## Links you can bookmark

Every page and filter has its own address, so the browser's back button works and links can be
shared with the team:

| Address | Shows |
|---|---|
| `/` | Machines |
| `/?q=bakery&status=offline` | Machines filtered by search and status (`status`: `online`, `offline`, `unassigned`; `sort`: `online`, `recent`) |
| `/machines/srv-bakery` | One machine: status, profile and sessions |
| `/history?result=UNRESOLVED` | Sessions filtered (`q`, `result`, `technician`, `host`) |
| `/users` | Users (admins) |

If you aren't signed in, nodehub asks you to sign in and then opens the address you asked for.
