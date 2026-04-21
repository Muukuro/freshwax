import { prisma } from "@/lib/db";

const BACKGROUND_SCHEMA_TABLES = [
  'public."UserFollow"',
  'public."SyncJob"',
  'public."NotificationEvent"',
  'public."PushSubscription"',
  'public."NotificationDelivery"',
];
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
    `SELECT to_regclass(value)::text AS regclass
     FROM unnest($1::text[]) AS value`,
    BACKGROUND_SCHEMA_TABLES,
  );

  const ready = rows.every((row) => row.regclass !== null);
  cachedBackgroundSchemaReady = ready;
  cachedCheckedAt = Date.now();

  if (!ready) {
    warnMissingSchema();
  }

  return ready;
}
