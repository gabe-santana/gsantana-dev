import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n";
import { laterPageParams, PAGE_SIZE, parsePage } from "@/lib/pagination";
import { PrinciplesIndex, principlesMetadata, principlesTotal } from "../../principles-index";

interface PageProps {
  params: Promise<{ lang: string; page: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    laterPageParams(principlesTotal(lang), PAGE_SIZE.principles).map((params) => ({ lang, ...params }))
  );
}

async function resolve(params: PageProps["params"]) {
  const { lang, page } = await params;
  if (!isLocale(lang)) return null;
  const number = parsePage(page, principlesTotal(lang), PAGE_SIZE.principles);
  return number ? { lang, page: number } : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await resolve(params);
  return resolved ? principlesMetadata(resolved.lang, resolved.page) : {};
}

export default async function PrinciplesPage({ params }: PageProps) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  return <PrinciplesIndex lang={resolved.lang} page={resolved.page} />;
}
