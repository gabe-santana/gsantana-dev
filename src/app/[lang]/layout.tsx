import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { NewsNotification } from "@/components/news-notification";
import { ConsoleEasterEgg } from "@/components/console-easter-egg";
import { AccessInsights } from "@/components/access-insights";
import { ProgressSync } from "@/components/progress-sync";
import { SessionInsights } from "@/components/session-insights";
import { ParallaxProvider } from "@/components/parallax/parallax-provider";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, localeConfig, localePath, locales, type Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";
import { newsStories } from "@/lib/news";
import {
  alternatesFor,
  darkSiteMetadata,
  darkSiteViewport,
  localeSocialAlt,
  pageSocialMetadata,
  siteUrl,
} from "@/lib/seo";
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

export const viewport: Viewport = darkSiteViewport;

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);

  return {
    metadataBase: new URL(siteUrl),
    title: { default: dict.site.title, template: "%s | gsantana.dev" },
    description: dict.site.description,
    ...pageSocialMetadata(lang, "/", dict.site.title, dict.site.description, localeSocialAlt(lang)),
    alternates: {
      ...alternatesFor(lang, "/"),
      types: { "application/rss+xml": localePath(lang, "/feed.xml") },
    },
    other: darkSiteMetadata,
  };
}

function newestStory(lang: Locale) {
  const story = newsStories[0];
  if (!story) return null;
  return {
    slug: story.slug,
    href: localePath(lang, `/news/${story.slug}`),
    title: story.copy[lang].title,
    image: mediaUrl(story.image),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const newest = newestStory(lang);

  return (
    <html
      lang={localeConfig[lang].tag}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <ConsoleEasterEgg />
        <ProgressSync />
        {/* Reveal (components/reveal.tsx) hides content until JS shows it. */}
        <noscript
          dangerouslySetInnerHTML={{ __html: "<style>[data-reveal]{opacity:1!important;transform:none!important}</style>" }}
        />
        <SessionInsights />
        <AccessInsights />
        <ParallaxProvider>
          <Nav locale={lang} dict={dict} />
          <main className="flex-1">{children}</main>
          <Footer locale={lang} dict={dict} />
        </ParallaxProvider>
        {newest ? (
          <NewsNotification
            story={newest}
            labels={{
              eyebrow: dict.news.notification.eyebrow,
              read: dict.news.readStory,
              close: dict.news.notification.close,
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
