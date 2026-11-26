import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import prisma from './lib/prisma';
import { swaggerSpec } from './lib/swagger';
import { authGuard } from './middlewares/auth.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { allowedHosts, localHostOnly } from './middlewares/local-host.middleware';
import { MIN_SECRET_LENGTH } from './services/auth.service';
import authRoutes from './routes/auth.routes';
import installerRoutes from './routes/installer.routes';
import keysRoutes from './routes/keys.routes';
import machinesRoutes from './routes/machines.routes';
import sessionsRoutes from './routes/sessions.routes';
import settingsRoutes from './routes/settings.routes';
import cliLoginRoutes from './routes/cli-login.routes';
import tokensRoutes from './routes/tokens.routes';
import usersRoutes from './routes/users.routes';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT ?? '8737', 10);
const HOST = process.env.HOST ?? '127.0.0.1';
const FRONTEND_DIST = path.resolve(process.env.FRONTEND_DIST ?? path.join(__dirname, '../../frontend/dist'));

app.use(localHostOnly);   // only this PC: right Host, and no requests from other sites' pages
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes); // team language (read: public, change: admins)
app.use('/api/users', usersRoutes); // admins only
app.use('/api/tokens', tokensRoutes); // your connected PCs
app.use('/api/cli-login', cliLoginRoutes); // browser authorisation of a PC (nodehub login)
app.use('/api/machines', authGuard, machinesRoutes);
app.use('/api/sessions', authGuard, sessionsRoutes);
app.use('/api/installer', authGuard, installerRoutes);
app.use('/api/keys', authGuard, keysRoutes); // the team's SSH public keys
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' }));

// ---------------------------------------------------------------------------
// Dashboard (built frontend), served from the same origin when available
// ---------------------------------------------------------------------------

if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

app.use((_req, res) => res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' }));
app.use(errorMiddleware); // ALWAYS mounted last

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start() {
  try {
    if ((process.env.JWT_SECRET ?? '').length < MIN_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (see backend/.env.example).`);
    }
    await prisma.$connect();
    const users = await prisma.user.count();
    if (users === 0) logger.warn('No users yet: run "npm run seed" in backend/ to create the first admin.');
    const extraHosts = [...allowedHosts()].filter((h) => h !== '127.0.0.1' && h !== 'localhost');
    if (!['127.0.0.1', 'localhost', '::1'].includes(HOST) && extraHosts.length === 0) {
      logger.warn(`Listening on ${HOST} but ALLOWED_HOSTS is empty: other PCs will get FORBIDDEN_HOST. ` +
        'Set ALLOWED_HOSTS to the address the team uses (e.g. ALLOWED_HOSTS=192.168.1.50).');
    }
    app.listen(PORT, HOST, () => {
      logger.info(`nodehub running on http://${HOST}:${PORT}`);
      for (const h of extraHosts) logger.info(`  open it from other PCs at http://${h}:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { err: (err as Error).message });
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') start();

export default app;
