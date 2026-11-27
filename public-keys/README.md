# public-keys

SSH keys are managed **in the dashboard**, and each key belongs to a user account:

- each technician adds their own key: account menu → **My SSH keys**;
- admins see every key in **Users → SSH keys**, and can add keys for others or *service keys*;
- keys of deactivated accounts are no longer applied to client PCs.

After a change, **Sync keys** (in either place) updates every online client PC. See
[docs/installation.md → Adding or removing a technician](../docs/installation.md#6-adding-or-removing-a-technician).

## This folder

When the backend starts, it imports any `*.pub` file in this folder into the database (a file
named like a username, e.g. `ana.ribeiro.pub`, belongs to that user) and renames it to
`*.pub.imported`. It's a way to bring in many keys at once; for one key, the dashboard is easier.

Never put a private key (`id_ed25519`, without `.pub`) in this folder. These files are specific to
each installation and are not committed.
