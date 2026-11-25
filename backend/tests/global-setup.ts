import { execSync } from 'child_process';

/** Applies the migrations to the test database before the tests run. */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST
    ?? (process.env.DATABASE_URL ?? 'postgresql://nodehub:nodehub@127.0.0.1:5433/nodehub').replace(/\/[^/?]+(\?|$)/, '/nodehub_test$1');
  if (!/\/nodehub_test(\?|$)/.test(url) && !process.env.DATABASE_URL_TEST) {
    throw new Error(`Refusing to run tests against ${url}`);
  }
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
