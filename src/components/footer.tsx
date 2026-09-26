import { Container } from "@/components/container";
import {
  GitHubIcon,
  LinkedInIcon,
  RssIcon,
  YouTubeIcon,
} from "@/components/icons";
import { author } from "@/lib/author";

const socialLinks = [
  { href: author.github, label: "GitHub", Icon: GitHubIcon, external: true },
  { href: author.linkedin, label: "LinkedIn", Icon: LinkedInIcon, external: true },
  { href: author.youtube, label: "YouTube", Icon: YouTubeIcon, external: true },
  { href: "/feed.xml", label: "RSS feed", Icon: RssIcon, external: false },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 text-sm text-muted">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} {author.name}. All rights reserved.</p>
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
      </Container>
    </footer>
  );
}
