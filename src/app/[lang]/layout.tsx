import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { ParallaxProvider } from "@/components/parallax/parallax-provider";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, localeConfig, localePath, locales } from "@/lib/i18n";
import { alternatesFor, siteUrl } from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Only the known locales exist; anything else (e.g. /fr-fr) is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);

  return {
    metadataBase: new URL(siteUrl),
    title: { default: dict.site.title, template: "%s — gsantana.dev" },
    description: dict.site.description,
    openGraph: {
      type: "website",
      siteName: "gsantana.dev",
      locale: localeConfig[lang].tag.replace("-", "_"),
      url: localePath(lang),
    },
    twitter: { card: "summary_large_image" },
    alternates: {
      ...alternatesFor(lang, "/"),
      types: { "application/rss+xml": localePath(lang, "/feed.xml") },
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html
      lang={localeConfig[lang].tag}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <ParallaxProvider>
          <Nav locale={lang} dict={dict} />
          <main className="flex-1">{children}</main>
          <Footer locale={lang} dict={dict} />
        </ParallaxProvider>
      </body>
    </html>
  );
}
