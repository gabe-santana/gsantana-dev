import { ExternalLinkIcon, GitHubIcon } from "@/components/icons";
import { ProjectMediaView } from "@/components/projects/project-media";
import { Reveal } from "@/components/reveal";
import { author } from "@/lib/author";
import { format, type Dictionary } from "@/lib/dictionaries";
import { localePath, type Locale } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import {
  featuredProjects,
  labProjects,
  localized,
  projectCount,
  type Project,
  type ProjectMedia,
} from "@/lib/projects";

type Labels = Dictionary["about"]["projectsShowcase"];
type ImageMedia = Extract<ProjectMedia, { kind: "image" }>;

const repoUrl = (repo: string) => `${author.github}/${repo}`;
const displayName = (project: Project) => project.name ?? project.repo;
const isPhone = (media: ProjectMedia): media is ImageMedia => media.kind === "image" && media.frame === "phone";

async function codeHtml(media: ProjectMedia): Promise<string | undefined> {
  if (media.kind !== "code") return undefined;
  const { html } = await renderMarkdown(`\`\`\`${media.lang} title="${media.title}"\n${media.code}\n\`\`\``);
  return html;
}

function StackChips({ stack, className = "" }: { stack: string[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {stack.map((item) => (
        <li
          key={item}
          className="rounded-full border border-border/70 bg-surface/60 px-2.5 py-0.5 font-mono text-[0.7rem] text-muted"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Meta({ project, labels }: { project: Project; labels: Labels }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs uppercase tracking-wider text-accent">
      <span>{project.years}</span>
      {project.stars ? (
        <>
          <span aria-hidden className="text-muted">·</span>
          <span className="normal-case">{format(labels.stars, { count: project.stars })}</span>
        </>
      ) : null}
    </p>
  );
}

function Links({ project, locale, labels }: { project: Project; locale: Locale; labels: Labels }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={repoUrl(project.repo)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent/60 hover:text-accent"
      >
        <GitHubIcon />
        {labels.viewCode}
      </a>
      {project.post ? (
        <a
          href={localePath(locale, `/blog/${project.post}`)}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-105"
        >
          {labels.readStory}
        </a>
      ) : null}
    </div>
  );
}

/**
 * One featured project's media: the main shot slides in from its side of
 * the row, then the extra shots land over it one after the other.
 */
async function Stage({ project, locale, flip }: { project: Project; locale: Locale; flip: boolean }) {
  const main = project.media;
  const phones = [main, ...(project.extras ?? [])].filter(isPhone);
  const floating = (project.extras ?? []).filter((m) => !isPhone(m));
  const side = flip ? "right" : "left";

  const glow = (
    <Reveal from="scale" className="pointer-events-none absolute -inset-10 -z-10">
      <div
        aria-hidden
        className="h-full w-full rounded-[40%] bg-gradient-to-br from-accent/20 via-transparent to-[#a78bfa]/20 blur-3xl"
      />
    </Reveal>
  );

  const [center, ...sides] = phones;
  if (center && sides.length) {
    return (
      <div className="relative">
        {glow}
        <div className="relative mx-auto flex max-w-lg items-start justify-center pb-6 pt-4">
          {sides[0] ? (
            <div className="relative z-0 -mr-10 mt-16 w-[32%] -rotate-6">
              <Reveal from="right" delay={250}>
                <ProjectMediaView media={sides[0]} locale={locale} sizes="200px" />
              </Reveal>
            </div>
          ) : null}
          <Reveal from="up" className="relative z-10 w-[40%]">
            <ProjectMediaView media={center} locale={locale} sizes="260px" />
          </Reveal>
          {sides[1] ? (
            <div className="relative z-0 -ml-10 mt-24 w-[32%] rotate-6">
              <Reveal from="left" delay={400}>
                <ProjectMediaView media={sides[1]} locale={locale} sizes="200px" />
              </Reveal>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {glow}
      <Reveal from={side} className="relative z-10">
        <ProjectMediaView
          media={main}
          locale={locale}
          address={`github.com/gabe-santana/${project.repo}`}
          codeHtml={await codeHtml(main)}
        />
      </Reveal>
      {floating[0] && main.kind === "diagram" ? (
        // A drawing on a diagram: a small sticker on the corner, clear of the boxes.
        <Reveal
          from="scale"
          delay={350}
          className={`absolute -top-16 z-20 w-[26%] sm:-top-20 ${flip ? "-left-4" : "-right-4"}`}
        >
          <ProjectMediaView media={floating[0]} locale={locale} sizes="200px" />
        </Reveal>
      ) : floating[0] ? (
        <Reveal
          from="up"
          delay={300}
          className={`relative z-20 -mt-8 ml-auto w-[58%] sm:absolute sm:-bottom-12 sm:mt-0 sm:w-[44%] ${
            flip ? "sm:-left-6 sm:ml-0" : "sm:-right-6"
          }`}
        >
          <ProjectMediaView media={floating[0]} locale={locale} sizes="320px" />
        </Reveal>
      ) : null}
      {floating[1] ? (
        <Reveal
          from="scale"
          delay={500}
          className={`absolute -top-10 z-20 hidden w-[34%] md:block ${flip ? "-left-6" : "-right-6"}`}
        >
          <ProjectMediaView media={floating[1]} locale={locale} sizes="260px" />
        </Reveal>
      ) : null}
    </div>
  );
}

async function FeaturedProject({ project, index, locale, labels }: { project: Project; index: number; locale: Locale; labels: Labels }) {
  const flip = index % 2 === 1;
  // Media left over once the stage has used the phones and two floating shots.
  const extras = project.extras ?? [];
  const phonesInStage = [project.media, ...extras].filter(isPhone).length >= 2;
  const others = extras.filter((m) => !isPhone(m));
  const gallery = phonesInStage ? others : others.slice(2);
  const galleryHtml = await Promise.all(gallery.map(codeHtml));
  // The text arrives line by line, a beat after the media.
  const step = (n: number) => 150 + n * 90;

  return (
    <article className="relative py-16 sm:py-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className={`min-w-0 lg:col-span-7 ${flip ? "lg:order-2" : ""}`}>
          <Stage project={project} locale={locale} flip={flip} />
        </div>
        <div className={`min-w-0 lg:col-span-5 ${flip ? "lg:order-1" : ""}`}>
          <Reveal delay={step(0)}>
            <Meta project={project} labels={labels} />
          </Reveal>
          <Reveal delay={step(1)}>
            <h3 className="mt-3 break-words text-3xl font-bold tracking-tight sm:text-4xl">{displayName(project)}</h3>
            <p className="mt-3 text-lg leading-snug text-foreground/90">{localized(project.tagline, locale)}</p>
          </Reveal>
          <Reveal delay={step(2)}>
            <p className="mt-4 leading-relaxed text-muted">{localized(project.description, locale)}</p>
          </Reveal>
          {project.highlights?.length ? (
            <ul className="mt-5 space-y-2 text-sm text-foreground/85">
              {project.highlights.map((item, i) => (
                <li key={item.en}>
                  <Reveal from={flip ? "right" : "left"} delay={step(3 + i)} className="flex gap-3">
                    <span aria-hidden className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{localized(item, locale)}</span>
                  </Reveal>
                </li>
              ))}
            </ul>
          ) : null}
          <Reveal delay={step(4 + (project.highlights?.length ?? 0))}>
            <StackChips stack={project.stack} className="mt-6" />
          </Reveal>
          <Reveal delay={step(5 + (project.highlights?.length ?? 0))} className="mt-7">
            <Links project={project} locale={locale} labels={labels} />
          </Reveal>
        </div>
      </div>

      {gallery.length ? (
        <div className={`mt-16 grid gap-8 ${gallery.length > 1 ? "md:grid-cols-2" : ""}`}>
          {gallery.map((media, i) => (
            <Reveal key={i} from="up" delay={i * 150}>
              <ProjectMediaView media={media} locale={locale} codeHtml={galleryHtml[i]} />
            </Reveal>
          ))}
        </div>
      ) : null}
    </article>
  );
}

async function LabCard({ project, column, locale, labels }: { project: Project; column: number; locale: Locale; labels: Labels }) {
  return (
    <Reveal from="up" delay={column * 120} className="h-full min-w-0">
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/50 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-black/30">
        <div className="relative flex h-56 items-center justify-center overflow-hidden border-b border-border/60 bg-background/60 p-4">
          <div className="w-full max-w-sm transition-transform duration-500 group-hover:scale-[1.04]">
            <ProjectMediaView media={project.media} locale={locale} codeHtml={await codeHtml(project.media)} sizes="360px" />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <Meta project={project} labels={labels} />
          <h3 className="mt-2 font-mono text-base font-semibold text-foreground">{displayName(project)}</h3>
          <p className="mt-1 text-sm text-foreground/85">{localized(project.tagline, locale)}</p>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{localized(project.description, locale)}</p>
          <StackChips stack={project.stack} className="mt-4" />
          <a
            href={repoUrl(project.repo)}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            {labels.viewCode}
            <ExternalLinkIcon />
          </a>
        </div>
      </article>
    </Reveal>
  );
}

export async function ProjectShowcase({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const labels = dict.about.projectsShowcase;
  return (
    // Clipped sideways: the glows and floating shots reach past the column on purpose.
    <section aria-labelledby="projects" className="mt-28 overflow-x-clip">
      <Reveal className="max-w-2xl">
        <p className="font-mono text-sm text-accent">{labels.eyebrow}</p>
        <h2 id="projects" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {labels.title}
        </h2>
        <p className="mt-3 leading-relaxed text-muted">{format(labels.subtitle, { count: projectCount })}</p>
      </Reveal>

      <div className="divide-y divide-border/40">
        {featuredProjects.map((project, index) => (
          <FeaturedProject key={project.repo} project={project} index={index} locale={locale} labels={labels} />
        ))}
      </div>

      <div className="mt-16 border-t border-border/40 pt-20">
        <Reveal>
          <h2 className="text-2xl font-semibold">{labels.labTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{labels.labSubtitle}</p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {labProjects.map((project, index) => (
            <LabCard key={project.repo} project={project} column={index % 3} locale={locale} labels={labels} />
          ))}
        </div>
      </div>

    </section>
  );
}
