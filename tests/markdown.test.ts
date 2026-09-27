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
    // Explicitly unset: CI builds define the CDN URL as a real env var.
    vi.stubEnv("NEXT_PUBLIC_MEDIA_CDN_URL", "");
    const { html } = await renderMarkdown('<img src="/jrdev.png" alt="" />');
    expect(html).toContain('src="/jrdev.png"');
  });

  it("rewrites root-relative raw <img> src through the media CDN", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_CDN_URL", "https://cdn.gsantana.dev");
    const { html } = await renderMarkdown('<img src="/jrdev.png" alt="" />');
    expect(html).toContain('src="https://cdn.gsantana.dev/jrdev.png"');
  });

  it("lazy-loads images unless the markdown says otherwise", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_CDN_URL", "");
    const { html } = await renderMarkdown(
      '<img src="/a.png" alt="" />\n\n<img src="/b.png" alt="" loading="eager" />'
    );
    expect(html).toMatch(/<img[^>]*src="\/a\.png"[^>]*loading="lazy"[^>]*decoding="async"/);
    expect(html).toMatch(/<img[^>]*src="\/b\.png"[^>]*loading="eager"/);
  });

  it("renders code fences as editor windows with a file tab and a copy button", async () => {
    const { html } = await renderMarkdown('```python title="app.py"\nprint("hi")\n```');
    expect(html).toMatch(/<figure[^>]*class="code-window"/);
    expect(html).toContain('<span class="code-window-name">app.py</span>');
    expect(html).toContain('<span class="code-window-lang">Python</span>');
    expect(html).toContain('<button class="code-copy" type="button" hidden>');
  });

  it("names the tab after the language when a fence has no title, or no language", async () => {
    const { html } = await renderMarkdown("```csharp\nvar x = 1;\n```\n\n```\nplain\n```");
    expect(html).toContain('<span class="code-window-name">C#</span>');
    expect(html).toContain('<span class="code-window-name">Plain Text</span>');
    expect(html).not.toContain("code-window-lang");
  });

  it("sizes the line-number gutter to the line count", async () => {
    const code = Array.from({ length: 120 }, (_, i) => `line ${i}`).join("\n");
    const { html } = await renderMarkdown("```text\n" + code + "\n```");
    expect(html).toContain("--code-digits:3");
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
