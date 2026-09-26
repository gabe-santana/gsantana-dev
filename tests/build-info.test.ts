import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildInfo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the commit Cloudflare Pages is building", async () => {
    vi.stubEnv("CF_PAGES_COMMIT_SHA", "914d32f1234567890abcdef1234567890abcdef0");
    const { buildInfo } = await import("@/lib/build-info");
    expect(buildInfo.sha).toBe("914d32f1234567890abcdef1234567890abcdef0");
    expect(buildInfo.shortSha).toBe("914d32f");
    expect(buildInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("falls back to local git outside Cloudflare", async () => {
    vi.stubEnv("CF_PAGES_COMMIT_SHA", "");
    const { buildInfo } = await import("@/lib/build-info");
    expect(buildInfo.shortSha).toMatch(/^[0-9a-f]{7}$/);
  });
});
