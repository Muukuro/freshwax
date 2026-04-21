import { env } from "@/lib/env";
import { isValidTimeZone } from "@/lib/timezone";

const UTC_TIME_ZONE = "UTC";

export function resolveAppDefaultTimeZone(
  defaultTimeZone?: string,
  processTimeZone?: string,
) {
  if (defaultTimeZone) {
    return defaultTimeZone;
  }

  const trimmedProcessTimeZone = processTimeZone?.trim();
  if (trimmedProcessTimeZone && isValidTimeZone(trimmedProcessTimeZone)) {
    return trimmedProcessTimeZone;
  }

  return UTC_TIME_ZONE;
}

export function getAppDefaultTimeZone() {
  return resolveAppDefaultTimeZone(env.DEFAULT_TIMEZONE, process.env.TZ);
}

export function getEffectiveTimeZone(userTimeZone?: string | null) {
  if (userTimeZone && isValidTimeZone(userTimeZone)) {
    return userTimeZone;
  }

  return getAppDefaultTimeZone();
}
