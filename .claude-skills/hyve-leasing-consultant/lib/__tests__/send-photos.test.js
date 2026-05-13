import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { uploadAsset, sendChatMessage, sendRoomPhotos, BeeperApiError } from "../send-photos.js";

beforeEach(() => {
  process.env.BEEPER_API_TOKEN = "test-token";
});

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("uploadAsset", () => {
  it("throws when token is missing", async () => {
    delete process.env.BEEPER_API_TOKEN;
    await expect(uploadAsset("/tmp/x.jpg", { fetchImpl: vi.fn() })).rejects.toThrow(
      /BEEPER_API_TOKEN/
    );
  });

  it("throws when file doesn't exist", async () => {
    await expect(
      uploadAsset("/tmp/__nope__.jpg", { fetchImpl: vi.fn() })
    ).rejects.toThrow(/File not found/);
  });

  it("POSTs multipart to /v1/assets/upload and returns uploadID", async () => {
    const tmp = "/tmp/__beeper_test_upload__.jpg";
    fs.writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff]));
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ uploadID: "u_123", fileName: "x.jpg" }));
    const out = await uploadAsset(tmp, { fetchImpl: fakeFetch, base: "http://x" });
    expect(out.uploadID).toBe("u_123");
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe("http://x/v1/assets/upload");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.body).toBeInstanceOf(FormData);
    fs.unlinkSync(tmp);
  });

  it("surfaces API errors with status", async () => {
    const tmp = "/tmp/__beeper_test_upload2__.jpg";
    fs.writeFileSync(tmp, Buffer.from([0xff]));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    });
    await expect(
      uploadAsset(tmp, { fetchImpl: fakeFetch })
    ).rejects.toMatchObject({ status: 401 });
    fs.unlinkSync(tmp);
  });
});

describe("sendChatMessage", () => {
  it("POSTs JSON with text + attachment", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ chatID: "c1", pendingMessageID: "m1" }));
    const out = await sendChatMessage(
      "c1",
      { text: "hi", attachment: { uploadID: "u1", type: "image" } },
      { fetchImpl: fakeFetch, base: "http://x" }
    );
    expect(out.pendingMessageID).toBe("m1");
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe("http://x/v1/chats/c1/messages");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      text: "hi",
      attachment: { uploadID: "u1", type: "image" },
    });
  });

  it("requires chatID", async () => {
    await expect(
      sendChatMessage("", { text: "hi" }, { fetchImpl: vi.fn() })
    ).rejects.toThrow(/chatID required/);
  });
});

describe("sendRoomPhotos", () => {
  it("sends each photo as its own message, caption on first only", async () => {
    const tmp1 = "/tmp/__send_photos_1__.jpg";
    const tmp2 = "/tmp/__send_photos_2__.jpg";
    fs.writeFileSync(tmp1, Buffer.from([1]));
    fs.writeFileSync(tmp2, Buffer.from([2]));
    // 2 uploads + 2 sends = 4 calls
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ uploadID: "u1" }))
      .mockResolvedValueOnce(jsonResponse({ chatID: "c", pendingMessageID: "m1" }))
      .mockResolvedValueOnce(jsonResponse({ uploadID: "u2" }))
      .mockResolvedValueOnce(jsonResponse({ chatID: "c", pendingMessageID: "m2" }));

    const out = await sendRoomPhotos(
      "c",
      [{ code: "TG-STD1", path: tmp1 }, { code: "TG-STD2", path: tmp2 }],
      { caption: "here are the rooms" },
      { fetchImpl: fakeFetch }
    );
    expect(out).toHaveLength(2);
    expect(out[0].ok).toBe(true);
    expect(out[1].ok).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(4);
    // 2nd call is the first send-message — should have caption
    const firstSendBody = JSON.parse(fakeFetch.mock.calls[1][1].body);
    expect(firstSendBody.text).toBe("here are the rooms");
    // 4th call is the second send-message — no caption
    const secondSendBody = JSON.parse(fakeFetch.mock.calls[3][1].body);
    expect(secondSendBody.text).toBeUndefined();
    fs.unlinkSync(tmp1);
    fs.unlinkSync(tmp2);
  });

  it("records failures per-photo without aborting the batch", async () => {
    const tmp1 = "/tmp/__send_photos_fail__.jpg";
    fs.writeFileSync(tmp1, Buffer.from([3]));
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    const out = await sendRoomPhotos(
      "c",
      [{ code: "TG-STD1", path: tmp1 }],
      {},
      { fetchImpl: fakeFetch }
    );
    expect(out[0].ok).toBe(false);
    expect(out[0].error).toMatch(/500/);
    fs.unlinkSync(tmp1);
  });
});
