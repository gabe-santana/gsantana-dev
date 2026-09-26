// Cloudflare Pages Function for "/" only (file-based routing: functions/
// index.ts matches exactly the root path). Every other URL is served as a
// static file and never runs this code.
//
// Runs at the Cloudflare edge nearest the visitor and redirects to their
// language before anything is sent to the browser. If it ever fails, the
// static out/index.html (browser-language redirect) is served instead.
import { LOCALE_COOKIE } from "../lib/i18n";
import { detectLocale } from "../lib/locale-detection";

// Minimal shape of the Pages Function context we use, so this file needs no
// extra type packages.
interface PagesContext {
  request: Request & { cf?: { country?: string } };
  next: () => Promise<Response>;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function onRequest({ request, next }: PagesContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const locale = detectLocale({
      cookie: readCookie(request.headers.get("Cookie"), LOCALE_COOKIE),
      country: request.cf?.country,
      acceptLanguage: request.headers.get("Accept-Language"),
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/${locale}/${url.search}`,
        // The answer depends on who's asking, so it must never be cached.
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return next();
  }
}
