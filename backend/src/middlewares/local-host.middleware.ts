import { NextFunction, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// nodehub only serves this PC. Two checks keep web pages from other sites out:
//
//   - Host:   DNS rebinding protection. Requests must be addressed to 127.0.0.1 / localhost.
//   - Origin: a page on another site, open in the technician's browser, can still send requests to
//             http://127.0.0.1:8737 (the Host is right). Browsers add an Origin header to those, so
//             any request whose Origin is not a local page is refused, before it reaches a route.
//             This also covers "simple" requests that CORS preflights don't stop.
//
// The CLI and other local tools send no Origin and are not affected. There is no CORS: the
// dashboard is served from the same origin (and the Vite dev server proxies /api).
// ---------------------------------------------------------------------------

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;   // includes "null" (sandboxed iframes, file://)
  }
}

export function localHostOnly(req: Request, res: Response, next: NextFunction) {
  const host = (req.get('Host') ?? '').replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(host)) {
    res.status(403).json({ error: 'Forbidden host.', code: 'FORBIDDEN_HOST' });
    return;
  }

  const origin = req.get('Origin');
  if (origin !== undefined && !isLocalOrigin(origin)) {
    res.status(403).json({ error: 'Requests from other sites are not allowed.', code: 'FORBIDDEN_ORIGIN' });
    return;
  }
  next();
}
