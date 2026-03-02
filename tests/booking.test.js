import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function withTempDb(run) {
  const oldDbPath = process.env.DB_PATH;
  const oldDataDir = process.env.DATA_DIR;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mondzorg-test-"));
  process.env.DATA_DIR = tempDir;
  process.env.DB_PATH = path.join(tempDir, "planning.db");

  try {
    const mod = await import(`../src/db.js?test=${Date.now()}-${Math.random()}`);
    await run(mod);
  } finally {
    if (oldDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = oldDbPath;
    }
    if (oldDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = oldDataDir;
    }
  }
}

test("boeking zonder datum kiest eerste beschikbare dag", async () => {
  await withTempDb(async ({ runMigrations, upsertAvailableDay, createBooking }) => {
    runMigrations();

    upsertAvailableDay({
      serviceDate: "2099-01-10",
      location: "Locatie 1",
      capacity: 1,
      isEnabled: true
    });
    upsertAvailableDay({
      serviceDate: "2099-01-11",
      location: "Locatie 1",
      capacity: 2,
      isEnabled: true
    });

    const booking1 = createBooking({
      location: "Locatie 1",
      parentName: "Ouder 1",
      parentEmail: "",
      parentPhone: "0611111111",
      childName: "Kind 1",
      childDob: "2018-01-01",
      language: "uk"
    });
    assert.equal(booking1.serviceDate, "2099-01-10");
    assert.equal(booking1.startTime, "15:00");

    const booking2 = createBooking({
      location: "Locatie 1",
      parentName: "Ouder 2",
      parentEmail: "",
      parentPhone: "0622222222",
      childName: "Kind 2",
      childDob: "2017-02-02",
      language: "uk"
    });
    assert.equal(booking2.serviceDate, "2099-01-11");
    assert.equal(booking2.startTime, "15:00");
  });
});

test("e-mail is optioneel bij boeken", async () => {
  await withTempDb(async ({ runMigrations, upsertAvailableDay, createBooking }) => {
    runMigrations();
    upsertAvailableDay({
      serviceDate: "2099-02-10",
      location: "Locatie 2",
      capacity: 1,
      isEnabled: true
    });

    const booking = createBooking({
      serviceDate: "2099-02-10",
      location: "Locatie 2",
      parentName: "Ouder zonder mail",
      parentEmail: "",
      parentPhone: "0633333333",
      childName: "Kind 3",
      childDob: "2016-03-03",
      language: "uk"
    });

    assert.equal(booking.parentEmail, "");
    assert.equal(booking.serviceDate, "2099-02-10");
  });
});
