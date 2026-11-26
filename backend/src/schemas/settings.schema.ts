import { z } from 'zod';

// ---------------------------------------------------------------------------
// Team-wide settings
// ---------------------------------------------------------------------------

/** en = English, pt = Portuguese (Portugal). */
export const LanguageSchema = z.enum(['en', 'pt']);

export const UpdateSettingsSchema = z.object({
  language: LanguageSchema,
}).strict();

export type Language       = z.infer<typeof LanguageSchema>;
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

export interface Settings {
  /**
   * Team language: the dashboard's default, the language Claude writes session records and
   * profiles in, the CLI's messages and the client installer's messages.
   */
  language: Language;
}

/** What GET /api/settings returns: the settings plus read-only facts the launcher needs. */
export interface PublicSettings extends Settings {
  /** CLIENT_TAG: the launcher checks it against the local Tailscale client before opening a session. */
  clientTag: string;
}
