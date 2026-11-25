import { z } from 'zod';

// ---------------------------------------------------------------------------
// Connected PCs (access tokens)
// ---------------------------------------------------------------------------

export const TokenIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

/** A connected PC, without the secret. */
export interface PublicToken {
  id        : number;
  name      : string;
  prefix    : string;
  createdAt : Date;
  lastUsedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Browser authorisation of a PC (nodehub login)
// ---------------------------------------------------------------------------

/** Letters and digits that can't be confused with each other (no 0/O, 1/I). */
export const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const StartCliLoginSchema = z.object({
  deviceName: z.string().trim().min(1).max(64).regex(/^[^"`;$\r\n<>]*$/, 'Invalid device name.'),
});

export const PollCliLoginSchema = z.object({
  deviceCode: z.string().min(20).max(200),
});

export const UserCodeParamsSchema = z.object({
  userCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid code.'),
});

export type StartCliLoginInput = z.infer<typeof StartCliLoginSchema>;
