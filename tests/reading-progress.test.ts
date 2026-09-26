import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProgress, saveProgress } from "@/lib/reading-progress";

describe("reading progress storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns 0 for a post that was never opened", () => {
    expect(getProgress("hello-world")).toBe(0);
  });

  it("keeps only the furthest point reached", () => {
    saveProgress("hello-world", 40);
    saveProgress("hello-world", 25);
    expect(getProgress("hello-world")).toBe(40);

    saveProgress("hello-world", 61);
    expect(getProgress("hello-world")).toBe(61);
  });

  it("tracks posts independently", () => {
    saveProgress("a", 10);
    saveProgress("b", 90);
    expect(getProgress("a")).toBe(10);
    expect(getProgress("b")).toBe(90);
  });

  it("treats the last couple of percent as finished", () => {
    saveProgress("hello-world", 98);
    expect(getProgress("hello-world")).toBe(100);
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("gsantana:reading-progress", "{not json");
    expect(getProgress("hello-world")).toBe(0);
    saveProgress("hello-world", 30);
    expect(getProgress("hello-world")).toBe(30);
  });

  it("degrades silently when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveProgress("hello-world", 50)).not.toThrow();
    expect(getProgress("hello-world")).toBe(0);
  });
});
