import { Container } from "@/components/container";
import {
  GitHubIcon,
  LinkedInIcon,
  RssIcon,
  YouTubeIcon,
} from "@/components/icons";
import { author } from "@/lib/author";
import { buildInfo } from "@/lib/build-info";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";

// The owner keeps the button in English on both locales.
const BUY_COFFEE_TEXT = "Buy me a coffee";

// Deliberately faint: it's a release check for the author, not content.
function BuildVersion() {
  const { version, sha, shortSha, builtAt } = buildInfo;
  const label = `v${version}${shortSha ? ` · ${shortSha}` : ""}`;
  const className =
    "font-mono text-[10px] tracking-wide text-muted/40 transition-colors hover:text-muted";
  const title = `Built ${builtAt}`;

  if (sha) {
    return (
      <a
        href={`${author.github}/gsantana-dev/commit/${sha}`}
        target="_blank"
        rel="noreferrer"
        title={title}
        className={className}
      >
        {label}
      </a>
    );
  }
  return (
    <span title={title} className={className}>
      {label}
    </span>
  );
}

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const socialLinks = [
    { href: author.github, label: "GitHub", Icon: GitHubIcon, external: true },
    { href: author.linkedin, label: "LinkedIn", Icon: LinkedInIcon, external: true },
    { href: author.youtube, label: "YouTube", Icon: YouTubeIcon, external: true },
    {
      href: localePath(locale, "/feed.xml"),
      label: dict.nav.rss,
      Icon: RssIcon,
      external: false,
    },
  ];

  return (
    <footer className="border-t border-border/60 py-10 text-sm text-muted">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p>
            &copy; {new Date().getFullYear()} {author.name}. {dict.site.rights}
          </p>
          <BuildVersion />
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <a
            href={`https://www.buymeacoffee.com/${author.buyMeACoffee}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a remote badge; next/image adds nothing here */}
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt={BUY_COFFEE_TEXT}
              width={188}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-10 w-auto"
            />
          </a>
          <div className="flex items-center gap-1">
            {socialLinks.map(({ href, label, Icon, external }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                title={label}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="rounded-lg p-2 transition-colors hover:bg-surface hover:text-foreground"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
