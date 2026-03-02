import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { computeNextSlot, slotWindow } from "./scheduler.js";
import { isIsoDate, todayInAmsterdam } from "./time.js";

const root = path.resolve(process.cwd());
const configuredDataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data");
const dataDir = configuredDataDir;
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(dataDir, "planning.db");
const migrationsDir = path.join(root, "migrations");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

function nowIso() {
  return new Date().toISOString();
}

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const existing = new Set(
    db.prepare("SELECT name FROM schema_migrations").all().map((row) => row.name)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (existing.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)")
      .run(file, nowIso());
  }
}

export function upsertAvailableDay({ serviceDate, location, capacity, isEnabled }) {
  if (!isIsoDate(serviceDate)) {
    throw new Error("Datum moet in formaat YYYY-MM-DD zijn.");
  }
  if (!location || typeof location !== "string") {
    throw new Error("Locatie is verplicht.");
  }
  if (!Number.isInteger(capacity) || capacity <= 0 || capacity > 40) {
    throw new Error("Capaciteit moet een getal tussen 1 en 40 zijn.");
  }

  const now = nowIso();
  db.prepare(`
    INSERT INTO available_days(service_date, location, capacity, is_enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(service_date, location)
    DO UPDATE SET capacity=excluded.capacity, is_enabled=excluded.is_enabled, updated_at=excluded.updated_at
  `).run(serviceDate, location.trim(), capacity, isEnabled ? 1 : 0, now, now);
}

export function listAdminDays({ location }) {
  const trimmedLocation = (location || "").trim();
  return db.prepare(`
    SELECT
      d.service_date AS serviceDate,
      d.location AS location,
      d.capacity AS capacity,
      d.is_enabled AS isEnabled,
      COUNT(a.id) AS bookedCount
    FROM available_days d
    LEFT JOIN appointments a
      ON a.service_date = d.service_date
      AND a.location = d.location
    WHERE (? = '' OR d.location = ?)
    GROUP BY d.service_date, d.location, d.capacity, d.is_enabled
    ORDER BY d.service_date ASC
  `).all(trimmedLocation, trimmedLocation);
}

export function listPublicDays({ location }) {
  const trimmedLocation = (location || "").trim();
  const today = todayInAmsterdam();

  return db.prepare(`
    SELECT
      d.service_date AS serviceDate,
      d.location AS location,
      d.capacity AS capacity,
      COUNT(a.id) AS bookedCount
    FROM available_days d
    LEFT JOIN appointments a
      ON a.service_date = d.service_date
      AND a.location = d.location
    WHERE d.is_enabled = 1
      AND d.service_date >= ?
      AND (? = '' OR d.location = ?)
    GROUP BY d.service_date, d.location, d.capacity
    HAVING bookedCount < d.capacity
    ORDER BY d.service_date ASC
  `).all(today, trimmedLocation, trimmedLocation);
}

export function listAppointments({ serviceDate, location }) {
  if (!isIsoDate(serviceDate)) {
    throw new Error("Datum moet in formaat YYYY-MM-DD zijn.");
  }
  const trimmedLocation = (location || "").trim();
  return db.prepare(`
    SELECT
      booking_ref AS bookingRef,
      service_date AS serviceDate,
      location,
      slot_index AS slotIndex,
      start_time AS startTime,
      end_time AS endTime,
      parent_name AS parentName,
      parent_email AS parentEmail,
      parent_phone AS parentPhone,
      child_name AS childName,
      child_dob AS childDob,
      notes,
      language,
      created_at AS createdAt
    FROM appointments
    WHERE service_date = ?
      AND (? = '' OR location = ?)
    ORDER BY slot_index ASC
  `).all(serviceDate, trimmedLocation, trimmedLocation);
}

function normalizeBookingInput(input) {
  const normalized = {
    serviceDate: String(input.serviceDate || "").trim(),
    location: String(input.location || "").trim(),
    parentName: String(input.parentName || "").trim(),
    parentEmail: String(input.parentEmail || "").trim().toLowerCase(),
    parentPhone: String(input.parentPhone || "").trim(),
    childName: String(input.childName || "").trim(),
    childDob: String(input.childDob || "").trim(),
    notes: String(input.notes || "").trim(),
    language: ["nl", "en", "uk"].includes(input.language) ? input.language : "nl"
  };

  if (!isIsoDate(normalized.serviceDate)) {
    throw new Error("Kies een geldige dag.");
  }
  if (!isIsoDate(normalized.childDob)) {
    throw new Error("Geboortedatum moet in formaat YYYY-MM-DD zijn.");
  }
  if (normalized.serviceDate < todayInAmsterdam()) {
    throw new Error("Boeken in het verleden is niet toegestaan.");
  }
  if (!normalized.location) {
    throw new Error("Locatie is verplicht.");
  }
  if (!normalized.parentName || !normalized.parentEmail || !normalized.parentPhone) {
    throw new Error("Naam, e-mail en telefoon van ouder zijn verplicht.");
  }
  if (!normalized.childName) {
    throw new Error("Naam van kind is verplicht.");
  }

  return normalized;
}

export function createBooking(payload) {
  const input = normalizeBookingInput(payload);
  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    const day = db.prepare(`
      SELECT capacity, is_enabled AS isEnabled
      FROM available_days
      WHERE service_date = ? AND location = ?
      LIMIT 1
    `).get(input.serviceDate, input.location);

    if (!day || day.isEnabled !== 1) {
      throw new Error("Deze dag is niet beschikbaar voor boekingen.");
    }

    const takenSlots = db.prepare(`
      SELECT slot_index AS slotIndex
      FROM appointments
      WHERE service_date = ? AND location = ?
      ORDER BY slot_index ASC
    `).all(input.serviceDate, input.location).map((row) => row.slotIndex);

    const nextSlot = computeNextSlot(takenSlots, day.capacity);
    if (nextSlot === null) {
      throw new Error("Deze dag is al volgeboekt.");
    }

    const { startTime, endTime } = slotWindow(nextSlot);
    const bookingRef = crypto.randomUUID().split("-")[0].toUpperCase();

    db.prepare(`
      INSERT INTO appointments (
        booking_ref, service_date, location, slot_index, start_time, end_time,
        parent_name, parent_email, parent_phone, child_name, child_dob, notes, language, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingRef,
      input.serviceDate,
      input.location,
      nextSlot,
      startTime,
      endTime,
      input.parentName,
      input.parentEmail,
      input.parentPhone,
      input.childName,
      input.childDob,
      input.notes,
      input.language,
      nowIso()
    );

    db.exec("COMMIT;");
    return {
      bookingRef,
      ...input,
      slotIndex: nextSlot,
      startTime,
      endTime
    };
  } catch (error) {
    db.exec("ROLLBACK;");
    if (String(error.message || "").includes("UNIQUE")) {
      throw new Error("Dubbele boeking gedetecteerd voor dit kind op deze dag.");
    }
    throw error;
  }
}

export function getBookingByRef(bookingRef) {
  if (!bookingRef) {
    return null;
  }
  return db.prepare(`
    SELECT
      booking_ref AS bookingRef,
      service_date AS serviceDate,
      location,
      slot_index AS slotIndex,
      start_time AS startTime,
      end_time AS endTime,
      parent_name AS parentName,
      parent_email AS parentEmail,
      parent_phone AS parentPhone,
      child_name AS childName,
      child_dob AS childDob,
      notes,
      language,
      created_at AS createdAt
    FROM appointments
    WHERE booking_ref = ?
    LIMIT 1
  `).get(String(bookingRef).trim());
}
