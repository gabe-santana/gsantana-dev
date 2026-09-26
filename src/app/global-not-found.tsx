import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { NotFoundScreen } from "@/components/not-found-screen";
import { getDictionary } from "@/lib/dictionaries";
import { LOCALE_STORAGE_KEY, locales } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "404 — gsantana.dev",
  robots: { index: false },
};

// One static 404.html serves every missing URL in every language, so the
// language is picked in the browser before first paint and written to
// <html lang>, which decides which copy <Bilingual> (and the header/footer
// wrappers below) show: the URL's locale segment, else the visitor's saved
// choice, else their browser language.
const pickLanguageScript = `(function(){
  var seg = location.pathname.split("/")[1];
  var lang = seg === "pt-br" ? "pt-BR" : seg === "en-us" ? "en-US" : null;
  if (!lang) {
    var saved = null;
    try { saved = localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)}); } catch (e) {}
    if (saved === "pt-br") lang = "pt-BR";
    else if (saved === "en-us") lang = "en-US";
    else lang = /^pt/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "") ? "pt-BR" : "en-US";
  }
  document.documentElement.lang = lang;
})();`;

export default function GlobalNotFound() {
  return (
    // The script above changes lang before React hydrates.
    <html
      lang="en-US"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: pickLanguageScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        {/* Same header/footer as every page, one per language; the hidden
            one is display:none. "contents" keeps the sticky header working. */}
        {locales.map((locale) => (
          <div key={locale} data-lang={locale} className="contents">
            <Nav locale={locale} dict={getDictionary(locale)} switcherPath="/" />
          </div>
        ))}
        <main className="flex-1">
          <NotFoundScreen />
        </main>
        {locales.map((locale) => (
          <div key={locale} data-lang={locale} className="contents">
            <Footer locale={locale} dict={getDictionary(locale)} />
          </div>
        ))}
      </body>
    </html>
  );
}
