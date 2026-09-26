import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CertificationArticlePage from "@/app/[lang]/certifications/[slug]/page";
import { getAllCertificationSummaries } from "@/lib/certifications";
import { locales } from "@/lib/i18n";

const slug = "az-305-az-104-storage-private-endpoint";
const videoEmbed = "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7426370058035236864?compact=1";

describe("AZ-305 / AZ-104 Storage question", () => {
  it.each(locales)("shows the shared video before the %s explanation", async (locale) => {
    const summary = getAllCertificationSummaries(locale).find((article) => article.slug === slug);
    expect(summary?.videoEmbed).toBe(videoEmbed);
    expect(summary?.sourceUrl).toContain("7426370267280752640");

    const page = await CertificationArticlePage({ params: Promise.resolve({ lang: locale, slug }) });
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(page);

    const iframe = root.querySelector("iframe");
    const explanation = root.querySelector("#post-content h2");
    expect(iframe?.getAttribute("src")).toBe(videoEmbed);
    expect(iframe?.getAttribute("title")).toBe(summary?.title);
    expect(root.querySelector("figure a")?.getAttribute("href")).toBe(summary?.sourceUrl);
    expect(iframe?.compareDocumentPosition(explanation!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
