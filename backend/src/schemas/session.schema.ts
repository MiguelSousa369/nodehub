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

/** Correcting a recorded session: only the fields sent change (at least one). */
export const UpdateSessionSchema = z.object({
  summary  : z.string().trim().min(1).max(200).optional(),
  problem  : z.string().trim().max(10_000).optional(),
  diagnosis: z.string().trim().max(10_000).optional(),
  actions  : z.string().trim().max(10_000).optional(),
  result   : SessionResultSchema.optional(),
  pending  : z.string().trim().max(10_000).optional(),
}).strict().refine((v) => Object.values(v).some((x) => x !== undefined), 'Send at least one field to change.');

export const SessionIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

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
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;
export type SessionQuery       = z.infer<typeof SessionQuerySchema>;

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface SessionView {
  id        : number;
  host      : string;
  client    : string | null;                         // current client of the machine
  machineName: string;                               // its friendly name ('' = none)
  technician: { id: number; name: string } | null;   // null if the user was deleted
  summary   : string;
  problem   : string;
  diagnosis : string;
  actions   : string;
  result    : SessionResult;
  pending   : string;
  createdAt : Date;
  updatedAt : Date | null;                           // last correction, null if never edited
}
