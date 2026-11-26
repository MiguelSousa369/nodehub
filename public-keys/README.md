# public-keys

SSH keys are now managed **in the dashboard**, and each key belongs to a user account:

- each technician adds their own key: account menu → **My SSH keys**;
- admins see every key in **Users → SSH keys**, and can add keys for others or *service keys*;
- keys of deactivated accounts are no longer applied to client PCs.

After a change, **Sync keys** (in either place) updates every online client PC. See
[docs/server.md → Adding or removing a technician](../docs/server.md#adding-or-removing-a-technician).

## This folder

Older installations kept keys here as `<name>.pub`. When the backend starts, it imports any `*.pub`
file into the database (a file named like a username, e.g. `miguel.sousa.pub`, belongs to that user)
and renames it to `*.pub.imported`. You can still drop a `.pub` file here to import it, but the
dashboard is easier.

Never put a private key (`id_ed25519`, without `.pub`) in this folder. These files are specific to
each installation and are not committed.
