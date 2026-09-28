import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { CertificationsIndex, certificationsMetadata } from "./certifications-index";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? certificationsMetadata(lang, 1) : {};
}

export default async function CertificationsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <CertificationsIndex lang={lang} page={1} />;
}
