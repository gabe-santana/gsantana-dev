import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders GFM and syntax-highlighted code blocks", async () => {
    const { html } = await renderMarkdown("# Title\n\n```ts\nconst x = 1;\n```");
    expect(html).toContain("<h1");
    expect(html).toContain("data-rehype-pretty-code-figure");
  });

  it("leaves raw <img> src untouched with no CDN configured", async () => {
    const { html } = await renderMarkdown('<img src="/jrdev.png" alt="" />');
    expect(html).toContain('src="/jrdev.png"');
  });

  it("rewrites root-relative raw <img> src through the media CDN", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_CDN_URL", "https://cdn.gsantana.dev");
    const { html } = await renderMarkdown('<img src="/jrdev.png" alt="" />');
    expect(html).toContain('src="https://cdn.gsantana.dev/jrdev.png"');
  });

  it("extracts h2/h3 headings with ids matching the rendered anchors", async () => {
    const { html, headings } = await renderMarkdown(
      "# Title\n\n## Soluções de rede\n\n### O que é uma `VNet`?\n\n#### Too deep"
    );

    expect(headings).toEqual([
      { id: "soluções-de-rede", text: "Soluções de rede", depth: 2 },
      { id: "o-que-é-uma-vnet", text: "O que é uma VNet?", depth: 3 },
    ]);
    for (const heading of headings) {
      expect(html).toContain(`id="${heading.id}"`);
    }
  });
});
