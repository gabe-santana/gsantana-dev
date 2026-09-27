import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { rehypeCdnImages } from "@/lib/rehype-cdn-images";
import { rehypeCodeWindow } from "@/lib/rehype-code-window";
import { rehypeRestoreCodeMeta, rehypeStashCodeMeta } from "@/lib/rehype-code-meta";
import { rehypeLazyImages } from "@/lib/rehype-lazy-images";
import {
  rehypeExtractHeadings,
  type TocHeading,
} from "@/lib/rehype-extract-headings";

export interface RenderedMarkdown {
  html: string;
  headings: TocHeading[];
}

/**
 * Renders post markdown to HTML at build time only. Nothing here runs in
 * the browser, so a fully-featured pipeline (syntax highlighting, heading
 * anchors) costs zero runtime JS.
 */
export async function renderMarkdown(markdown: string): Promise<RenderedMarkdown> {
  const headings: TocHeading[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    // remark-rehype (with allowDangerousHtml) keeps raw HTML as opaque
    // "raw" nodes rather than real hast elements. rehype-raw parses them
    // into actual <img>/<div> etc. elements so downstream plugins (like
    // rehypeCdnImages) can actually inspect and rewrite them. It drops code
    // fence metadata, hence the stash/restore around it.
    .use(rehypeStashCodeMeta)
    .use(rehypeRaw)
    .use(rehypeRestoreCodeMeta)
    .use(rehypeCdnImages)
    .use(rehypeLazyImages)
    .use(rehypeSlug)
    .use(rehypeExtractHeadings, { headings })
    .use(rehypeAutolinkHeadings, {
      behavior: "wrap",
      properties: { className: ["anchor"] },
    })
    .use(rehypePrettyCode, {
      // The site only ships a dark theme, so a single Shiki theme keeps the
      // highlighter output (and its CSS) simple, with no light/dark token swap.
      theme: "github-dark",
      keepBackground: false,
      // Untagged fences get the same editor window and line numbers.
      defaultLang: { block: "plaintext" },
    })
    .use(rehypeCodeWindow)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return { html: String(file), headings };
}
