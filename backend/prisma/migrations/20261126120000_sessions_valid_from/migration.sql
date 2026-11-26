-- Dashboard sign-ins issued before this moment are no longer accepted (set when the password changes)
ALTER TABLE "users" ADD COLUMN "sessions_valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
