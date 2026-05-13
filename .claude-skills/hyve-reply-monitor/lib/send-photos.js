// lib/send-photos.js
// Send room photos via Beeper Desktop Local API.
//
// API docs: https://developers.beeper.com/desktop-api-reference
//
// Setup (one-time, per user):
//   1. Beeper Desktop → Settings → Developers → toggle Local API ON
//   2. Copy the generated API token
//   3. Export BEEPER_API_TOKEN=<token> in your shell, or pass via opts.token
//
// Flow per photo:
//   POST /v1/assets/upload (multipart: file) → { uploadID }
//   POST /v1/chats/{chatID}/messages         { text?, attachment: { uploadID, type: "image" } }

import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASE = "http://localhost:23373";
const DEFAULT_TIMEOUT_MS = 30_000;

class BeeperApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "BeeperApiError";
    this.status = status;
    this.body = body;
  }
}

function getToken(opts = {}) {
  const t = opts.token || process.env.BEEPER_API_TOKEN;
  if (!t) {
    throw new BeeperApiError(
      "BEEPER_API_TOKEN not set. Enable Beeper Desktop Local API in Settings → Developers and export the token."
    );
  }
  return t;
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new BeeperApiError(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload a single local file as a Beeper asset.
 * Returns { uploadID, srcURL?, ... }
 */
export async function uploadAsset(filePath, opts = {}) {
  const { base = DEFAULT_BASE, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const token = getToken(opts);
  if (!fs.existsSync(filePath)) {
    throw new BeeperApiError(`File not found: ${filePath}`);
  }
  const buf = await fs.promises.readFile(filePath);
  const fileName = path.basename(filePath);
  const mimeType = guessMime(filePath);

  const fd = new FormData();
  fd.set("file", new Blob([buf], { type: mimeType }), fileName);
  fd.set("fileName", fileName);
  fd.set("mimeType", mimeType);

  const resp = await withTimeout(
    fetchImpl(`${base}/v1/assets/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    }),
    timeoutMs,
    "assets/upload"
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new BeeperApiError(`assets/upload ${resp.status}`, { status: resp.status, body });
  }
  return resp.json();
}

/**
 * Send a single message (text and/or single attachment) to a chat.
 */
export async function sendChatMessage(chatID, { text, attachment }, opts = {}) {
  const { base = DEFAULT_BASE, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const token = getToken(opts);
  if (!chatID) throw new BeeperApiError("chatID required");

  const body = {};
  if (text) body.text = text;
  if (attachment) body.attachment = attachment;

  const resp = await withTimeout(
    fetchImpl(`${base}/v1/chats/${encodeURIComponent(chatID)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    timeoutMs,
    "chats/messages"
  );
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new BeeperApiError(`chats/messages ${resp.status}`, { status: resp.status, body: txt });
  }
  return resp.json();
}

/**
 * Convenience: upload + send a single photo with optional caption.
 */
export async function sendPhoto(chatID, filePath, { caption } = {}, opts = {}) {
  const asset = await uploadAsset(filePath, opts);
  if (!asset.uploadID) throw new BeeperApiError("upload returned no uploadID", { body: asset });
  return sendChatMessage(
    chatID,
    {
      text: caption,
      attachment: {
        uploadID: asset.uploadID,
        type: "image",
        fileName: asset.fileName || path.basename(filePath),
      },
    },
    opts
  );
}

/**
 * Send multiple photos to one chat. Each goes as its own message.
 * Returns array of per-photo results: { code?, path, ok, error?, response? }.
 *
 * Beeper's send-message endpoint takes ONE attachment per call, so we send sequentially.
 */
export async function sendRoomPhotos(chatID, photos, { caption } = {}, opts = {}) {
  const results = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const filePath = typeof p === "string" ? p : p.path;
    const code = typeof p === "string" ? null : p.code;
    // Only attach a caption to the first photo so the chat isn't spammed
    const cap = i === 0 ? caption : undefined;
    try {
      const resp = await sendPhoto(chatID, filePath, { caption: cap }, opts);
      results.push({ code, path: filePath, ok: true, response: resp });
    } catch (e) {
      results.push({ code, path: filePath, ok: false, error: String(e.message || e) });
    }
  }
  return results;
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
    }[ext] || "application/octet-stream"
  );
}

export { BeeperApiError };
