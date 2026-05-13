import { describe, it, expect } from "vitest";
import { resolveRoomPhoto, resolveRoomPhotos } from "../room-photos.js";

// Build a fake fs whose existsSync returns true for whitelisted paths only.
function fakeFs(allowedPaths) {
  const set = new Set(allowedPaths);
  return { existsSync: (p) => set.has(p) };
}

const ROOT = "/photos";

describe("resolveRoomPhoto", () => {
  it("maps TG-STD1 to thomson-grove/STD1.jpg", () => {
    const fsImpl = fakeFs(["/photos/thomson-grove/STD1.jpg"]);
    expect(resolveRoomPhoto("TG-STD1", { root: ROOT, fsImpl })).toBe(
      "/photos/thomson-grove/STD1.jpg"
    );
  });

  it("maps IH-PR2 to ivory-heights/PR2.jpg", () => {
    const fsImpl = fakeFs(["/photos/ivory-heights/PR2.jpg"]);
    expect(resolveRoomPhoto("IH-PR2", { root: ROOT, fsImpl })).toBe(
      "/photos/ivory-heights/PR2.jpg"
    );
  });

  it("falls back from MR to MBR alias", () => {
    const fsImpl = fakeFs(["/photos/chiltern-park/MBR.jpg"]);
    expect(resolveRoomPhoto("CP-MR", { root: ROOT, fsImpl })).toBe(
      "/photos/chiltern-park/MBR.jpg"
    );
  });

  it("falls back from MBR to MR alias", () => {
    const fsImpl = fakeFs(["/photos/thomson-grove/MR.jpg"]);
    expect(resolveRoomPhoto("TG-MBR", { root: ROOT, fsImpl })).toBe(
      "/photos/thomson-grove/MR.jpg"
    );
  });

  it("returns null on unknown property prefix", () => {
    const fsImpl = fakeFs([]);
    expect(resolveRoomPhoto("XX-STD1", { root: ROOT, fsImpl })).toBeNull();
  });

  it("returns null on missing file", () => {
    const fsImpl = fakeFs([]);
    expect(resolveRoomPhoto("TG-STD9", { root: ROOT, fsImpl })).toBeNull();
  });

  it("handles malformed input gracefully", () => {
    expect(resolveRoomPhoto(null)).toBeNull();
    expect(resolveRoomPhoto("")).toBeNull();
    expect(resolveRoomPhoto("NOPROP")).toBeNull();
  });
});

describe("resolveRoomPhotos", () => {
  it("drops missing photos by default", () => {
    const fsImpl = fakeFs(["/photos/thomson-grove/STD1.jpg"]);
    const out = resolveRoomPhotos(["TG-STD1", "TG-STD99"], { root: ROOT, fsImpl });
    expect(out).toEqual([{ code: "TG-STD1", path: "/photos/thomson-grove/STD1.jpg" }]);
  });

  it("keeps missing photos with includeMissing=true", () => {
    const fsImpl = fakeFs(["/photos/thomson-grove/STD1.jpg"]);
    const out = resolveRoomPhotos(["TG-STD1", "TG-STD99"], {
      root: ROOT,
      fsImpl,
      includeMissing: true,
    });
    expect(out).toEqual([
      { code: "TG-STD1", path: "/photos/thomson-grove/STD1.jpg" },
      { code: "TG-STD99", path: null },
    ]);
  });
});
