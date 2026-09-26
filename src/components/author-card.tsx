import Image from "next/image";
import Link from "next/link";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";
import { author } from "@/lib/author";
import type { Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";

export function AuthorCard({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <aside
      aria-label={dict.author.aboutTheAuthor}
      className="mt-16 border-t border-border/60 pt-12"
    >
      <div className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-surface/50 p-6 sm:flex-row sm:items-start sm:gap-6">
        <Image
          src={mediaUrl(author.avatar)}
          alt={author.name}
          width={80}
          height={80}
          className="h-20 w-20 flex-none rounded-full object-cover ring-2 ring-accent/40 ring-offset-4 ring-offset-surface"
        />

        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            {dict.author.writtenBy}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {author.name}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {dict.author.bio}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <a
              href={author.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href={author.linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
            >
              <LinkedInIcon />
              LinkedIn
            </a>
            <a
              href={localePath(locale, "/feed.xml")}
              className="text-muted transition-colors hover:text-foreground"
            >
              RSS
            </a>
            <Link
              href={localePath(locale, "/about")}
              className="text-accent hover:underline"
            >
              {dict.author.moreAboutMe}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
