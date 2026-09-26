import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
import { mediaUrl } from "@/lib/media";

export const metadata: Metadata = {
  title: "About",
  description: `${author.name} — ${author.role}, Microsoft Certified Azure Solutions Architect Expert.`,
};

const projects = [
  {
    name: "agentic-mesh",
    language: "Python",
    description:
      "Open-source distributed platform for AI agents and enterprise RAG.",
  },
  {
    name: "sightline",
    language: "Terraform",
    description:
      "Autonomous video and audio intelligence platform for AI agents.",
  },
  {
    name: "hybrid-cloud-mcp-agentic-framework",
    language: "Terraform",
    description:
      "Reference architecture connecting Google Cloud Vertex AI and Oracle Cloud through the Model Context Protocol, with event-driven, highly available multi-cloud workflows.",
  },
  {
    name: "gabe-language",
    language: "C",
    description:
      "An x86 compiler built from scratch to learn how compilers work.",
  },
];

export default function AboutPage() {
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
              <p className="font-mono text-sm text-accent">About</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
                {author.name}
              </h1>
              <p className="mt-3 text-lg text-foreground/90">{author.role}</p>
              <a
                href={`mailto:${author.email}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent"
              >
                <MailIcon className="h-3.5 w-3.5" />
                {author.email}
              </a>

              <div className="mt-6 max-w-xl space-y-4 leading-relaxed text-muted">
                <p>
                  I design and build cloud systems, lately with a focus on AI
                  agents: distributed agent platforms, enterprise RAG, and the
                  infrastructure that keeps them running across clouds.
                </p>
                <p>
                  This site is where I write about it: hands-on posts on Azure
                  and architecture, and the{" "}
                  <Link
                    href="/principles"
                    className="text-accent hover:underline"
                  >
                    Principles
                  </Link>{" "}
                  I rely on when making design decisions.
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
                  Connect on LinkedIn
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
              Certifications
            </h2>
            <p className="mt-1 text-sm text-muted">
              Microsoft Azure, from administration to solution architecture.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {certifications.map((cert) => (
              <CertificationCard key={cert.exam} cert={cert} />
            ))}
          </div>
        </section>

        <section aria-labelledby="projects" className="mt-28">
          <div className="mb-8">
            <h2 id="projects" className="text-2xl font-semibold">
              Selected projects
            </h2>
            <p className="mt-1 text-sm text-muted">Open source, on GitHub.</p>
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
                  {project.description}
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
