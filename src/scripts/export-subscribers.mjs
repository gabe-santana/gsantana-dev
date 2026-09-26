// Exports confirmed newsletter subscribers from D1 to a CSV for Zoho
// Campaigns, which sends the actual issues (ZeptoMail, used for the
// confirmation email, only allows transactional mail, not newsletters).
// Campaigns adds the unsubscribe link and List-Unsubscribe headers itself.
//
//   npm run newsletter:export                -> subscribers-<date>.csv, every confirmed address
//   npm run newsletter:export -- --since 2026-10-01   -> only those confirmed on/after that day
//
// The CSV holds personal data: it's gitignored (src/subscribers-*.csv), and
// should be deleted after the import.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sinceArg = process.argv.indexOf("--since");
const since = sinceArg > -1 ? Date.parse(`${process.argv[sinceArg + 1]}T00:00:00Z`) : 0;
if (Number.isNaN(since)) throw new Error("--since expects a date like 2026-10-01");

const sql = `SELECT email, locale, verified_at FROM subscribers WHERE verified = 1 AND verified_at >= ${since} ORDER BY verified_at`;
// wrangler's JS entry through node (not npx): no shell, so the SQL stays one argument on Windows too.
const out = execFileSync(
  process.execPath,
  [path.join(root, "node_modules", "wrangler", "bin", "wrangler.js"), "d1", "execute", "gsantana-dev-database", "--remote", "--json", "--command", sql],
  { cwd: root, encoding: "utf8" }
);
const rows = JSON.parse(out.slice(out.indexOf("[")))[0].results;

const csvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
const lines = [
  ["Contact Email", "Language", "Confirmed At"].map(csvCell).join(","),
  ...rows.map((r) =>
    [r.email, r.locale === "pt-br" ? "Portuguese" : "English", new Date(r.verified_at).toISOString()]
      .map(csvCell)
      .join(",")
  ),
];
const file = path.join(root, `subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
fs.writeFileSync(file, `${lines.join("\n")}\n`);
console.log(`${rows.length} confirmed subscriber(s) -> ${path.relative(process.cwd(), file)}`);
