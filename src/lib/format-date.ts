import { localeConfig, type Locale } from "@/lib/i18n";

export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeConfig[locale].tag, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

/** "2024-12" -> "Dec 2024" / "dez. de 2024" */
export function formatMonth(yyyyMm: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeConfig[locale].tag, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${yyyyMm}-01T00:00:00Z`));
}
