-- One personal access token per user: keep only the most recent token of each user
DELETE FROM "api_tokens" t
USING "api_tokens" newer
WHERE t."user_id" = newer."user_id"
  AND (t."created_at" < newer."created_at" OR (t."created_at" = newer."created_at" AND t."id" < newer."id"));

-- DropIndex
DROP INDEX "api_tokens_user_id_idx";

-- AlterTable
ALTER TABLE "api_tokens" DROP COLUMN "name";

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_user_id_key" ON "api_tokens"("user_id");
