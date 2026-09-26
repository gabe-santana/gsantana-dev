// Microsoft Clarity session recordings served through the site's own domain
// (functions/r/[[path]].ts), so content blockers that list clarity.ms don't
// drop them. The site tells visitors about it in the footer. Relative
// imports only (Pages Functions bundler); no `@/`.

export const CLARITY_PROJECT_ID = "yol0e2ogzk";

/**
 * Neutral first-party prefix. Words like "clarity", "analytics" or "track"
 * in the path would get matched by blocklists' path rules.
 */
export const PROXY_PREFIX = "/r";

export const PROXY_PATHS = {
  tag: `${PROXY_PREFIX}/t.js`,
  script: `${PROXY_PREFIX}/s/`,
  collect: `${PROXY_PREFIX}/c/`,
  pixel: `${PROXY_PREFIX}/p`,
} as const;

/**
 * Points Clarity's loader at the proxy:
 * - the main script (scripts.clarity.ms/<version>/clarity.js) -> /r/s/<version>/clarity.js
 * - the "upload" endpoint, a documented config field (https://<x>.clarity.ms/collect) -> /r/c/<x>
 * - the c.gif cookie-sync pixel (ad cookie matching with Microsoft, not
 *   needed for recordings) -> /r/p, which answers with nothing
 * Throws if the loader's shape changed, so a Clarity update fails loudly in
 * the function's logs instead of silently leaking requests to clarity.ms.
 */
export function rewriteClarityTag(tag: string, origin: string): string {
  const out = tag
    .replace(/https:\/\/scripts\.clarity\.ms\//g, `${origin}${PROXY_PATHS.script}`)
    .replace(/https:\/\/([a-z])\.clarity\.ms\/collect/g, `${origin}${PROXY_PATHS.collect}$1`)
    .replace(/https:\/\/c\.clarity\.ms\/c\.gif/g, `${origin}${PROXY_PATHS.pixel}`);
  if (/clarity\.ms/.test(out)) throw new Error("Clarity tag has an endpoint the proxy doesn't know");
  return out;
}

/** "0.8.70/clarity.js" -> the upstream script URL; anything else is refused. */
export function upstreamScriptUrl(rest: string): string | null {
  return /^\d+\.\d+\.\d+\/clarity\.js$/.test(rest) ? `https://scripts.clarity.ms/${rest}` : null;
}

/** "y" -> https://y.clarity.ms/collect; only single-letter Clarity shards. */
export function upstreamCollectUrl(shard: string): string | null {
  return /^[a-z]$/.test(shard) ? `https://${shard}.clarity.ms/collect` : null;
}
