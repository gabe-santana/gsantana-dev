// Cloudflare Pages Function: first-party proxy for Microsoft Clarity session
// recordings (see lib/clarity-proxy.ts for the routes and why).
import {
  CLARITY_PROJECT_ID,
  PROXY_PATHS,
  rewriteClarityTag,
  upstreamCollectUrl,
  upstreamScriptUrl,
} from "../../lib/clarity-proxy";

interface Context {
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
}

const TAG_TTL_S = 60 * 60;
const SCRIPT_TTL_S = 60 * 60 * 24;

/** Edge-caches a GET under the request URL for `ttl` seconds. */
async function cached(request: Request, ctx: Context, ttl: number, produce: () => Promise<Response>): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await produce();
  if (res.ok) {
    const headers = new Headers(res.headers);
    headers.set("Cache-Control", `public, max-age=${ttl}`);
    const stored = new Response(await res.arrayBuffer(), { status: res.status, headers });
    ctx.waitUntil(cache.put(request.url, stored.clone()));
    return stored;
  }
  return res;
}

function javascript(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
}

export async function onRequest(ctx: Context): Promise<Response> {
  const { request } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === PROXY_PATHS.tag) {
    return cached(request, ctx, TAG_TTL_S, async () => {
      const upstream = await fetch(`https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`);
      if (!upstream.ok) return new Response(null, { status: 502 });
      return javascript(rewriteClarityTag(await upstream.text(), url.origin));
    });
  }

  if (request.method === "GET" && path.startsWith(PROXY_PATHS.script)) {
    const target = upstreamScriptUrl(path.slice(PROXY_PATHS.script.length));
    if (!target) return new Response(null, { status: 404 });
    return cached(request, ctx, SCRIPT_TTL_S, async () => {
      const upstream = await fetch(target);
      return upstream.ok ? javascript(await upstream.text()) : new Response(null, { status: 502 });
    });
  }

  if (request.method === "POST" && path.startsWith(PROXY_PATHS.collect)) {
    const target = upstreamCollectUrl(path.slice(PROXY_PATHS.collect.length));
    if (!target) return new Response(null, { status: 404 });
    const headers = new Headers();
    for (const name of ["Content-Type", "Accept", "User-Agent", "Accept-Language"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Without this every visitor would look like they're in the Cloudflare
    // data center's country.
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) headers.set("X-Forwarded-For", ip);
    const upstream = await fetch(target, { method: "POST", headers, body: await request.arrayBuffer() });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain", "Cache-Control": "no-store" },
    });
  }

  if (path === PROXY_PATHS.pixel) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  return new Response(null, { status: 404 });
}
