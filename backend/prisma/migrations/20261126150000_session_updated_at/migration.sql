-- When a session record was last corrected (NULL = never edited since it was recorded)
ALTER TABLE "sessions" ADD COLUMN "updated_at" TIMESTAMP(3);
