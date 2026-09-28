import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { BlogIndex, blogMetadata } from "./blog-index";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? blogMetadata(lang, 1) : {};
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <BlogIndex lang={lang} page={1} />;
}
