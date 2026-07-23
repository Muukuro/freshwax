-- Safe, idempotent schema preparation for databases created by older Freshwax
-- releases. Keep this file limited to changes that preserve existing data.
DO $$
BEGIN
  IF to_regclass('"Release"') IS NOT NULL THEN
    ALTER TABLE "Release"
      ADD COLUMN IF NOT EXISTS "releaseGroupMbid" TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS "Release_releaseGroupMbid_key"
      ON "Release"("releaseGroupMbid");
  END IF;
END
$$;
