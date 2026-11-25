# public-keys

SSH **public** keys of the technicians, one file per person (`<name>.pub`). The client installer
(downloaded from the dashboard) adds every key in this folder to the client machines, so each
technician can connect over SSH as the `nodehub` user.

These files are specific to each installation, so they are not committed (`*.pub` is ignored).

## Adding a technician

1. The technician creates a key pair on their PC, if they don't have one yet:
   ```powershell
   ssh-keygen -t ed25519 -C "<name>"
   ```
2. Copy **only the public key** (`%USERPROFILE%\.ssh\id_ed25519.pub`) here as `<name>.pub`.
3. New installers include the key automatically. For machines that are already installed, run the
   installer again on them (it keeps the existing keys and only adds new ones).

Never put a private key (`id_ed25519`, without `.pub`) in this folder.

See [docs/installation.md](../docs/installation.md#ssh-keys).
