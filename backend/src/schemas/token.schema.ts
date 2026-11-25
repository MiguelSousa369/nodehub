/** The user's personal access token, without the secret. */
export interface PublicToken {
  prefix    : string;
  createdAt : Date;
  lastUsedAt: Date | null;
}
