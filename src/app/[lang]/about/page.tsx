import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificationCard } from "@/components/certification-card";
import { Container } from "@/components/container";
import {
  GitHubIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/icons";
import { GridBackdrop } from "@/components/grid-backdrop";
import { ProjectShowcase } from "@/components/projects/project-showcase";
import { Reveal } from "@/components/reveal";
import { author, certifications } from "@/lib/author";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, localePath } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { alternatesFor, localeSocialAlt, pageSocialMetadata } from "@/lib/seo";

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
    ...pageSocialMetadata(
      lang,
      "/about",
      dict.about.eyebrow,
      dict.about.metaDescription,
      localeSocialAlt(lang)
    ),
    alternates: alternatesFor(lang, "/about"),
  };
}

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
            <div className="enter-portrait relative mx-auto w-56 md:w-full">
              <div
                aria-hidden
                className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-accent/25 to-[#a78bfa]/25 blur-3xl"
              />
              <div className="relative rounded-3xl bg-gradient-to-br from-accent/60 via-border to-[#a78bfa]/60 p-px">
                <div className="about-portrait-frame">
                  <Image
                    src={mediaUrl(author.portrait)}
                    alt={author.name}
                    width={480}
                    height={600}
                    priority
                    className="about-portrait-image aspect-[4/5] w-full object-cover"
                  />
                  <div aria-hidden className="about-portrait-wash" />
                  <div aria-hidden className="about-portrait-glow" />
                  <div aria-hidden className="about-portrait-scan" />
                </div>
              </div>
            </div>

            <div>
              <p className="enter font-mono text-sm text-accent" style={{ "--enter-delay": "150ms" } as React.CSSProperties}>
                {dict.about.eyebrow}
              </p>
              <h1 className="enter mt-2 text-4xl font-bold tracking-tight sm:text-5xl" style={{ "--enter-delay": "250ms" } as React.CSSProperties}>
                {author.name}
              </h1>
              <p className="enter mt-3 text-lg text-foreground/90" style={{ "--enter-delay": "350ms" } as React.CSSProperties}>
                {dict.author.role}
              </p>
              <a
                href={`mailto:${author.email}`}
                className="enter mt-2 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
                style={{ "--enter-delay": "420ms" } as React.CSSProperties}
              >
                <MailIcon className="h-3.5 w-3.5" />
                {author.email}
              </a>

              <div className="enter mt-6 max-w-xl space-y-4 leading-relaxed text-muted" style={{ "--enter-delay": "500ms" } as React.CSSProperties}>
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

              <div className="enter mt-8 flex flex-wrap gap-3" style={{ "--enter-delay": "620ms" } as React.CSSProperties}>
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

      <Container className="pb-24 lg:max-w-6xl">
        <section aria-labelledby="certifications" className="mt-12">
          <Reveal className="mb-8">
            <h2 id="certifications" className="text-2xl font-semibold">
              {dict.about.certificationsTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {dict.about.certificationsSubtitle}
            </p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {certifications.map((cert, index) => (
              <Reveal key={cert.exam} from="up" delay={150 + index * 140} className="h-full">
                <CertificationCard cert={cert} locale={lang} labels={dict.certification} />
              </Reveal>
            ))}
          </div>
        </section>

        <ProjectShowcase locale={lang} dict={dict} />
      </Container>
    </>
  );
}
