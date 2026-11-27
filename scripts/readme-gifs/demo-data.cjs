// Fictional demo data for the README GIFs (served to the browser by route interception: nothing is
// written to any database). Names of clients, people and PCs are made up.

const now = Date.now()
const iso = (msAgo) => new Date(now - msAgo).toISOString()
const H = 3600e3, D = 24 * H

const technicians = [
  { id: 1, name: 'Ana Ribeiro' },
  { id: 2, name: 'João Costa' },
  { id: 3, name: 'Marta Lopes' },
]
const me = { id: 1, username: 'ana.ribeiro', name: 'Ana Ribeiro', role: 'ADMIN' }

const clients = {
  'Atlas Logistics'   : [['srv-atlas', 'Main server', true], ['desktop-4k2m9qd', 'PC-WAREHOUSE', true], ['desktop-p7f1x2c', 'PC-DISPATCH', false], ['laptop-atl-03', 'Laptop - Rui', true]],
  'Bloom Florists'    : [['bloom-pos', 'Shop till', true], ['bloom-office', 'Office PC', false]],
  'Harbor Dental'     : [['srv-harbor', 'Imaging server', true], ['desktop-rcp01', 'Reception', true], ['desktop-sur02', 'Surgery 2', true], ['desktop-sur03', 'Surgery 3', false], ['xray-ws', 'X-ray workstation', true]],
  'Northwind Accounts': [['nw-srv01', 'File server', true], ['desktop-nw-pedro', 'PC-PEDRO', true], ['desktop-nw-sara', 'PC-SARA', true], ['desktop-nw-luis', 'PC-LUIS', false]],
  'Oak & Iron Cafe'   : [['oak-till', 'Till', true]],
  'Silva Bakery'      : [['srv-bakery', 'Server', true], ['bakery-front', 'Front desk', true], ['bakery-office', 'Office', false]],
  'Summit Law'        : [['summit-dc', 'Domain controller', true], ['desktop-sl-ines', 'PC-INES', true], ['desktop-sl-tomas', 'PC-TOMAS', true]],
}

let ip = 10
const machines = []
for (const [client, list] of Object.entries(clients)) {
  for (const [host, displayName, online] of list) {
    ip++
    machines.push({
      host, displayName, client, sshUser: 'nodehub', notes: '', configured: true, inTailnet: true, online,
      ip: `100.88.${Math.floor(ip / 5)}.${ip}`, os: 'windows',
      lastSeen: online ? null : iso((ip % 9 + 1) * H),
      lastSessionAt: ip % 3 === 0 ? null : iso((ip % 11) * D + (ip % 5) * H),
      addedAt: iso(40 * D),
    })
  }
}
machines.find((m) => m.host === 'desktop-nw-pedro').notes = 'Accounting - ERP and payroll'
machines.find((m) => m.host === 'srv-harbor').notes = 'Backups at 22:00'
// A freshly installed PC, not configured yet
machines.unshift({
  host: 'desktop-7f3k2lq', displayName: '', client: null, sshUser: null, notes: '', configured: false, inTailnet: true,
  online: true, ip: '100.88.9.77', os: 'windows', lastSeen: null, lastSessionAt: null, addedAt: iso(12 * 60e3),
})

const S = (id, host, techId, msAgo, result, summary, problem, diagnosis, actions, pending = '') => {
  const m = machines.find((x) => x.host === host)
  return {
    id, host, client: m.client, machineName: m.displayName, technician: technicians[techId - 1], summary, problem, diagnosis, actions,
    result, pending, createdAt: iso(msAgo), updatedAt: null,
  }
}
const sessions = [
  S(41, 'desktop-rcp01', 1, 0.6 * H, 'FIXED', 'Printer queue stuck', 'Reception cannot print appointment slips.', 'Print spooler stopped after a Windows update; 37 jobs stuck in the queue.', 'Cleared the queue and restarted the spooler (approved). Test page OK.'),
  S(40, 'srv-atlas', 2, 3.2 * H, 'PARTIAL', 'Disk almost full on server', 'Server slow, low disk warning.', 'C: at 96%: 41 GB of old SQL backups and 9 GB of temp files.', 'Deleted temp files (approved). Backups kept until the client confirms.', 'Client to confirm which SQL backups can be deleted.'),
  S(39, 'desktop-nw-pedro', 1, 5 * H, 'FIXED', 'Outlook not opening', 'Outlook hangs on "Loading profile".', 'Corrupt OST file (11 GB) after a forced shutdown.', 'Renamed the OST and let Outlook rebuild it (approved).'),
  S(38, 'summit-dc', 3, 26 * H, 'FIXED', 'Windows updates pending for 40 days', 'Monthly check.', '12 updates pending, one failing with 0x800f0922.', 'Repaired the component store (DISM), installed all updates, rebooted at 19:00 (approved).'),
  S(37, 'xray-ws', 2, 28 * H, 'UNRESOLVED', 'X-ray software license error', 'Imaging app says license expired.', 'License server unreachable: vendor dongle not detected.', 'Reseated the dongle remotely with the dentist. Vendor ticket opened.', 'Waiting for the vendor to send a new dongle.'),
  S(36, 'bloom-pos', 3, 30 * H, 'FIXED', 'Card terminal not connecting', 'Payments failing at the till.', 'Terminal service crashed; firewall rule missing after reinstall.', 'Restored the firewall rule and restarted the service (approved).'),
  S(35, 'desktop-sl-ines', 1, 2.2 * D, 'FIXED', 'Defender threat detected', 'Pop-up about a threat.', 'Defender quarantined an adware installer from Downloads. Quick scan clean.', 'Removed the quarantined file (approved). Full scan scheduled overnight.'),
  S(34, 'nw-srv01', 2, 3.1 * D, 'FIXED', 'Mapped drive missing for new user', 'New employee cannot see the S: drive.', 'User not in the "Accounting" group.', 'Added to the group (approved); drive appears after sign-in.'),
  S(33, 'srv-bakery', 3, 4 * D, 'PARTIAL', 'Backup job failing', 'Nightly backup email shows failure.', 'USB backup disk full.', 'Pruned backups older than 60 days (approved).', 'Suggest a larger backup disk.'),
  S(32, 'desktop-sur02', 1, 5 * D, 'FIXED', 'Slow startup', 'PC takes 6 minutes to start.', '14 startup apps, one (old updater) hanging for 4 minutes.', 'Disabled the updater at startup (approved). Startup now 50 s.'),
  S(31, 'laptop-atl-03', 2, 6 * D, 'FIXED', 'VPN to warehouse not connecting', 'Rui cannot reach the stock system from home.', 'Expired client certificate.', 'Installed the renewed certificate (approved).'),
]

const profile = `- **Role:** workstation (accounting)
- **OS:** Windows 11 Pro 23H2
- **Hardware:** Dell OptiPlex 7010, i5-13500, 16 GB RAM, 512 GB NVMe
- **Important software:** ERP v10 (accounting), Microsoft 365 (Outlook, Excel), Adobe Acrobat
- **Quirks:** Outlook profile is large (11 GB OST); keep an eye on disk space.`

const users = [
  { ...me, active: true, createdAt: iso(90 * D) },
  { id: 2, username: 'joao.costa', name: 'João Costa', role: 'TECHNICIAN', active: true, createdAt: iso(60 * D) },
  { id: 3, username: 'marta.lopes', name: 'Marta Lopes', role: 'TECHNICIAN', active: true, createdAt: iso(20 * D) },
  { id: 4, username: 'carlos.dias', name: 'Carlos Dias', role: 'TECHNICIAN', active: false, createdAt: iso(200 * D) },
]
const key = (id, owner, name, fp) => ({
  id, name, type: 'ssh-ed25519', comment: owner ? `${owner.username}@${name}` : name, fingerprint: `SHA256:${fp}`,
  key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${fp} ${name}`, owner: owner && { id: owner.id, name: owner.name, username: owner.username, active: owner.active },
  effective: !owner || owner.active, createdAt: iso(30 * D),
})
const keys = [
  key(1, users[0], 'laptop', 'k3Lx9QpZ2mVt7R1cYwB8eN4sJfH6dGaU0oPiTnE5rCq'),
  key(2, users[1], 'desktop', 'Zt8nQ2rLm5Vx1KcP9wYb4FjH7sDgA3eUoNiT6qRlC0p'),
  key(3, users[2], 'laptop', 'Qm4Vt9Lx2Zp7R1cYwB8eN5sJfH6dGaU3oPiTnE0rCkw'),
  key(4, users[3], 'old-laptop', 'Hd6Ga3UoPiTnE0rCkwQm4Vt9Lx2Zp7R1cYwB8eN5sJf'),
]

/** Answers every /api request the dashboard makes. */
function handle(url, method, body) {
  const u = new URL(url)
  const p = u.pathname
  const q = u.searchParams
  if (p === '/api/settings') return { language: 'en', clientTag: 'tag:client' }
  if (p === '/api/auth/me') return me
  if (p === '/api/machines' && method === 'GET') {
    return { machines, clients: Object.keys(clients), tailscaleError: null }
  }
  if (p.startsWith('/api/machines/') && method === 'PUT') {
    const m = machines.find((x) => x.host === decodeURIComponent(p.split('/')[3]))
    Object.assign(m, { client: body.client, displayName: body.displayName, notes: body.notes, sshUser: body.sshUser, configured: true, addedAt: new Date().toISOString() })
    return { host: m.host, ...body }
  }
  if (p.startsWith('/api/machines/') && method === 'GET') {
    const host = decodeURIComponent(p.split('/')[3])
    const m = machines.find((x) => x.host === host)
    const list = sessions.filter((s) => s.host === host)
    return {
      host, displayName: m.displayName, client: m.client, sshUser: 'nodehub', notes: m.notes,
      profile: host === 'desktop-nw-pedro' ? profile : '', updatedAt: iso(2 * D), recentSessions: list, totalSessions: list.length,
    }
  }
  if (p === '/api/sessions/technicians') return technicians
  if (p === '/api/sessions') {
    let list = sessions
    if (q.get('result')) list = list.filter((s) => s.result === q.get('result'))
    if (q.get('host')) list = list.filter((s) => s.host === q.get('host'))
    if (q.get('technicianId')) list = list.filter((s) => s.technician.id === Number(q.get('technicianId')))
    if (q.get('q')) list = list.filter((s) => JSON.stringify(s).toLowerCase().includes(q.get('q').toLowerCase()))
    return { sessions: list, total: list.length }
  }
  if (p === '/api/users') return users
  if (p === '/api/keys') return keys
  if (p === '/api/tokens') return []
  if (p === '/api/installer/status') return { ready: true, missing: [] }
  return {}
}

module.exports = { handle, me }
