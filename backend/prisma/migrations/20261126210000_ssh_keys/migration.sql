-- The team's SSH public keys, owned by a user account (or none: service keys created by admins).
-- Keys of deactivated accounts stay listed but are no longer applied to client PCs.
CREATE TABLE "ssh_keys" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ssh_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ssh_keys_body_key" ON "ssh_keys"("body");
CREATE INDEX "ssh_keys_user_id_idx" ON "ssh_keys"("user_id");

ALTER TABLE "ssh_keys" ADD CONSTRAINT "ssh_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
