import { NextFunction, Request, Response } from 'express';

import { audit } from '../utils/audit';

// ---------------------------------------------------------------------------
// Only addresses nodehub is meant to be reached at. Two checks keep other sites out:
//
//   - Host:   DNS rebinding protection. Requests must be addressed to 127.0.0.1 / localhost, or to
//             one of ALLOWED_HOSTS (the server's IP or name on the office network, when it runs on
//             a server: e.g. ALLOWED_HOSTS=192.168.1.50,nodehub-srv).
//   - Origin: a page on another site, open in a technician's browser, can still send requests to
//             nodehub's address. Browsers add an Origin header to those, so any request whose Origin
//             is not one of the allowed addresses is refused, before it reaches a route. This also
//             covers "simple" requests that CORS preflights don't stop.
//
// The CLI and other tools send no Origin and are not affected. There is no CORS: the dashboard is
// served from the same origin (and the Vite dev server proxies /api).
// ---------------------------------------------------------------------------

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

/** Host names / IPs nodehub answers to (lowercase): localhost plus ALLOWED_HOSTS. Read per request so tests can change it. */
export function allowedHosts(): Set<string> {
  const extra = (process.env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return new Set([...LOCAL_HOSTS, ...extra]);
}

/** "192.168.1.50:8737" → "192.168.1.50"; "[::1]:8737" → "::1". */
function hostnameOf(hostHeader: string): string {
  const bracketed = hostHeader.match(/^\[([^\]]+)\](:\d+)?$/);
  return (bracketed ? bracketed[1] : hostHeader.replace(/:\d+$/, '')).toLowerCase();
}

function isAllowedOrigin(origin: string, hosts: Set<string>): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && hosts.has(url.hostname.replace(/^\[|\]$/g, '').toLowerCase());
  } catch {
    return false;   // includes "null" (sandboxed iframes, file://)
  }
}

export function localHostOnly(req: Request, res: Response, next: NextFunction) {
  const hosts = allowedHosts();
  const host = hostnameOf(req.get('Host') ?? '');
  if (!hosts.has(host)) {
    audit('request.forbidden', null, { reason: 'host', host: host.slice(0, 100), path: req.path.slice(0, 200) });
    res.status(403).json({ error: 'Forbidden host. Add it to ALLOWED_HOSTS in backend/.env if nodehub runs on a server.', code: 'FORBIDDEN_HOST' });
    return;
  }

  const origin = req.get('Origin');
  if (origin !== undefined && !isAllowedOrigin(origin, hosts)) {
    audit('request.forbidden', null, { reason: 'origin', origin: origin.slice(0, 200), path: req.path.slice(0, 200) });
    res.status(403).json({ error: 'Requests from other sites are not allowed.', code: 'FORBIDDEN_ORIGIN' });
    return;
  }
  next();
}
