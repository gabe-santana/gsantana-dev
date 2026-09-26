import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificationCard } from "@/components/certification-card";
import { Container } from "@/components/container";
import {
  ExternalLinkIcon,
  GitHubIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/icons";
import { GridBackdrop } from "@/components/grid-backdrop";
import { author, certifications } from "@/lib/author";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, localePath } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { alternatesFor } from "@/lib/seo";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: dict.about.eyebrow,
    description: dict.about.metaDescription,
    alternates: alternatesFor(lang, "/about"),
  };
}

// Descriptions live in the dictionaries (about.projects), keyed by repo name.
const projects = [
  { name: "agentic-mesh", language: "Python" },
  { name: "sightline", language: "Terraform" },
  { name: "hybrid-cloud-mcp-agentic-framework", language: "Terraform" },
  { name: "gabe-language", language: "C" },
] as const;

export default async function AboutPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <div className="relative overflow-x-clip">
        <GridBackdrop />
        <Container className="pb-16 pt-24">
          <section className="grid items-center gap-12 md:grid-cols-[17rem_1fr] lg:gap-16">
            <div className="relative mx-auto w-56 md:w-full">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-accent/25 to-[#a78bfa]/25 blur-3xl"
              />
              <div className="relative rounded-3xl bg-gradient-to-br from-accent/60 via-border to-[#a78bfa]/60 p-px">
                <Image
                  src={mediaUrl(author.portrait)}
                  alt={author.name}
                  width={480}
                  height={600}
                  priority
                  className="aspect-[4/5] w-full rounded-[calc(1.5rem-1px)] object-cover"
                />
              </div>
            </div>

            <div>
              <p className="font-mono text-sm text-accent">
                {dict.about.eyebrow}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {author.name}
              </h1>
              <p className="mt-3 text-lg text-foreground/90">
                {dict.author.role}
              </p>
              <a
                href={`mailto:${author.email}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
              >
                <MailIcon className="h-3.5 w-3.5" />
                {author.email}
              </a>

              <div className="mt-6 max-w-xl space-y-4 leading-relaxed text-muted">
                <p>{dict.about.introFocus}</p>
                <p>
                  {dict.about.introSiteBefore}{" "}
                  <Link
                    href={localePath(lang, "/principles")}
                    className="text-accent hover:underline"
                  >
                    {dict.about.introSiteLink}
                  </Link>{" "}
                  {dict.about.introSiteAfter}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={author.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:scale-105"
                >
                  <LinkedInIcon />
                  {dict.about.connectLinkedIn}
                </a>
                <a
                  href={author.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/60"
                >
                  <GitHubIcon />
                  GitHub
                </a>
              </div>
            </div>
          </section>
        </Container>
      </div>

      <Container className="pb-24">
        <section aria-labelledby="certifications" className="mt-12">
          <div className="mb-8">
            <h2 id="certifications" className="text-2xl font-semibold">
              {dict.about.certificationsTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {dict.about.certificationsSubtitle}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {certifications.map((cert) => (
              <CertificationCard
                key={cert.exam}
                cert={cert}
                locale={lang}
                labels={dict.certification}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="projects" className="mt-28">
          <div className="mb-8">
            <h2 id="projects" className="text-2xl font-semibold">
              {dict.about.projectsTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {dict.about.projectsSubtitle}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <a
                key={project.name}
                href={`${author.github}/${project.name}`}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col rounded-2xl border border-border/60 bg-surface/50 p-5 transition-colors hover:border-accent/50 hover:bg-surface"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
                    {project.name}
                  </span>
                  <span className="text-muted transition-colors group-hover:text-accent">
                    <ExternalLinkIcon />
                  </span>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {dict.about.projects[project.name]}
                </p>
                <p className="mt-3 text-xs text-muted/80">{project.language}</p>
              </a>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
