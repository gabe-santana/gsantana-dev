import { execSync } from "node:child_process";
import packageJson from "../package.json";

// Evaluated once at build time (server-only: never import from a client
// component). Shown discreetly in the footer as a "did my release go out?"
// check: compare it with the latest commit on main.

function commitSha(): string {
  // Set by Cloudflare Pages on Git-triggered builds.
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const sha = commitSha();

export const buildInfo = {
  version: packageJson.version,
  sha,
  shortSha: sha.slice(0, 7),
  builtAt: new Date().toISOString(),
};
