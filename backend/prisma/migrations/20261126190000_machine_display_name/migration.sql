-- Friendly name shown in the dashboard (e.g. "PC-PEDRO"); the tailnet name (host) stays the key
ALTER TABLE "machines" ADD COLUMN "display_name" TEXT NOT NULL DEFAULT '';
