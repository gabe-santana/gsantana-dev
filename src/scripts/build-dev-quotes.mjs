// `next dev` doesn't run Pages Functions, so /api/quotes doesn't exist
// there. This saves one real snapshot to public/dev-quotes.json (gitignored)
// for the ticker to read in dev. Needs FINNHUB_API_KEY in src/.env.local;
// without it the ticker simply stays hidden in dev. Never fails `npm run dev`.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "public", "dev-quotes.json");

try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // No .env.local: fall back to the shell environment.
}

const token = process.env.FINNHUB_API_KEY;
if (!token) {
  fs.rmSync(output, { force: true });
  console.log("Dev quotes: skipped (no FINNHUB_API_KEY in .env.local)");
} else {
  try {
    // lib/quotes.ts has no runtime imports, so a plain transpile loads it.
    const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, "lib", "quotes.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    const { fetchFinnhubQuotes } = await import(
      `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
    );
    const payload = await fetchFinnhubQuotes(token);
    fs.writeFileSync(output, JSON.stringify(payload));
    console.log(`Dev quotes: ${payload.quotes.length} symbols -> public/dev-quotes.json`);
  } catch (error) {
    console.warn(`Dev quotes: skipped (${error instanceof Error ? error.message : error})`);
  }
}
