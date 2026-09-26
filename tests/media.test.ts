import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaUrl } from "@/lib/media";

describe("mediaUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes absolute URLs through untouched", () => {
    expect(mediaUrl("https://example.com/img.png")).toBe(
      "https://example.com/img.png"
    );
  });

  it("prefixes root-relative paths with the configured CDN", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_CDN_URL", "https://cdn.gsantana.dev");
    expect(mediaUrl("/covers/foo.jpg")).toBe(
      "https://cdn.gsantana.dev/covers/foo.jpg"
    );
  });
});
