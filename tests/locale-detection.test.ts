import { describe, expect, it } from "vitest";
import { onRequest } from "@/functions/index";
import { detectLocale, localesFromAcceptLanguage } from "@/lib/locale-detection";

describe("detectLocale", () => {
  it("sends Portuguese-speaking countries to pt-br", () => {
    for (const country of ["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL", "MO", "GQ"]) {
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
    expect(detectLocale({ country: "XX", acceptLanguage: "pt-BR,pt;q=0.9" })).toBe("pt-br");
    expect(detectLocale({ country: "T1", acceptLanguage: "en-GB" })).toBe("en-us");
    expect(detectLocale({ country: "US", acceptLanguage: "pt-BR" })).toBe("en-us");
  });

  it("falls back to en-us with no signals", () => {
    expect(detectLocale({})).toBe("en-us");
    expect(detectLocale({ country: "XX", acceptLanguage: "de-DE,fr" })).toBe("en-us");
  });
});

describe("localesFromAcceptLanguage", () => {
  it("orders by q-value and ignores unsupported languages", () => {
    expect(localesFromAcceptLanguage("es;q=1,en;q=0.5,pt-BR;q=0.8")).toEqual(["pt-br", "en-us"]);
    expect(localesFromAcceptLanguage("pt;q=0")).toEqual([]);
  });
});

describe("edge redirect function", () => {
  function request(headers: Record<string, string> = {}, country?: string) {
    const req = new Request("https://gsantana.dev/?utm_source=x", { headers });
    return Object.assign(req, { cf: country ? { country } : undefined });
  }
  const next = async () => new Response("static fallback");

  it("redirects by country and keeps the query string", async () => {
    const res = await onRequest({ request: request({}, "BR"), next });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/pt-br/?utm_source=x");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("honors the language cookie", async () => {
    const res = await onRequest({
      request: request({ Cookie: "theme=dark; gsantana_locale=en-us" }, "BR"),
      next,
    });
    expect(res.headers.get("Location")).toBe("/en-us/?utm_source=x");
  });
});
