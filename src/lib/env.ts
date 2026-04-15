import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DEEZER_APP_ID: z.string().min(1).optional(),
  DEEZER_APP_SECRET: z.string().min(1).optional(),
  LASTFM_API_KEY: z.string().min(1).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("nrt_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  DEFAULT_TIMEZONE: z.string().min(1).default("UTC"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/new_release_tracker?schema=public",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  DEEZER_APP_ID: process.env.DEEZER_APP_ID,
  DEEZER_APP_SECRET: process.env.DEEZER_APP_SECRET,
  LASTFM_API_KEY: process.env.LASTFM_API_KEY,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? "nrt_session",
  SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS ?? "30",
  SYNC_INTERVAL_MINUTES: process.env.SYNC_INTERVAL_MINUTES ?? "360",
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE ?? "UTC",
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

export const isProduction = env.NODE_ENV === "production";
