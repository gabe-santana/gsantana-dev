// tests/ lives one level above src/ (a sibling, not a descendant), but
// dependencies are installed into src/node_modules because that's where
// package.json lives. Node's module resolution walks UP from an importing
// file looking for a node_modules directory at each parent — it never
// looks sideways into a sibling folder. So a bare import inside a test
// file (e.g. "@testing-library/jest-dom/vitest") can only be found if a
// node_modules directory also exists at the repo root, which is the
// nearest common ancestor of src/ and tests/.
//
// This script creates that as a link (a junction on Windows, a symlink
// elsewhere) instead of a second install, so it costs no extra disk space
// and stays in sync automatically. It's idempotent and safe to run on
// every `npm install`.
import { existsSync, symlinkSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const target = path.join(srcDir, "node_modules");
const linkPath = path.join(srcDir, "..", "node_modules");

if (existsSync(linkPath)) {
  const stats = lstatSync(linkPath);
  if (stats.isSymbolicLink()) {
    process.exit(0);
  }
  console.warn(
    `[postinstall] ${linkPath} already exists and isn't a link — skipping.`
  );
  process.exit(0);
}

try {
  symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
  console.log(`[postinstall] linked ${linkPath} -> ${target}`);
} catch (error) {
  console.warn(
    `[postinstall] could not link root node_modules (tests may fail to resolve packages): ${error.message}`
  );
}
