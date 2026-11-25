# Using the dashboard

The dashboard runs at **http://127.0.0.1:8737** (start it with `start.cmd`). Sign in with your
nodehub account.

- [Machines](#machines)
- [Adding a machine](#adding-a-machine)
- [Editing and removing machines](#editing-and-removing-machines)
- [History and profiles](#history-and-profiles)
- [Users](#users)
- [Your account: password and access tokens](#your-account)

---

## Machines

The **Machines** tab lists every client machine, grouped by client:

| On the card | Meaning |
|---|---|
| ● green / ○ grey | Online / offline in Tailscale (refreshed every 30 seconds) |
| `100.x.y.z` | Tailscale IP |
| `nodehub` | SSH user Claude connects with |
| **Open in Claude** | Opens a terminal with Claude Code connected to the machine (see [helpdesk sessions](helpdesk-sessions.md)) |
| **Copy** | Copies the same start message, to paste into a Claude Code session opened in the nodehub folder |
| **⋯** | History & profile, Edit, Remove |

Machines with the client tag that aren't assigned to a client yet appear under **Unassigned**
with a dashed border and a **Configure** button.

Use the filter box to find a client or machine by name.

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
   - **SSH user:** leave `nodehub` (the account the installer creates).
   - **Notes:** optional, e.g. *Front desk PC*.
   - **Test SSH** checks the connection before saving.
4. **Save.** The machine moves to its client and gets the *Open in Claude* button.

> The installer contains a key to the support network and deletes itself when it finishes.
> Don't leave copies in emails or on USB drives.

---

## Editing and removing machines

- **⋯ → Edit:** change the client, SSH user or notes.
- **⋯ → Remove:** takes the machine out of the dashboard. It **keeps its access**: if it's still
  in the tailnet, it reappears under *Unassigned*, and its history is kept (it comes back if the
  machine is configured again). To cut access for good, see
  [client-installer.md → Removing access](client-installer.md#removing-access).

---

## History and profiles

**Per machine:** **⋯ → History & profile** shows:

- the **profile**: role, OS, hardware, important software, quirks. Claude keeps it up to date;
  you can also edit it here (Markdown);
- the **sessions**, newest first. Click a session to see the problem, diagnosis, actions and
  anything pending.

**Across all clients:** the **History** tab lists every session with:

- text search (machine, summary, problem, diagnosis, actions, pending);
- a result filter (*Fixed*, *Partial*, *Unresolved*): handy to find open issues;
- *Only my sessions*.

Each session shows who did it: the technician whose access token Claude used.

---

## Users

*Admins only.* The **Users** tab manages who can sign in.

| Role | Can |
|---|---|
| **Technician** | Everything with machines, clients, sessions and their own access tokens |
| **Admin** | The same, plus managing users |

- **+ Add user:** username (lowercase letters, digits, `.` `_` `-`), name, initial password (at
  least 10 characters) and role. Share the password privately; the user changes it on first sign-in.
- **Edit:** change name, role, reset the password, or untick **Active** to block access while
  keeping their history. Deactivating someone signs them out and disables their access tokens
  immediately.
- **Delete:** removes the account. Their past sessions stay, marked *deleted user*.

Safety rules: you can't remove your own admin access or delete yourself, and there is always at
least one active admin.

---

## Your account

In the top bar:

- **Password:** change your password.
- **Access tokens:** tokens for the [nodehub CLI](cli.md), which Claude Code uses to read history
  and record sessions **in your name**.
  - Create one token per PC (e.g. *Office laptop*), copy it (it's shown once) and run
    `.\nodehub.cmd login` in the nodehub folder.
  - The list shows when each token was last used. **Revoke** a token you no longer use or if a PC
    is lost.
  - Tokens can't manage users, tokens or passwords: those need a dashboard sign-in.
- **Sign out.** Sessions also expire after `JWT_EXPIRES_IN` (12 hours by default).
