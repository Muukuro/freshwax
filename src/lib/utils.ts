import { clsx, type ClassValue } from "clsx";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function absoluteUrl(path: string) {
  const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
  return new URL(path, base).toString();
}

export function releaseTypeLabel(type: string) {
  return type.toLowerCase().replace("_", " ");
}

export function toSentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
