import prisma from '../lib/prisma';
import { LanguageSchema, Settings, UpdateSettings } from '../schemas/settings.schema';

// ---------------------------------------------------------------------------
// Team-wide settings, stored as key/value rows. Missing or unreadable values fall back to the
// defaults, so a fresh database works without any setup.
// ---------------------------------------------------------------------------

const DEFAULTS: Settings = { language: 'en' };

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const value = (key: keyof Settings) => rows.find((r) => r.key === key)?.value;
  const language = LanguageSchema.safeParse(value('language'));
  return { language: language.success ? language.data : DEFAULTS.language };
}

export async function updateSettings(input: UpdateSettings): Promise<Settings> {
  await prisma.$transaction(Object.entries(input).map(([key, value]) =>
    prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })));
  return getSettings();
}
