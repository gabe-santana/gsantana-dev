import Link from "next/link";
import { Container } from "@/components/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";

export function Nav({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const links = [
    // The logo already links home, so "Home" is dropped on small screens to
    // leave room for the other links and the language switcher.
    { href: "/", label: dict.nav.home, className: "hidden sm:inline" },
    { href: "/blog", label: dict.nav.blog },
    { href: "/principles", label: dict.nav.principles },
    { href: "/about", label: dict.nav.about },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href={localePath(locale)}
          className="font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          gsantana<span className="text-accent">.dev</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center gap-4 text-sm text-muted sm:gap-6">
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
          <LanguageSwitcher locale={locale} label={dict.nav.language} />
        </div>
      </Container>
    </header>
  );
}
