// Builds the static search index from the exported HTML. Runs after
// `next build` because Pagefind indexes the rendered pages, not the markdown:
// what gets indexed is exactly what readers see. Only elements marked
// `data-pagefind-body` (the article layout) are indexed, and Pagefind splits
// the result into one index per <html lang>, so each locale searches only
// its own articles.
import fs from "node:fs";
import path from "node:path";
import * as pagefind from "pagefind";

// With NEXT_DIST_DIR set, the static export lands in that folder instead of out/.
const site = path.resolve(process.env.NEXT_DIST_DIR ?? "out");

// Code blocks stay out: they match everything and make unreadable excerpts.
// Their file-name captions are still indexed.
const { index, errors: createErrors } = await pagefind.createIndex({
  excludeSelectors: ["pre", ".junior-card-img"],
});
if (!index) throw new Error(`pagefind: ${createErrors.join("; ")}`);

const { errors, page_count } = await index.addDirectory({ path: site });
if (errors.length) throw new Error(`pagefind: ${errors.join("; ")}`);
if (page_count === 0) throw new Error(`pagefind: no indexable pages found in ${site}`);

// public/ may hold the dev index (build-dev-search-index.mjs), which next
// build copies into the export; drop it so only the real index ships.
const outputPath = path.join(site, "pagefind");
fs.rmSync(outputPath, { recursive: true, force: true });
const written = await index.writeFiles({ outputPath });
if (written.errors.length) throw new Error(`pagefind: ${written.errors.join("; ")}`);

await pagefind.close();
console.log(`Search index: ${page_count} pages -> ${path.relative(process.cwd(), written.outputPath)}`);
