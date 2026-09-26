import { describe, expect, it } from "vitest";
import { formatDate, formatMonth } from "@/lib/format-date";

describe("formatDate", () => {
  it("formats per locale", () => {
    expect(formatDate("2026-01-15", "en-us")).toBe("January 15, 2026");
    expect(formatDate("2026-01-15", "pt-br")).toBe("15 de janeiro de 2026");
  });

  it("formats month-year per locale", () => {
    expect(formatMonth("2024-12", "en-us")).toBe("Dec 2024");
    expect(formatMonth("2024-12", "pt-br")).toMatch(/dez.*2024/);
  });
});
