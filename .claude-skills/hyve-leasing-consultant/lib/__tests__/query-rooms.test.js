import { describe, it, expect } from "vitest";
import { matchRooms } from "../query-rooms.js";

describe("matchRooms", () => {
  const rooms = [
    { room_code: "IH-PR1", property_code: "IH", monthly_rent: 1300, room_type: "premium", available_from: "2026-05-01" },
    { room_code: "IH-STD2", property_code: "IH", monthly_rent: 1000, room_type: "standard", available_from: "2026-06-15" },
    { room_code: "TG-MR", property_code: "TG", monthly_rent: 2200, room_type: "master", available_from: "2026-05-01" },
  ];

  it("filters by room_type", () => {
    const r = matchRooms(rooms, { room_type: "premium", budget_max: 1500, move_in_date: "2026-05-15" });
    expect(r.map(x => x.room_code)).toEqual(["IH-PR1"]);
  });

  it("filters by budget_max", () => {
    const r = matchRooms(rooms, { budget_max: 1200, move_in_date: "2026-06-20" });
    expect(r.map(x => x.room_code)).toContain("IH-STD2");
    expect(r.map(x => x.room_code)).not.toContain("TG-MR");
  });

  it("excludes rooms not available by move_in_date", () => {
    const r = matchRooms(rooms, { budget_max: 2500, move_in_date: "2026-05-15" });
    expect(r.map(x => x.room_code)).not.toContain("IH-STD2");
  });

  it("returns empty when no match", () => {
    expect(matchRooms(rooms, { budget_max: 500 })).toEqual([]);
  });

  it("caps to top 3", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      room_code: `R${i}`, property_code: "X", monthly_rent: 1000, room_type: "standard", available_from: "2026-05-01",
    }));
    expect(matchRooms(many, { budget_max: 2000 })).toHaveLength(3);
  });

  it("excludes rooms when pax exceeds max_occupancy", () => {
    const rs = [
      { room_code: "TG-STD1", monthly_rent: 800, room_type: "standard", max_occupancy: 1, available_from: "2026-05-01" },
      { room_code: "CP-MR",   monthly_rent: 2200, room_type: "master",   max_occupancy: 2, available_from: "2026-05-01" },
    ];
    const r = matchRooms(rs, { pax: 2, budget_max: 2500 });
    expect(r.map((x) => x.room_code)).toEqual(["CP-MR"]);
  });

  it("decorates each result with .pricing tiers + early-bird", () => {
    const r = matchRooms(
      [{ room_code: "CP-PR1", monthly_rent: 1500, available_from: "2026-08-12", room_type: "premium" }],
      { budget_max: 1600 },
      { now: new Date("2026-05-13T00:00:00Z") }
    );
    expect(r[0].pricing.tiers).toHaveLength(4);
    expect(r[0].pricing.tiers[0]).toEqual({ months: 3, monthly_rent: 1600 });
    expect(r[0].pricing.early_bird.total_savings).toBe(100);
  });
});
