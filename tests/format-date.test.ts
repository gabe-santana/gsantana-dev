import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format-date";

describe("formatDate", () => {
  it("formats an ISO date as a readable long date", () => {
    expect(formatDate("2026-01-15")).toBe("January 15, 2026");
  });
});
