"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Container } from "@/components/container";
import { getDictionary } from "@/lib/dictionaries";
import { defaultLocale, isLocale, localePath } from "@/lib/i18n";

// not-found receives no props, so the locale is read from the URL. Unknown
// locale segments fall back to the default language.
export default function NotFound() {
  const params = useParams<{ lang?: string }>();
  const locale = params.lang && isLocale(params.lang) ? params.lang : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-3xl font-bold">{dict.notFound.title}</h1>
      <p className="mt-3 text-muted">{dict.notFound.description}</p>
      <Link href={localePath(locale)} className="mt-8 text-accent hover:underline">
        {dict.notFound.backHome}
      </Link>
    </Container>
  );
}
