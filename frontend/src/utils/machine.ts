import { getLanguage } from '../i18n'

// ---------------------------------------------------------------------------
// Helpers to start a helpdesk session on a machine
// ---------------------------------------------------------------------------

interface SessionTarget {
  host   : string
  client : string | null
  sshUser: string | null
  ip?    : string | null
}

/**
 * nodehub:// link handled by launcher/open.ps1, which re-checks the host against Tailscale.
 * Only the host and SSH user: links can come from any web page, so the launcher takes no free text
 * (Claude gets the client name from "nodehub machine").
 */
export function launcherLink(m: SessionTarget): string {
  const params = new URLSearchParams({ host: m.host, user: m.sshUser ?? '' })
  return `nodehub://open?${params}`
}

/** Text to paste into Claude Code when the nodehub:// launcher isn't available (in the active language). */
export function claudePrompt(m: SessionTarget): string {
  const ip = m.ip ?? '?'
  return getLanguage() === 'pt'
    ? `Helpdesk: cliente ${m.client}, máquina ${m.host} (${ip}, utilizador ${m.sshUser}). ` +
      'Começa a sessão como descrito no CLAUDE.md e depois pergunta-me qual é o problema.'
    : `Helpdesk: client ${m.client}, machine ${m.host} (${ip}, user ${m.sshUser}). ` +
      'Start the session as described in CLAUDE.md, then ask me what the problem is.'
}

/** Path of a machine's page in the dashboard. */
export const machinePath = (host: string) => `/machines/${encodeURIComponent(host)}`
