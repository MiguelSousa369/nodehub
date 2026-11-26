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
