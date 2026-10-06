import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDiagram } from "@/lib/diagrams";
import { featuredProjects, labProjects, projectCount, type Localized, type ProjectMedia } from "@/lib/projects";

const PUBLIC = join(__dirname, "..", "src", "public");
const projects = [...featuredProjects, ...labProjects];
const allMedia: ProjectMedia[] = projects.flatMap((p) => [p.media, ...(p.extras ?? []), ...(p.gallery ?? [])]);
const texts: Localized[] = [
  ...projects.flatMap((p) => [p.tagline, p.description, ...(p.highlights ?? [])]),
  ...allMedia.flatMap((m) => (m.kind === "image" ? [m.alt] : [])),
];

describe("about page projects", () => {
  it("lists every repository once", () => {
    const repos = projects.map((p) => p.repo);
    expect(new Set(repos).size).toBe(repos.length);
    expect(projectCount).toBe(repos.length);
  });

  it("has every text in both languages, without em dashes", () => {
    for (const text of texts) {
      expect(text.en.trim(), JSON.stringify(text)).not.toBe("");
      expect(text.pt.trim(), JSON.stringify(text)).not.toBe("");
      expect(`${text.en} ${text.pt}`).not.toContain("—");
    }
  });

  it("points at media that exists", () => {
    for (const media of allMedia) {
      if (media.kind === "image") expect(existsSync(join(PUBLIC, media.src.split("?")[0]!)), media.src).toBe(true);
      if (media.kind === "diagram") expect(getDiagram(media.id, "en-us"), media.id).toBeDefined();
    }
  });
});
