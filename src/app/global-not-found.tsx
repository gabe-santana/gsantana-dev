import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import { localeConfig, localePath, locales } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "404 — gsantana.dev",
  robots: { index: false },
};

// A single static 404.html serves every missing URL in every language, so it
// shows each locale's message with a link home in that language.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col items-center justify-center px-6 font-sans antialiased">
        <Link
          href="/"
          className="mb-12 font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          gsantana<span className="text-accent">.dev</span>
        </Link>
        <p className="font-mono text-sm text-accent">404</p>
        <div className="mt-6 grid gap-10 text-center sm:grid-cols-2 sm:gap-16">
          {locales.map((locale) => {
            const dict = getDictionary(locale);
            return (
              <div key={locale} lang={localeConfig[locale].tag}>
                <h1 className="text-2xl font-bold">{dict.notFound.title}</h1>
                <p className="mt-2 max-w-xs text-sm text-muted">
                  {dict.notFound.description}
                </p>
                <Link
                  href={`${localePath(locale)}/`}
                  className="mt-4 inline-block text-sm text-accent hover:underline"
                >
                  {dict.notFound.backHome}
                </Link>
              </div>
            );
          })}
        </div>
      </body>
    </html>
  );
}
