import { prisma } from "@/lib/db";

const BACKGROUND_SCHEMA_TABLES = ['public."UserFollow"', 'public."SyncJob"'];
const SCHEMA_CHECK_TTL_MS = 30_000;

let cachedBackgroundSchemaReady: boolean | null = null;
let cachedCheckedAt = 0;
let warnedMissingBackgroundSchema = false;

function shouldReuseCachedValue() {
  return cachedBackgroundSchemaReady !== null && Date.now() - cachedCheckedAt < SCHEMA_CHECK_TTL_MS;
}

function warnMissingSchema() {
  if (warnedMissingBackgroundSchema) {
    return;
  }

  warnedMissingBackgroundSchema = true;
  console.warn(
    "Freshwax background tables are missing. Run `npx prisma db push` before starting app/worker processes against a pristine database.",
  );
}

export async function isBackgroundSchemaReady() {
  if (shouldReuseCachedValue()) {
    return cachedBackgroundSchemaReady as boolean;
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ regclass: string | null }>>(
    `SELECT to_regclass($1)::text AS regclass
     UNION ALL
     SELECT to_regclass($2)::text AS regclass`,
    BACKGROUND_SCHEMA_TABLES[0],
    BACKGROUND_SCHEMA_TABLES[1],
  );

  const ready = rows.every((row) => row.regclass !== null);
  cachedBackgroundSchemaReady = ready;
  cachedCheckedAt = Date.now();

  if (!ready) {
    warnMissingSchema();
  }

  return ready;
}
