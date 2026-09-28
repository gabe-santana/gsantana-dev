import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { NewsIndex, newsMetadata } from "./news-index";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? newsMetadata(lang, 1) : {};
}

export default async function NewsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <NewsIndex lang={lang} page={1} />;
}
