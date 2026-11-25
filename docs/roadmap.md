# Roadmap

## Next

- [ ] **Shared server for the team.** Run the backend and dashboard on one server (with its own
  Tailscale node) instead of on each technician PC. Users, roles and access tokens are already in
  place. Needs:
  - backend and frontend in containers (PostgreSQL already is);
  - machine status from the Tailscale API or a Tailscale sidecar container, instead of the local
    CLI;
  - HTTPS and listening beyond `127.0.0.1` (relaxing the local-host guard).
  The launcher and Claude Code keep running on each technician PC.
- [ ] **Client uninstaller.** Remove the `nodehub` user, the keys, the firewall rule, and take the
  machine off the tailnet, from the dashboard.
- [ ] **Audit log.** Who configured, edited or removed each machine, created users, or revoked
  tokens, and when.

## Later

- [ ] **Proactive monitoring.** Scheduled health checks (disk, services, backups, Defender) with a
  morning report and alerts.
- [ ] **Inventory.** Hardware and software collected automatically into the machine profile.
- [ ] **Playbooks.** Approved, repeatable fixes Claude can run without asking.
- [ ] **Client reports.** Monthly summary per client: sessions, state of the machines,
  recommendations.
- [ ] **Per-technician key rotation** from the dashboard.
