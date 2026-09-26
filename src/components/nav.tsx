import Link from "next/link";
import { Container } from "@/components/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";

export function Nav({
  locale,
  dict,
  switcherPath,
}: {
  locale: Locale;
  dict: Dictionary;
  /** Passed to the language switcher; see LanguageSwitcher.fixedPath. */
  switcherPath?: string;
}) {
  const links = [
    // The logo already links home, so "Home" is dropped on small screens to
    // leave room for the other links and the language switcher.
    { href: "/", label: dict.nav.home, className: "hidden sm:inline" },
    { href: "/blog", label: dict.nav.blog },
    { href: "/news", label: dict.nav.news },
    { href: "/principles", label: dict.nav.principles },
    { href: "/about", label: dict.nav.about },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0 py-3 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link
          href={localePath(locale)}
          className="font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          gsantana<span className="text-accent">.dev</span>
        </Link>
        <div className="contents sm:flex sm:items-center sm:gap-6">
          <nav className="order-3 mt-3 flex w-full items-center justify-between gap-2 border-t border-border/60 pt-3 text-sm text-muted sm:order-none sm:mt-0 sm:w-auto sm:justify-start sm:gap-6 sm:border-0 sm:pt-0">
            {links.map((link) => (
              <Link
                key={link.href}
                href={localePath(locale, link.href)}
                className={`transition-colors hover:text-foreground ${link.className ?? ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 sm:order-none">
            <LanguageSwitcher
              locale={locale}
              label={dict.nav.language}
              fixedPath={switcherPath}
            />
          </div>
        </div>
      </Container>
    </header>
  );
}
