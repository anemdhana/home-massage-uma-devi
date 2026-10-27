import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth.js";

const PACKAGES = [
  ["P1", "Package I – Swedish", JSON.stringify(["Head, face, and foot massage"]), 1500, 90, "individual", 1, 1],
  ["P2", "Package II", JSON.stringify(["Face, foot, deep tissue, and head, neck and shoulder"]), 1500, 90, "individual", 1, 2],
  ["P3", "Package III – Swedish Special", JSON.stringify(["Swedish, face, body polishing, and foot massage"]), 2000, 105, "individual", 1, 3],
  ["P4", "Package IV – Deep Tissue Special", JSON.stringify(["Deep tissue, face, body polishing, and foot massage"]), 2200, 105, "individual", 1, 4],
  ["C1", "Package I (Couple)", "[]", 2500, 90, "couple", 1, 5],
  ["C2", "Package II (Couple)", "[]", 2500, 90, "couple", 1, 6],
];

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS practice (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      line TEXT NOT NULL,
      therapist TEXT NOT NULL,
      city TEXT NOT NULL,
      experienceLine TEXT NOT NULL,
      phoneDisplay TEXT NOT NULL,
      phoneTel TEXT NOT NULL,
      whatsappE164 TEXT NOT NULL,
      instagram TEXT NOT NULL,
      highlights TEXT NOT NULL,
      techniques TEXT NOT NULL,
      benefits TEXT NOT NULL,
      enquireNote TEXT NOT NULL,
      timezone TEXT NOT NULL,
      leadMinutes INTEGER NOT NULL,
      horizonDays INTEGER NOT NULL,
      slotMinutes INTEGER NOT NULL,
      travelGapMinutes INTEGER NOT NULL,
      currency TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS week_hours (
      day TEXT PRIMARY KEY,
      open INTEGER NOT NULL,
      start TEXT,
      end TEXT
    );
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      includes TEXT NOT NULL,
      priceInr INTEGER NOT NULL,
      durationMinutes INTEGER NOT NULL,
      audience TEXT NOT NULL,
      bookable INTEGER NOT NULL,
      sort INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      packageId TEXT NOT NULL,
      packageName TEXT NOT NULL,
      priceInr INTEGER NOT NULL,
      durationMinutes INTEGER NOT NULL,
      audience TEXT NOT NULL,
      date TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      startAt TEXT NOT NULL,
      occupiedUntilAt TEXT NOT NULL,
      customerName TEXT NOT NULL,
      mobile TEXT NOT NULL,
      whatsappSame INTEGER NOT NULL,
      whatsappMobile TEXT NOT NULL,
      locality TEXT NOT NULL,
      address TEXT NOT NULL,
      landmark TEXT,
      note TEXT,
      secondName TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      mobile TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      bookingId TEXT NOT NULL UNIQUE,
      packageId TEXT NOT NULL,
      packageName TEXT NOT NULL,
      rating INTEGER NOT NULL,
      summary TEXT NOT NULL,
      displayName TEXT NOT NULL,
      visible INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_status_start ON bookings (status, startAt);
    CREATE INDEX IF NOT EXISTS bookings_range ON bookings (startAt, occupiedUntilAt);
    CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date);
    CREATE INDEX IF NOT EXISTS reviews_visible_created ON reviews (visible, createdAt);
    CREATE INDEX IF NOT EXISTS reviews_package ON reviews (packageId, visible);
`;

function storageError(message) {
  const error = new Error(message);
  error.status = 503;
  error.code = "VALIDATION";
  return error;
}

function wrapSqlite(raw) {
  const api = {
    async exec(sql) {
      raw.exec(sql);
    },
    async get(sql, ...args) {
      return raw.prepare(sql).get(...args);
    },
    async all(sql, ...args) {
      return raw.prepare(sql).all(...args);
    },
    async run(sql, ...args) {
      raw.prepare(sql).run(...args);
    },
    async transaction(fn) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(api);
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          raw.exec("ROLLBACK");
        } catch {
          /* already closed */
        }
        throw error;
      }
    },
  };
  return api;
}

function wrapLibsql(client) {
  const calls = (target) => ({
    async exec(sql) {
      await target.executeMultiple(sql);
    },
    async get(sql, ...args) {
      const result = await target.execute({ sql, args });
      return result.rows[0];
    },
    async all(sql, ...args) {
      const result = await target.execute({ sql, args });
      return result.rows;
    },
    async run(sql, ...args) {
      await target.execute({ sql, args });
    },
  });
  return {
    ...calls(client),
    async transaction(fn) {
      const tx = await client.transaction("write");
      try {
        const result = await fn(calls(tx));
        await tx.commit();
        return result;
      } catch (error) {
        try {
          await tx.rollback();
        } catch {
          /* already closed */
        }
        throw error;
      }
    },
  };
}

function initialPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.VERCEL) throw storageError("Set ADMIN_PASSWORD on Vercel before the first visit.");
  return "UmaD1027";
}

export async function openDatabase(root) {
  if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: "number",
    });
    const db = wrapLibsql(client);
    await db.exec(SCHEMA);
    await seed(db);
    return db;
  }
  if (process.env.VERCEL) throw storageError("Set TURSO_DATABASE_URL so bookings are kept.");
  const dir = path.join(root, "data");
  mkdirSync(dir, { recursive: true });
  const raw = new DatabaseSync(path.join(dir, "uma_devi.sqlite"));
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");
  const db = wrapSqlite(raw);
  await db.exec(SCHEMA);
  await seed(db);
  return db;
}

async function seed(db) {
  const row = await db.get("SELECT COUNT(*) AS n FROM practice");
  if (row.n > 0) return;
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO practice (
      id, name, line, therapist, city, experienceLine, phoneDisplay, phoneTel, whatsappE164, instagram,
      highlights, techniques, benefits, enquireNote, timezone, leadMinutes, horizonDays, slotMinutes, travelGapMinutes, currency
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "practice",
    "Home Massage Service",
    "Relaxation delivered to your doorstep",
    "Uma Devi",
    "Hyderabad",
    "2 years experience with excellent customer feedback",
    "+91 9959923543",
    "+919959923543",
    "919959923543",
    "uma_devi1601",
    JSON.stringify([
      { icon: "heart", label: "Relax your body" },
      { icon: "happy", label: "Relieve stress" },
      { icon: "future", label: "Improve sleep" },
      { icon: "star", label: "Feel rejuvenated" },
    ]),
    JSON.stringify([
      "Swedish massage",
      "Deep tissue massage",
      "Head, neck and shoulder",
      "Foot reflexology",
      "Body polishing",
      "Face massage",
      "Couple massage for men and women",
    ]),
    JSON.stringify([
      "Deep relaxation",
      "Stress relief",
      "Pain relief",
      "Improves sleep",
      "Body detox",
      "Improves blood circulation",
      "Better mood and energy",
      "Quality time for couples",
    ]),
    "Other couple package combinations are also available.",
    "Asia/Kolkata",
    180,
    21,
    30,
    45,
      "INR"
    );
    for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
      await tx.run("INSERT INTO week_hours (day, open, start, end) VALUES (?, 1, '09:00', '19:00')", day);
    }
    for (const pack of PACKAGES) {
      await tx.run(
        "INSERT INTO packages (id, name, includes, priceInr, durationMinutes, audience, bookable, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ...pack
      );
    }
    await tx.run(
      "INSERT INTO users (id, mobile, name, passwordHash, role) VALUES ('uma', '9959923543', 'Uma Devi', ?, 'therapist')",
      hashPassword(initialPassword())
    );
  });
}
