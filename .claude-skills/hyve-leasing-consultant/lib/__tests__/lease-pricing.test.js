import { describe, it, expect } from "vitest";
import { computeLeaseTiers, earlyBird, buildPricingBlock } from "../lease-pricing.js";

describe("computeLeaseTiers", () => {
  it("mirrors StaffResourcePage formula (3=+100, 6=+50, 12=base, 24=-50)", () => {
    expect(computeLeaseTiers(1500)).toEqual([
      { months: 3,  monthly_rent: 1600 },
      { months: 6,  monthly_rent: 1550 },
      { months: 12, monthly_rent: 1500, recommended: true },
      { months: 24, monthly_rent: 1450 },
    ]);
  });

  it("handles string input (numeric column comes back as string)", () => {
    expect(computeLeaseTiers("1000")[0]).toEqual({ months: 3, monthly_rent: 1100 });
  });

  it("works for low base rents (no underflow below zero in our range)", () => {
    expect(computeLeaseTiers(700)[3]).toEqual({ months: 24, monthly_rent: 650 });
  });
});

describe("earlyBird", () => {
  it("returns discount when available_from is in the future", () => {
    const out = earlyBird("2026-08-12", new Date("2026-05-13T00:00:00Z"));
    expect(out).toEqual({
      ends_on: "2026-08-12",
      per_month: 50,
      months: 2,
      total_savings: 100,
    });
  });

  it("returns null when available_from is today or past", () => {
    expect(earlyBird("2026-05-13", new Date("2026-05-13T12:00:00Z"))).toBeNull();
    expect(earlyBird("2026-01-01", new Date("2026-05-13T00:00:00Z"))).toBeNull();
  });

  it("returns null when available_from is missing or malformed", () => {
    expect(earlyBird(null)).toBeNull();
    expect(earlyBird("")).toBeNull();
    expect(earlyBird("not-a-date")).toBeNull();
  });
});

describe("buildPricingBlock", () => {
  it("bundles tiers + early-bird from a room row", () => {
    const room = { monthly_rent: 1500, available_from: "2026-08-12" };
    const block = buildPricingBlock(room, new Date("2026-05-13T00:00:00Z"));
    expect(block.base_monthly).toBe(1500);
    expect(block.tiers).toHaveLength(4);
    expect(block.tiers[2].recommended).toBe(true);
    expect(block.early_bird.total_savings).toBe(100);
  });

  it("omits early-bird if availability is past", () => {
    const block = buildPricingBlock(
      { monthly_rent: 1000, available_from: "2026-01-01" },
      new Date("2026-05-13T00:00:00Z")
    );
    expect(block.early_bird).toBeNull();
  });
});
