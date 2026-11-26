# Roadmap

## Next

- [x] **Shared server for the team.** nodehub can run on an office server, opened at its IP
  ([server.md](server.md)).
- [x] **Manage and distribute SSH keys.** Users → SSH keys, and `nodehub keys sync`.
- [ ] **HTTPS on the office server.** Built-in certificate or a documented reverse proxy.
- [ ] **Containers for the backend.** Backend and frontend in Docker like PostgreSQL, with machine
  status from the Tailscale API or a sidecar instead of the local CLI.
- [ ] **Client uninstaller.** Remove the `nodehub` user, the keys, the firewall rule, and take the
  machine off the tailnet, from the dashboard.
- [x] **Audit log.** `backend/logs/audit.log` (see [security.md](security.md)).

## Later

- [ ] **Proactive monitoring.** Scheduled health checks (disk, services, backups, Defender) with a
  morning report and alerts.
- [ ] **Inventory.** Hardware and software collected automatically into the machine profile.
- [ ] **Playbooks.** Approved, repeatable fixes Claude can run without asking.
- [ ] **Client reports.** Monthly summary per client: sessions, state of the machines,
  recommendations.
- [ ] **Per-technician key rotation** from the dashboard.
