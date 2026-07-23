import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const requestedRef = process.argv[2];
const startsEmpty = requestedRef === "--empty";
const upgradeFromRef =
  startsEmpty
    ? null
    : requestedRef ??
      execFileSync("git", ["describe", "--tags", "--abbrev=0", "HEAD^"], {
        encoding: "utf8",
      }).trim();
const temporaryDirectory = mkdtempSync(join(tmpdir(), "freshwax-upgrade-"));
const previousSchemaPath = join(temporaryDirectory, "schema.prisma");

function prisma(args, options = {}) {
  execFileSync("npx", ["prisma", ...args], {
    env: process.env,
    stdio: options.input
      ? ["pipe", "inherit", "inherit"]
      : "inherit",
    ...options,
  });
}

try {
  prisma(["db", "execute", "--schema", "prisma/schema.prisma", "--stdin"], {
    input: 'DROP SCHEMA IF EXISTS "public" CASCADE; CREATE SCHEMA "public";',
  });

  if (!startsEmpty) {
    const previousSchema = execFileSync(
      "git",
      ["show", `${upgradeFromRef}:prisma/schema.prisma`],
      { encoding: "utf8" },
    );
    writeFileSync(previousSchemaPath, previousSchema);
    prisma(["db", "push", "--skip-generate", "--schema", previousSchemaPath]);
    prisma(["db", "execute", "--schema", "prisma/schema.prisma", "--stdin"], {
      input: `
        INSERT INTO "Release" (
          "id", "title", "normalizedTitle", "releaseDate", "updatedAt"
        ) VALUES (
          'upgrade-fixture-release',
          'Upgrade Fixture',
          'upgrade fixture',
          '2026-01-01T00:00:00.000Z',
          CURRENT_TIMESTAMP
        );
      `,
    });
  }

  execFileSync("node", ["scripts/prepare-prisma-migrations.mjs"], {
    env: process.env,
    stdio: "inherit",
  });
  prisma(["migrate", "deploy"]);
  prisma(["db", "execute", "--schema", "prisma/schema.prisma", "--stdin"], {
    input: `
      DO $$
      BEGIN
        IF ${startsEmpty ? "FALSE" : "TRUE"} AND NOT EXISTS (
          SELECT 1
          FROM "Release"
          WHERE "id" = 'upgrade-fixture-release'
            AND "title" = 'Upgrade Fixture'
        ) THEN
          RAISE EXCEPTION 'schema upgrade did not preserve the existing release';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'Release_releaseGroupMbid_key'
        ) THEN
          RAISE EXCEPTION 'schema upgrade did not create the release identity index';
        END IF;

        IF (
          SELECT COUNT(*)
          FROM "_prisma_migrations"
          WHERE "finished_at" IS NOT NULL
            AND "rolled_back_at" IS NULL
            AND "migration_name" IN (
              '20260628000000_baseline',
              '20260723000000_add_release_group_mbid'
            )
        ) <> 2 THEN
          RAISE EXCEPTION 'schema upgrade did not record both migrations';
        END IF;
      END
      $$;
    `,
  });

  console.log(
    startsEmpty
      ? "Verified clean schema migration."
      : `Verified populated schema upgrade from ${upgradeFromRef}.`,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
