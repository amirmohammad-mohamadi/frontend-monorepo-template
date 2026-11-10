import { isRtlLocale } from "@utils";

/**
 * The locales this app serves. Adding one is three steps: add the code here,
 * add `messages/<code>.json`, and (if the backend is localised) make sure it
 * accepts the code. Nothing else in the app names a locale.
 */
export const LOCALES = ["en", "fa"] as const;

export type AppLocale = (typeof LOCALES)[number];

/** Native-language labels for the locale switcher. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fa: "فارسی",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The deployment's default locale: `NEXT_PUBLIC_DEFAULT_LOCALE` when it is one of ours, else the first. */
export function defaultLocale(): AppLocale {
  const value = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
  return isAppLocale(value) ? value : LOCALES[0];
}

/** `"rtl"` or `"ltr"` for `<html dir>`, decided by the language, not by a list kept here. */
export function localeDirection(locale: string): "rtl" | "ltr" {
  return isRtlLocale(locale) ? "rtl" : "ltr";
}
