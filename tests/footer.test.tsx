import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/footer";
import { getDictionary } from "@/lib/dictionaries";
import { locales } from "@/lib/i18n";

describe("footer", () => {
  it.each(locales)("links the %s footer to Buy Me a Coffee with the English button", (locale) => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(<Footer locale={locale} dict={getDictionary(locale)} />);
    const button = root.querySelector<HTMLImageElement>('img[src^="https://img.buymeacoffee.com/"]');

    expect(button?.alt).toBe("Buy me a coffee");
    expect(new URL(button!.src).searchParams.get("text")).toBe("Buy me a coffee");
    expect(button?.closest("a")?.getAttribute("href")).toBe("https://www.buymeacoffee.com/gsantanaszm");
  });
});
