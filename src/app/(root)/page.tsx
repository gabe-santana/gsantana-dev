import type { Metadata } from "next";
import {
  defaultLocale,
  LOCALE_STORAGE_KEY,
  localeConfig,
  localePath,
  locales,
} from "@/lib/i18n";

export const metadata: Metadata = {
  title: "gsantana.dev",
  robots: { index: false },
};

// The site is a static export, so there's no server to redirect "/" based on
// Accept-Language. This inline script runs before first paint instead:
// 1. the language the visitor explicitly chose before (language switcher),
// 2. otherwise the first supported language in their browser preferences,
// 3. otherwise the default locale.
const redirectScript = `(function(){
  var locales = ${JSON.stringify(locales)};
  var chosen = null;
  try { chosen = localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)}); } catch (e) {}
  if (locales.indexOf(chosen) === -1) {
    chosen = ${JSON.stringify(defaultLocale)};
    var prefs = navigator.languages || [navigator.language || ""];
    outer: for (var i = 0; i < prefs.length; i++) {
      var lang = (prefs[i] || "").toLowerCase();
      for (var j = 0; j < locales.length; j++) {
        if (lang.indexOf(locales[j].slice(0, 2)) === 0) { chosen = locales[j]; break outer; }
      }
    }
  }
  location.replace("/" + chosen + "/" + location.search + location.hash);
})();`;

export default function RootRedirectPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=${localePath(defaultLocale)}/`} />
        <p style={{ fontFamily: "sans-serif", padding: "2rem" }}>
          {locales.map((locale) => (
            <a
              key={locale}
              href={`${localePath(locale)}/`}
              style={{ color: "#5eead4", marginRight: "1rem" }}
            >
              {localeConfig[locale].name}
            </a>
          ))}
        </p>
      </noscript>
    </>
  );
}
