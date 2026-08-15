import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "./withTimeout.js";

test("fast promise passes through untouched", async () => {
  const v = await withTimeout(Promise.resolve(42), 1000, "nope");
  assert.equal(v, 42);
});

test("slow promise rejects with the given message", async () => {
  const never = new Promise(() => {});
  await assert.rejects(
    withTimeout(never, 20, "Sign-in timed out"),
    /Sign-in timed out/,
  );
});

test("rejection of the wrapped promise wins over the timer", async () => {
  await assert.rejects(
    withTimeout(Promise.reject(new Error("real error")), 1000, "nope"),
    /real error/,
  );
});
