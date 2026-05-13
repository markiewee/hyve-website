import { describe, it, expect } from "vitest";
import { buildUpsertPayload } from "../upsert-lead.js";

describe("buildUpsertPayload", () => {
  it("includes required fields", () => {
    const p = buildUpsertPayload({
      chat_id: "abc",
      name: "Alex",
      phone: "+6591234567",
      source: "airbnb",
      intent: { room_type: "standard", budget_max: 1200 },
      matched_room_codes: ["IH-STD2"],
      status: "new",
      last_message_excerpt: "hello",
      last_message_at: "2026-05-13T08:00:00Z",
    });
    expect(p.chat_id).toBe("abc");
    expect(p.intent).toEqual({ room_type: "standard", budget_max: 1200 });
    expect(p.matched_room_codes).toEqual(["IH-STD2"]);
  });

  it("drops undefined fields", () => {
    const p = buildUpsertPayload({ chat_id: "abc" });
    expect(Object.keys(p)).toEqual(["chat_id"]);
  });

  it("rejects without chat_id", () => {
    expect(() => buildUpsertPayload({})).toThrow(/chat_id required/);
  });
});
