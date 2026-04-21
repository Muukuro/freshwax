const FALLBACK_TIME_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Amsterdam",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Vienna",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Vancouver",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Halifax",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
];

type SupportedValuesKey =
  | "calendar"
  | "collation"
  | "currency"
  | "numberingSystem"
  | "timeZone"
  | "unit";

const dateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timestampFormatterCache = new Map<string, Intl.DateTimeFormat>();
const releaseDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function getDateKeyFormatter(timeZone: string) {
  const cached = dateKeyFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dateKeyFormatterCache.set(timeZone, formatter);
  return formatter;
}

function dateKeyFromFormatter(formatter: Intl.DateTimeFormat, value: Date) {
  const parts = formatter.formatToParts(value);
  const partByType = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${partByType.year}-${partByType.month}-${partByType.day}`;
}

function getTimestampFormatter(timeZone: string) {
  const cached = timestampFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  timestampFormatterCache.set(timeZone, formatter);
  return formatter;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return { year, month, day };
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function isValidTimeZone(timeZone: string) {
  if (!timeZone.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getSupportedTimeZones() {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: SupportedValuesKey) => string[];
    }
  ).supportedValuesOf;

  if (typeof supportedValuesOf === "function") {
    return supportedValuesOf("timeZone");
  }

  return FALLBACK_TIME_ZONES;
}

export function getFallbackTimeZones() {
  return FALLBACK_TIME_ZONES;
}

export function formatDateKeyInTimeZone(value: Date, timeZone: string) {
  return dateKeyFromFormatter(getDateKeyFormatter(timeZone), value);
}

export function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const { year, month, day } = parseDateKey(dateKey);
  const value = new Date(Date.UTC(year, month - 1, day + days));

  return [
    value.getUTCFullYear(),
    padDatePart(value.getUTCMonth() + 1),
    padDatePart(value.getUTCDate()),
  ].join("-");
}

export function getTodayDateKey(timeZone: string, now = new Date()) {
  return formatDateKeyInTimeZone(now, timeZone);
}

export function getTodayUtcDateForTimeZone(timeZone: string, now = new Date()) {
  return dateKeyToUtcDate(getTodayDateKey(timeZone, now));
}

export function getDateOffsetUtcDateForTimeZone(
  timeZone: string,
  offsetDays: number,
  now = new Date(),
) {
  return dateKeyToUtcDate(addDaysToDateKey(getTodayDateKey(timeZone, now), offsetDays));
}

export function formatReleaseDate(value: Date) {
  return releaseDateFormatter.format(value);
}

export function getReleaseDateKey(value: Date) {
  return [
    value.getUTCFullYear(),
    padDatePart(value.getUTCMonth() + 1),
    padDatePart(value.getUTCDate()),
  ].join("-");
}

export function serializeDateOnlyForIcs(value: Date) {
  return getReleaseDateKey(value).replace(/-/g, "");
}

export function formatTimestampInTimeZone(value: Date | string, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return getTimestampFormatter(timeZone).format(date);
}

export function isDiscoveredLate(discoveredAt: Date, releaseDate: Date, timeZone: string) {
  return formatDateKeyInTimeZone(discoveredAt, timeZone) > getReleaseDateKey(releaseDate);
}
