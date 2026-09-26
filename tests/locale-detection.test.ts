import { describe, expect, it } from "vitest";
import { onRequest } from "@/functions/[[path]]";
import {
  detectLocale,
  localesFromAcceptLanguage,
} from "@/lib/locale-detection";

describe("detectLocale", () => {
  it("sends Portuguese-speaking countries to pt-br", () => {
    for (const country of [
      "BR",
      "PT",
      "AO",
      "MZ",
      "CV",
      "GW",
      "ST",
      "TL",
      "MO",
      "GQ",
    ]) {
      expect(detectLocale({ country }), country).toBe("pt-br");
    }
  });

  it("sends every other country to en-us", () => {
    for (const country of ["US", "DE", "ES", "JP", "AR"]) {
      expect(detectLocale({ country }), country).toBe("en-us");
    }
  });

  it("lets an explicit choice (cookie) beat the country", () => {
    expect(detectLocale({ cookie: "en-us", country: "BR" })).toBe("en-us");
    expect(detectLocale({ cookie: "pt-br", country: "US" })).toBe("pt-br");
  });

  it("ignores an invalid cookie", () => {
    expect(detectLocale({ cookie: "fr-fr", country: "BR" })).toBe("pt-br");
  });

  it("uses the browser language only when the country is unknown", () => {
    expect(
      detectLocale({ country: "XX", acceptLanguage: "pt-BR,pt;q=0.9" }),
    ).toBe("pt-br");
    expect(detectLocale({ country: "T1", acceptLanguage: "en-GB" })).toBe(
      "en-us",
    );
    expect(detectLocale({ country: "US", acceptLanguage: "pt-BR" })).toBe(
      "en-us",
    );
  });

  it("falls back to en-us with no signals", () => {
    expect(detectLocale({})).toBe("en-us");
    expect(detectLocale({ country: "XX", acceptLanguage: "de-DE,fr" })).toBe(
      "en-us",
    );
  });
});

describe("localesFromAcceptLanguage", () => {
  it("orders by q-value and ignores unsupported languages", () => {
    expect(localesFromAcceptLanguage("es;q=1,en;q=0.5,pt-BR;q=0.8")).toEqual([
      "pt-br",
      "en-us",
    ]);
    expect(localesFromAcceptLanguage("pt;q=0")).toEqual([]);
  });
});

describe("edge redirect function", () => {
  // Static files the fake Pages site "has".
  const files = new Set([
    "/robots.txt",
    "/pt-br/principles/cloud/cost-optimization/",
    "/en-us/principles/cloud/cost-optimization/",
  ]);
  const staticResponse = (path: string) =>
    files.has(path)
      ? new Response("file", { status: 200 })
      : new Response("404 page", { status: 404 });

  function context(
    path: string,
    {
      headers = {},
      country,
    }: { headers?: Record<string, string>; country?: string } = {},
  ) {
    const request = Object.assign(
      new Request(`https://gsantana.dev${path}`, { headers }),
      {
        cf: country ? { country } : undefined,
      },
    );
    return {
      request,
      next: async () => staticResponse(new URL(request.url).pathname),
      env: {
        ASSETS: {
          fetch: async (input: Request | URL | string) =>
            staticResponse(
              new URL(String(input instanceof Request ? input.url : input))
                .pathname,
            ),
        },
      },
    };
  }

  it("redirects / by country and keeps the query string", async () => {
    const res = await onRequest(context("/?utm_source=x", { country: "BR" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/pt-br/?utm_source=x");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("honors the language cookie", async () => {
    const res = await onRequest(
      context("/", {
        headers: { Cookie: "theme=dark; gsantana_locale=en-us" },
        country: "BR",
      }),
    );
    expect(res.headers.get("Location")).toBe("/en-us/");
  });

  it("redirects a shared link without a language to the localized page", async () => {
    const br = await onRequest(
      context("/principles/cloud/cost-optimization/", { country: "BR" }),
    );
    expect(br.headers.get("Location")).toBe(
      "/pt-br/principles/cloud/cost-optimization/",
    );

    const us = await onRequest(
      context("/principles/cloud/cost-optimization", { country: "US" }),
    );
    expect(us.headers.get("Location")).toBe(
      "/en-us/principles/cloud/cost-optimization/",
    );
  });

  it("serves real root-level files instead of redirecting", async () => {
    const res = await onRequest(context("/robots.txt", { country: "BR" }));
    expect(res.status).toBe(200);
  });

  it("returns the 404 page (no redirect) for paths that don't exist in any language", async () => {
    const res = await onRequest(
      context("/principlez/typo/", { country: "BR" }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("never redirects already-localized URLs", async () => {
    const res = await onRequest(
      context("/pt-br/principles/cloud/cost-optimization/", { country: "US" }),
    );
    expect(res.status).toBe(200);
  });
});
