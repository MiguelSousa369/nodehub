import { z } from 'zod';

export const CreateTokenSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const TokenIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export type CreateTokenInput = z.infer<typeof CreateTokenSchema>;

export interface PublicToken {
  id        : number;
  name      : string;
  prefix    : string;
  createdAt : Date;
  lastUsedAt: Date | null;
}
