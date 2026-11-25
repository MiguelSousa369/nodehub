-- One access token per connected PC, created by the browser authorisation flow (nodehub login)

-- CreateEnum
CREATE TYPE "CliLoginStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CONSUMED');

-- DropIndex
DROP INDEX "api_tokens_user_id_key";

-- AlterTable
-- Existing tokens were created before PCs had names
ALTER TABLE "api_tokens" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Unnamed PC';
ALTER TABLE "api_tokens" ALTER COLUMN "name" DROP DEFAULT;

-- CreateTable
CREATE TABLE "cli_login_requests" (
    "id" SERIAL NOT NULL,
    "device_code_hash" TEXT NOT NULL,
    "user_code" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "status" "CliLoginStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cli_login_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cli_login_requests_device_code_hash_key" ON "cli_login_requests"("device_code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "cli_login_requests_user_code_key" ON "cli_login_requests"("user_code");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "cli_login_requests" ADD CONSTRAINT "cli_login_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

