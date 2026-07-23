import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

const BASELINE_MIGRATION = "20260628000000_baseline";
const RELEASE_IDENTITY_MIGRATION =
  "20260723000000_add_release_group_mbid";

const prisma = new PrismaClient();
const prismaCli = process.env.PRISMA_CLI_PATH;

function markApplied(migrationName) {
  const command = prismaCli ?? "npx";
  const args = prismaCli
    ? ["migrate", "resolve", "--applied", migrationName]
    : ["prisma", "migrate", "resolve", "--applied", migrationName];

  execFileSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });
}

try {
  const [database] = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('"User"') IS NOT NULL AS "hasLegacySchema",
      to_regclass('"_prisma_migrations"') IS NOT NULL AS "hasMigrationHistory",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Release'
          AND column_name = 'releaseGroupMbid'
      ) AS "hasReleaseIdentity"
  `);

  if (database.hasLegacySchema && !database.hasMigrationHistory) {
    await prisma.$disconnect();
    markApplied(BASELINE_MIGRATION);

    if (database.hasReleaseIdentity) {
      markApplied(RELEASE_IDENTITY_MIGRATION);
    }
  }
} finally {
  await prisma.$disconnect();
}
