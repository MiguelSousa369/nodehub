import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Tests run against a separate database (nodehub_test), never the real one.
const testUrl = process.env.DATABASE_URL_TEST
  ?? (process.env.DATABASE_URL ?? 'postgresql://nodehub:nodehub@127.0.0.1:5433/nodehub').replace(/\/[^/?]+(\?|$)/, '/nodehub_test$1');

export default defineConfig({
  test: {
    globalSetup: './tests/global-setup.ts',
    fileParallelism: false,
    env: {
      NODE_ENV         : 'test',
      DATABASE_URL     : testUrl,
      JWT_SECRET       : 'test-secret-that-is-at-least-32-characters-long',
      TAILSCALE_AUTHKEY: 'tskey-auth-kTEST123-abcDEF',
    },
  },
});
