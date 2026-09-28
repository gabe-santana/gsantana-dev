import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PrinciplesIndex, principlesMetadata } from "./principles-index";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? principlesMetadata(lang, 1) : {};
}

export default async function PrinciplesPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <PrinciplesIndex lang={lang} page={1} />;
}
