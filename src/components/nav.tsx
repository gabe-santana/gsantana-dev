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
    { href: "/", label: dict.nav.home, className: "hidden lg:inline" },
    { href: "/blog", label: dict.nav.blog },
    { href: "/news", label: dict.nav.news },
    { href: "/certifications", label: dict.nav.certifications },
    { href: "/principles", label: dict.nav.principles },
    { href: "/about", label: dict.nav.about },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <Container className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0 py-3 lg:h-16 lg:flex-nowrap lg:py-0">
        <Link
          href={localePath(locale)}
          className="font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          gsantana<span className="text-accent">.dev</span>
        </Link>
        <div className="contents lg:flex lg:items-center lg:gap-6">
          <nav className="order-3 mt-3 flex w-full flex-wrap items-center justify-start gap-x-3 gap-y-3 border-t border-border/60 pt-3 text-sm text-muted lg:order-none lg:mt-0 lg:w-auto lg:flex-nowrap lg:gap-6 lg:border-0 lg:pt-0">
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
          <div className="order-2 lg:order-none">
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
