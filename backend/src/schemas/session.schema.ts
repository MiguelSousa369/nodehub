import { z } from 'zod';

import { HostnameSchema } from './machine.schema';

// ---------------------------------------------------------------------------
// Shared rules
// ---------------------------------------------------------------------------

/** Accepts fixed / FIXED, partial, unresolved. */
export const SessionResultSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
  z.enum(['FIXED', 'PARTIAL', 'UNRESOLVED']),
);

const LongText = z.string().trim().max(10_000).default('');

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const CreateSessionSchema = z.object({
  summary  : z.string().trim().min(1).max(200),
  problem  : LongText,
  diagnosis: LongText,
  actions  : LongText,
  result   : SessionResultSchema,
  pending  : LongText,
});

export const SessionQuerySchema = z.object({
  host        : HostnameSchema.optional(),
  technicianId: z.coerce.number().int().positive().optional(),
  result      : SessionResultSchema.optional(),
  q           : z.string().trim().max(200).optional(),
  limit       : z.coerce.number().int().min(1).max(200).default(50),
  offset      : z.coerce.number().int().min(0).default(0),
});

export const ProfileSchema = z.object({
  profile: z.string().max(20_000),
});

export type SessionResult      = z.infer<typeof SessionResultSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type SessionQuery       = z.infer<typeof SessionQuerySchema>;

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface SessionView {
  id        : number;
  host      : string;
  client    : string | null;                         // current client of the machine
  technician: { id: number; name: string } | null;   // null if the user was deleted
  summary   : string;
  problem   : string;
  diagnosis : string;
  actions   : string;
  result    : SessionResult;
  pending   : string;
  createdAt : Date;
}
