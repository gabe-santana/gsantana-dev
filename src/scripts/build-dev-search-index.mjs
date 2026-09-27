// `next dev` has no exported HTML to index, so this builds a stand-in search
// index straight from the markdown under content/ into
// public/pagefind/, where the dev server serves it. It runs as `predev`, so
// content edited during a dev session shows up in search after a restart.
// Production never uses it: build-search-index.mjs replaces out/pagefind/
// with an index of the real rendered pages.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import * as pagefind from "pagefind";

const root = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(root, "content");
const outputPath = path.join(root, "public", "pagefind");
const locales = ["en-us", "pt-br"];

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f));
}

function recordFromMarkdown(file, url, language) {
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const summary = [data.description ?? data.short ?? "", ...(data.tldr ?? [])].join(" ");
  return { url, language, meta: { title: String(data.title) }, content: `${data.title}. ${summary} ${plainText(content)}` };
}

const records = [];
for (const locale of locales) {
  const dir = (type) => path.join(contentRoot, type, locale);
  for (const file of markdownFiles(dir("posts"))) {
    records.push(recordFromMarkdown(file, `/${locale}/blog/${path.basename(file, ".md")}/`, locale));
  }
  for (const file of markdownFiles(dir("certifications"))) {
    records.push(recordFromMarkdown(file, `/${locale}/certifications/${path.basename(file, ".md")}/`, locale));
  }
  const principlesDir = dir("principles");
  for (const category of fs.existsSync(principlesDir) ? fs.readdirSync(principlesDir) : []) {
    for (const file of markdownFiles(path.join(principlesDir, category))) {
      records.push(
        recordFromMarkdown(file, `/${locale}/principles/${category}/${path.basename(file, ".md")}/`, locale)
      );
    }
  }
  for (const file of markdownFiles(dir("news"))) {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    records.push({
      url: `/${locale}/news/${path.basename(file, ".md")}/`,
      language: locale,
      meta: { title: String(data.title) },
      content: [data.title, data.summary, ...(data.lead ?? []), plainText(content)].join(" "),
    });
  }
}

const { index, errors: createErrors } = await pagefind.createIndex();
if (!index) throw new Error(`pagefind: ${createErrors.join("; ")}`);
for (const record of records) {
  const { errors } = await index.addCustomRecord(record);
  if (errors.length) throw new Error(`pagefind (${record.url}): ${errors.join("; ")}`);
}
fs.rmSync(outputPath, { recursive: true, force: true });
const written = await index.writeFiles({ outputPath });
if (written.errors.length) throw new Error(`pagefind: ${written.errors.join("; ")}`);
await pagefind.close();
console.log(`Dev search index: ${records.length} articles -> public/pagefind`);
