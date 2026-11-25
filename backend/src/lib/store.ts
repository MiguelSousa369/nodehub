import fs from 'fs';
import path from 'path';

import { HostnameSchema, MachineConfig, MachineConfigSchema } from '../schemas/machine.schema';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// JSON file store: data/machines/<host>/entity.json
// Loaded into memory on startup; writes are synchronous.
// ---------------------------------------------------------------------------

const machines = new Map<string, { host: string; config: MachineConfig }>(); // key: lowercase host

function machinesDir(): string {
  return path.join(path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '../../data')), 'machines');
}

function entityPath(host: string): string {
  return path.join(machinesDir(), host, 'entity.json');
}

export function initStore(): void {
  machines.clear();
  const dir = machinesDir();
  fs.mkdirSync(dir, { recursive: true });

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !HostnameSchema.safeParse(entry.name).success) continue;
    const file = entityPath(entry.name);
    if (!fs.existsSync(file)) continue;

    const parsed = MachineConfigSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf-8')));
    if (parsed.success) machines.set(entry.name.toLowerCase(), { host: entry.name, config: parsed.data });
    else logger.warn('Ignoring invalid machine entity', { file, issues: parsed.error.issues });
  }

  logger.info(`Store loaded: ${machines.size} machine(s) from ${dir}`);
}

export function listConfigs(): Array<{ host: string; config: MachineConfig }> {
  return [...machines.values()];
}

export function getConfig(host: string): { host: string; config: MachineConfig } | undefined {
  return machines.get(host.toLowerCase());
}

export function saveConfig(host: string, config: MachineConfig): void {
  const file = entityPath(host);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  machines.set(host.toLowerCase(), { host, config });
}

export function deleteConfig(host: string): boolean {
  const existing = machines.get(host.toLowerCase());
  if (!existing) return false;
  fs.rmSync(path.dirname(entityPath(existing.host)), { recursive: true, force: true });
  machines.delete(host.toLowerCase());
  return true;
}
