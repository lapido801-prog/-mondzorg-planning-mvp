import test from "node:test";
import assert from "node:assert/strict";
import { computeNextSlot, slotWindow } from "../src/scheduler.js";

test("computeNextSlot geeft eerste vrije aaneengesloten slot terug", () => {
  assert.equal(computeNextSlot([], 4), 0);
  assert.equal(computeNextSlot([0], 4), 1);
  assert.equal(computeNextSlot([0, 2], 4), 1);
  assert.equal(computeNextSlot([1, 2], 4), 0);
});

test("computeNextSlot geeft null bij volle dag", () => {
  assert.equal(computeNextSlot([0, 1, 2], 3), null);
});

test("slotWindow rekent vaste 30-minuten vensters vanaf 15:00", () => {
  assert.deepEqual(slotWindow(0), { startTime: "15:00", endTime: "15:30" });
  assert.deepEqual(slotWindow(1), { startTime: "15:30", endTime: "16:00" });
  assert.deepEqual(slotWindow(3), { startTime: "16:30", endTime: "17:00" });
});
