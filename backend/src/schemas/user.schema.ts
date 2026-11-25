import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared rules
// ---------------------------------------------------------------------------

export const RoleSchema = z.enum(['ADMIN', 'TECHNICIAN']);

const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, 'Username: 3 to 32 characters (letters, digits, . _ -).');

const PasswordSchema = z.string().min(10, 'Password must have at least 10 characters.').max(200);

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export const UserIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const CreateUserSchema = z.object({
  username: UsernameSchema,
  name    : z.string().trim().min(1).max(100),
  password: PasswordSchema,
  role    : RoleSchema.default('TECHNICIAN'),
});

export const UpdateUserSchema = z.object({
  name    : z.string().trim().min(1).max(100).optional(),
  password: PasswordSchema.optional(),
  role    : RoleSchema.optional(),
  active  : z.boolean().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword    : PasswordSchema,
});

export type Role                = z.infer<typeof RoleSchema>;
export type LoginInput          = z.infer<typeof LoginSchema>;
export type CreateUserInput     = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput     = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ---------------------------------------------------------------------------
// Response shape (never includes the password hash)
// ---------------------------------------------------------------------------

export interface PublicUser {
  id       : number;
  username : string;
  name     : string;
  role     : Role;
  active   : boolean;
  createdAt: Date;
}
