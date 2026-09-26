"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LOCALE_STORAGE_KEY,
  localeConfig,
  locales,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n";

/**
 * Real links (not buttons): they work without JS, and Next prefetches the
 * other language so switching is an instant client-side navigation — the URL
 * changes but the page never fully reloads. scroll={false} keeps the reader
 * where they were.
 */
export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-full border border-border/70 p-0.5 font-mono text-xs"
    >
      {locales.map((target) => {
        const isActive = target === locale;
        return (
          <Link
            key={target}
            href={switchLocalePath(pathname, target)}
            scroll={false}
            hrefLang={localeConfig[target].tag}
            lang={localeConfig[target].tag}
            title={localeConfig[target].name}
            aria-current={isActive ? "true" : undefined}
            onClick={() => {
              try {
                localStorage.setItem(LOCALE_STORAGE_KEY, target);
              } catch {
                // Storage blocked: the choice just isn't remembered for "/".
              }
            }}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              isActive
                ? "bg-accent font-semibold text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {localeConfig[target].short}
          </Link>
        );
      })}
    </div>
  );
}
