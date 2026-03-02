CREATE TABLE IF NOT EXISTS available_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_date TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK(capacity > 0),
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(service_date, location)
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT NOT NULL UNIQUE,
  service_date TEXT NOT NULL,
  location TEXT NOT NULL,
  slot_index INTEGER NOT NULL CHECK(slot_index >= 0),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  child_name TEXT NOT NULL,
  child_dob TEXT NOT NULL,
  notes TEXT,
  language TEXT NOT NULL DEFAULT 'nl',
  created_at TEXT NOT NULL,
  UNIQUE(service_date, location, slot_index),
  UNIQUE(service_date, location, child_name, child_dob)
);
