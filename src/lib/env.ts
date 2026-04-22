import { z } from "zod";

import { isValidTimeZone } from "@/lib/timezone";

const optionalEnvString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1).optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://127.0.0.1:3000"),
  DEEZER_APP_ID: optionalEnvString,
  DEEZER_APP_SECRET: optionalEnvString,
  SPOTIFY_CLIENT_ID: optionalEnvString,
  SPOTIFY_CLIENT_SECRET: optionalEnvString,
  TIDAL_CLIENT_ID: optionalEnvString,
  TIDAL_CLIENT_SECRET: optionalEnvString,
  GOOGLE_CLIENT_ID: optionalEnvString,
  GOOGLE_CLIENT_SECRET: optionalEnvString,
  AMAZON_CLIENT_ID: optionalEnvString,
  AMAZON_CLIENT_SECRET: optionalEnvString,
  APPLE_CLIENT_ID: optionalEnvString,
  APPLE_TEAM_ID: optionalEnvString,
  APPLE_KEY_ID: optionalEnvString,
  APPLE_PRIVATE_KEY: optionalEnvString,
  APPLE_MUSIC_DEVELOPER_TOKEN: optionalEnvString,
  DEEZER_RATE_LIMIT_RETRIES: z.coerce.number().int().nonnegative().default(6),
  DEEZER_RATE_LIMIT_BASE_DELAY_MS: z.coerce.number().int().positive().default(15_000),
  LASTFM_API_KEY: optionalEnvString,
  WEB_PUSH_PUBLIC_KEY: optionalEnvString,
  WEB_PUSH_PRIVATE_KEY: optionalEnvString,
  NOTIFICATION_WEBHOOK_URL: optionalEnvString.pipe(z.string().url().optional()),
  NOTIFICATION_WEBHOOK_SECRET: optionalEnvString,
  SESSION_COOKIE_NAME: z.string().min(1).default("nrt_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  ARTIST_SYNC_CONCURRENCY: z.coerce.number().int().positive().default(1),
  DEFAULT_TIMEZONE: optionalEnvString.refine(
    (value) => value === undefined || isValidTimeZone(value),
    "DEFAULT_TIMEZONE must be a valid IANA timezone",
  ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/freshwax?schema=public",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3000",
  DEEZER_APP_ID: process.env.DEEZER_APP_ID,
  DEEZER_APP_SECRET: process.env.DEEZER_APP_SECRET,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  TIDAL_CLIENT_ID: process.env.TIDAL_CLIENT_ID,
  TIDAL_CLIENT_SECRET: process.env.TIDAL_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  AMAZON_CLIENT_ID: process.env.AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET,
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  APPLE_KEY_ID: process.env.APPLE_KEY_ID,
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
  APPLE_MUSIC_DEVELOPER_TOKEN: process.env.APPLE_MUSIC_DEVELOPER_TOKEN,
  DEEZER_RATE_LIMIT_RETRIES: process.env.DEEZER_RATE_LIMIT_RETRIES ?? "6",
  DEEZER_RATE_LIMIT_BASE_DELAY_MS: process.env.DEEZER_RATE_LIMIT_BASE_DELAY_MS ?? "15000",
  LASTFM_API_KEY: process.env.LASTFM_API_KEY,
  WEB_PUSH_PUBLIC_KEY: process.env.WEB_PUSH_PUBLIC_KEY,
  WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
  NOTIFICATION_WEBHOOK_URL: process.env.NOTIFICATION_WEBHOOK_URL,
  NOTIFICATION_WEBHOOK_SECRET: process.env.NOTIFICATION_WEBHOOK_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? "nrt_session",
  SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS ?? "30",
  SYNC_INTERVAL_MINUTES: process.env.SYNC_INTERVAL_MINUTES ?? "360",
  ARTIST_SYNC_CONCURRENCY: process.env.ARTIST_SYNC_CONCURRENCY ?? "1",
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

export const isProduction = env.NODE_ENV === "production";
