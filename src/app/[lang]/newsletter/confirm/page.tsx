import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { GridBackdrop } from "@/components/grid-backdrop";
import { NewsletterConfirm } from "@/components/newsletter-confirm";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale } from "@/lib/i18n";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    title: getDictionary(lang).newsletter.confirm.metaTitle,
    // Only reachable from a confirmation email; nothing here for search engines.
    robots: { index: false, follow: false },
  };
}

export default async function NewsletterConfirmPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <section className="relative flex min-h-[80vh] items-center overflow-x-clip">
      <GridBackdrop />
      <Container className="relative py-24">
        <NewsletterConfirm labels={dict.newsletter.confirm} locale={lang} />
      </Container>
    </section>
  );
}
