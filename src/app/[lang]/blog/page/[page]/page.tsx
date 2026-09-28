import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n";
import { laterPageParams, PAGE_SIZE, parsePage } from "@/lib/pagination";
import { BlogIndex, blogMetadata, blogTotal } from "../../blog-index";

interface PageProps {
  params: Promise<{ lang: string; page: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    laterPageParams(blogTotal(lang), PAGE_SIZE.blog).map((params) => ({ lang, ...params }))
  );
}

async function resolve(params: PageProps["params"]) {
  const { lang, page } = await params;
  if (!isLocale(lang)) return null;
  const number = parsePage(page, blogTotal(lang), PAGE_SIZE.blog);
  return number ? { lang, page: number } : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await resolve(params);
  return resolved ? blogMetadata(resolved.lang, resolved.page) : {};
}

export default async function BlogPage({ params }: PageProps) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  return <BlogIndex lang={resolved.lang} page={resolved.page} />;
}
