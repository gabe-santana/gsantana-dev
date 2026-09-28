import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n";
import { laterPageParams, PAGE_SIZE, parsePage } from "@/lib/pagination";
import { NewsIndex, newsMetadata, newsTotal } from "../../news-index";

interface PageProps {
  params: Promise<{ lang: string; page: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    laterPageParams(newsTotal(), PAGE_SIZE.news).map((params) => ({ lang, ...params }))
  );
}

async function resolve(params: PageProps["params"]) {
  const { lang, page } = await params;
  if (!isLocale(lang)) return null;
  const number = parsePage(page, newsTotal(), PAGE_SIZE.news);
  return number ? { lang, page: number } : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await resolve(params);
  return resolved ? newsMetadata(resolved.lang, resolved.page) : {};
}

export default async function NewsPage({ params }: PageProps) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  return <NewsIndex lang={resolved.lang} page={resolved.page} />;
}
