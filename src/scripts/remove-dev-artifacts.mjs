// next build copies public/ into the export, including files the dev
// scripts generate there (build-dev-quotes.mjs). They must never ship: a
// stale dev snapshot is not production data.
import fs from "node:fs";
import path from "node:path";

const site = path.resolve(process.env.NEXT_DIST_DIR ?? "out");
for (const file of ["dev-quotes.json"]) {
  fs.rmSync(path.join(site, file), { force: true });
}
