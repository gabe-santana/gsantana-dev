import { renderFeed } from "@/lib/feed";
import { isLocale, locales } from "@/lib/i18n";

// Static export builds one feed per locale at build time — there is no
// server to regenerate it per-request.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });

  return new Response(renderFeed(lang), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
