import { describe, it, expect } from "vitest";
import { isAgentMessage, normaliseE164 } from "../classify-helpers.js";

describe("isAgentMessage", () => {
  it("matches PropertyGuru intro", () => {
    expect(isAgentMessage("Hi, I'm Larry Lee. I received your enquiry from PropertyGuru on...")).toBe(true);
  });

  it("matches PropNex / Huttons / ERA mentions", () => {
    expect(isAgentMessage("I'm from PropNex and my PA reached out")).toBe(true);
    expect(isAgentMessage("Huttons agent here")).toBe(true);
    expect(isAgentMessage("ERA Realty")).toBe(true);
  });

  it("matches 'pool of tenants'", () => {
    expect(isAgentMessage("I have a pool of tenants. Pls send details")).toBe(true);
  });

  it("does not match a normal prospect message", () => {
    expect(isAgentMessage("Hi! Saw your listing — std rooms for june?")).toBe(false);
    expect(isAgentMessage("can i view the room?")).toBe(false);
  });
});

describe("normaliseE164", () => {
  it("preserves +-prefixed", () => {
    expect(normaliseE164("+6591234567")).toBe("+6591234567");
  });
  it("prepends +65 to 8-digit bare", () => {
    expect(normaliseE164("91234567")).toBe("+6591234567");
  });
  it("returns null for empty", () => {
    expect(normaliseE164("")).toBeNull();
    expect(normaliseE164(null)).toBeNull();
  });
});
