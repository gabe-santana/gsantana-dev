// Cloudflare Pages Function: language redirect for any URL *without* a
// locale prefix, e.g. "/" or a shared link like
// "/principles/cloud/cost-optimization/". public/_routes.json keeps it off
// every localized page and asset (/en-us/*, /pt-br/*, /_next/*), so normal
// page views never run code.
//
// Runs at the Cloudflare edge nearest the visitor, before anything is sent.
// If it ever fails, the request falls through to the static files (on "/",
// out/index.html redirects by browser language instead).
import { isLocale, LOCALE_COOKIE, type Locale } from "../lib/i18n";
import { detectLocale } from "../lib/locale-detection";

// Minimal shape of the Pages Function context we use, so this file needs no
// extra type packages.
export interface PagesContext {
  request: Request & { cf?: { country?: string } };
  next: () => Promise<Response>;
  env: {
    ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> };
  };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

/** "/principles/x" -> "/pt-br/principles/x/" (pages end with "/"; files don't). */
function localizedPath(pathname: string, locale: Locale): string {
  const last = pathname.split("/").pop() ?? "";
  const withSlash =
    pathname.endsWith("/") || last.includes(".") ? pathname : `${pathname}/`;
  return `/${locale}${withSlash}`;
}

export async function onRequest({
  request,
  next,
  env,
}: PagesContext): Promise<Response> {
  try {
    const url = new URL(request.url);

    // Already localized: should be excluded by _routes.json, but never loop.
    const firstSegment = url.pathname.split("/")[1] ?? "";
    if (isLocale(firstSegment)) return next();

    // Real root-level files (robots.txt, sitemap.xml, icon.svg…) win.
    let notFound: Response | null = null;
    if (url.pathname !== "/") {
      const direct = await next();
      if (direct.status !== 404) return direct;
      notFound = direct;
    }

    const locale = detectLocale({
      cookie: readCookie(request.headers.get("Cookie"), LOCALE_COOKIE),
      country: request.cf?.country,
      acceptLanguage: request.headers.get("Accept-Language"),
    });
    const target = localizedPath(url.pathname, locale);

    // Only redirect to pages that exist; a typo gets the 404 page directly.
    if (notFound) {
      const localized = await env.ASSETS.fetch(new URL(target, url.origin));
      if (!localized.ok) return notFound;
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${target}${url.search}`,
        // The answer depends on who's asking, so it must never be cached.
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return next();
  }
}
