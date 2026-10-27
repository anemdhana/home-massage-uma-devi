import { randomBytes } from "node:crypto";

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export class HttpError extends Error {
  constructor(status, code, message, field = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function kolkataParts(ms = Date.now()) {
  const map = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(ms))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  if (map.hour === "24") map.hour = "00";
  return map;
}

export function todayYmd(ms = Date.now()) {
  const p = kolkataParts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${month}-${day}`;
}

export function weekday(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function toInstant(ymd, hhmm) {
  return new Date(`${ymd}T${hhmm}:00+05:30`).toISOString();
}

export function addMinutes(ymd, hhmm, minutes) {
  return new Date(new Date(`${ymd}T${hhmm}:00+05:30`).getTime() + minutes * 60000);
}

export function clockInKolkata(date) {
  const p = kolkataParts(date.getTime());
  return `${p.hour}:${p.minute}`;
}

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function practiceRules(db) {
  return db.get("SELECT * FROM practice WHERE id = 'practice'");
}

async function hoursByDay(db) {
  const map = {};
  for (const row of await db.all("SELECT * FROM week_hours")) map[row.day] = row;
  return map;
}

function occupied(db, fromInstant, toInstantValue) {
  return db.all(
    `SELECT startAt, occupiedUntilAt FROM bookings
       WHERE status IN ('HELD', 'CONFIRMED', 'COMPLETED')
         AND startAt < ? AND occupiedUntilAt > ?`,
    toInstantValue,
    fromInstant
  );
}

async function blockRanges(db, fromYmd, toYmd) {
  const rows = await db.all("SELECT date, start, end FROM blocks WHERE date >= ? AND date <= ?", fromYmd, toYmd);
  return rows.map((row) => ({
    startAt: toInstant(row.date, row.start),
    occupiedUntilAt: toInstant(row.date, row.end),
  }));
}

export async function availability(db, packageId, fromYmd, toYmd) {
  const pack = await db.get("SELECT * FROM packages WHERE id = ?", packageId);
  if (!pack || !pack.bookable) {
    throw new HttpError(400, "PACKAGE_CLOSED", "That package is not available.");
  }
  const rules = await practiceRules(db);
  const today = todayYmd();
  const last = addDays(today, rules.horizonDays);
  const from = fromYmd < today ? today : fromYmd;
  const to = toYmd > last ? last : toYmd;
  const hours = await hoursByDay(db);
  const days = [];
  if (from <= to) {
    const busy = [
      ...(await occupied(db, toInstant(from, "00:00"), toInstant(addDays(to, 1), "00:00"))),
      ...(await blockRanges(db, from, to)),
    ];
    const nowLead = Date.now() + rules.leadMinutes * 60000;
    for (let ymd = from; ymd <= to; ymd = addDays(ymd, 1)) {
      const day = hours[weekday(ymd)];
      const starts = [];
      if (day && day.open && day.start && day.end) {
        for (let cursor = minutesOf(day.start); cursor < minutesOf(day.end); cursor += rules.slotMinutes) {
          const hh = String(Math.floor(cursor / 60)).padStart(2, "0");
          const mm = String(cursor % 60).padStart(2, "0");
          const start = `${hh}:${mm}`;
          const endAt = addMinutes(ymd, start, pack.durationMinutes);
          const untilAt = addMinutes(ymd, start, pack.durationMinutes + rules.travelGapMinutes);
          const end = clockInKolkata(endAt);
          const until = clockInKolkata(untilAt);
          const endYmd = todayYmd(endAt.getTime());
          const untilYmd = todayYmd(untilAt.getTime());
          if (endYmd !== ymd || untilYmd !== ymd) continue;
          if (end > day.end || until > day.end) continue;
          const startAt = toInstant(ymd, start);
          const occupiedUntilAt = untilAt.toISOString();
          if (new Date(startAt).getTime() < nowLead) continue;
          const hit = busy.some((row) => overlaps(startAt, occupiedUntilAt, row.startAt, row.occupiedUntilAt));
          if (!hit) starts.push(start);
        }
      }
      days.push({ date: ymd, bookable: starts.length > 0, starts });
    }
  }
  return {
    packageId: pack.id,
    durationMinutes: pack.durationMinutes,
    days,
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function fail(field, message) {
  throw new HttpError(400, "VALIDATION", message, field);
}

export function holdBooking(db, body) {
  return db.transaction((tx) => insertBooking(tx, body));
}

async function insertBooking(db, body) {
  const pack = await db.get("SELECT * FROM packages WHERE id = ?", body.packageId);
  if (!pack || !pack.bookable) {
    throw new HttpError(400, "PACKAGE_CLOSED", "That package is not available.");
  }
  const name = clean(body.customerName);
  if (name.length < 2 || name.length > 80) fail("customerName", "Enter your name.");
  const mobile = clean(body.mobile);
  if (!/^[6-9][0-9]{9}$/.test(mobile)) fail("mobile", "Enter a 10-digit mobile number.");
  const whatsappSame = body.whatsappSame !== false;
  const whatsappMobile = whatsappSame ? mobile : clean(body.whatsappMobile);
  if (!whatsappSame && !/^[6-9][0-9]{9}$/.test(whatsappMobile)) {
    fail("whatsappMobile", "Enter a 10-digit WhatsApp number.");
  }
  const locality = clean(body.locality);
  if (locality.length < 2 || locality.length > 80) fail("locality", "Enter the area in Hyderabad.");
  const address = clean(body.address);
  if (address.length < 8 || address.length > 300) fail("address", "Enter the full address.");
  const landmark = clean(body.landmark);
  if (landmark.length > 120) fail("landmark", "Keep the landmark under 120 characters.");
  const note = clean(body.note);
  if (note.length > 400) fail("note", "Keep the note under 400 characters.");
  let secondName = null;
  if (pack.audience === "couple") {
    secondName = clean(body.secondName);
    if (secondName.length < 2 || secondName.length > 80) fail("secondName", "Enter the other person’s name.");
  }
  const date = clean(body.date);
  const start = clean(body.start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) {
    throw new HttpError(400, "OUTSIDE_HOURS", "Choose a date and a start time.");
  }

  const rules = await practiceRules(db);
  const day = (await hoursByDay(db))[weekday(date)];
  const startMinutes = minutesOf(start);
  if (!day || !day.open || startMinutes % rules.slotMinutes !== 0 || start < day.start) {
    throw new HttpError(400, "OUTSIDE_HOURS", "That time is outside working hours.");
  }
  const today = todayYmd();
  const last = addDays(today, rules.horizonDays);
  if (date < today) throw new HttpError(400, "OUTSIDE_HOURS", "That day has already passed.");
  if (date > last) throw new HttpError(400, "TOO_FAR", "That day is too far ahead.");

  const endAt = addMinutes(date, start, pack.durationMinutes);
  const untilAt = addMinutes(date, start, pack.durationMinutes + rules.travelGapMinutes);
  const end = clockInKolkata(endAt);
  const until = clockInKolkata(untilAt);
  if (todayYmd(endAt.getTime()) !== date || todayYmd(untilAt.getTime()) !== date || end > day.end || until > day.end) {
    throw new HttpError(400, "OUTSIDE_HOURS", "That visit runs past the end of the day.");
  }
  const startAt = toInstant(date, start);
  if (new Date(startAt).getTime() < Date.now() + rules.leadMinutes * 60000) {
    throw new HttpError(400, "TOO_SOON", "That time is too soon. Choose a later slot.");
  }
  const occupiedUntilAt = untilAt.toISOString();
  const clash = await db.get(
    `SELECT id FROM bookings
       WHERE status IN ('HELD', 'CONFIRMED', 'COMPLETED')
         AND startAt < ? AND occupiedUntilAt > ?`,
    occupiedUntilAt,
    startAt
  );
  const blocks = await db.all("SELECT id, date, start, end FROM blocks WHERE date = ?", date);
  const block = blocks.some((row) => overlaps(startAt, occupiedUntilAt, toInstant(row.date, row.start), toInstant(row.date, row.end)));
  if (clash || block) throw new HttpError(409, "SLOT_TAKEN", "That time was just taken.");

  const id = `bk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const reference = await nextReference(db);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO bookings (
      id, reference, packageId, packageName, priceInr, durationMinutes, audience,
      date, start, end, startAt, occupiedUntilAt, customerName, mobile, whatsappSame, whatsappMobile,
      locality, address, landmark, note, secondName, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HELD', ?, ?)`,
    id,
    reference,
    pack.id,
    pack.name,
    pack.priceInr,
    pack.durationMinutes,
    pack.audience,
    date,
    start,
    end,
    startAt,
    occupiedUntilAt,
    name,
    mobile,
    whatsappSame ? 1 : 0,
    whatsappMobile,
    locality,
    address,
    landmark,
    note,
    secondName,
    now,
    now
  );
  return {
    reference,
    status: "HELD",
    packageName: pack.name,
    priceInr: pack.priceInr,
    durationMinutes: pack.durationMinutes,
    date,
    start,
    end,
    locality,
  };
}

async function nextReference(db) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let code = "UD";
    const bytes = randomBytes(4);
    for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
    if (!(await db.get("SELECT 1 AS n FROM bookings WHERE reference = ?", code))) return code;
  }
  throw new HttpError(400, "VALIDATION", "Could not save the booking. Try again.");
}

const STATUS_NEXT = {
  HELD: ["CONFIRMED", "COMPLETED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
};

export async function changeStatus(db, id, status) {
  const row = await db.get("SELECT * FROM bookings WHERE id = ?", id);
  if (!row) throw new HttpError(404, "VALIDATION", "That booking was not found.");
  if (!STATUS_NEXT[row.status]?.includes(status)) {
    throw new HttpError(409, "STATUS", "That booking can no longer be changed that way.");
  }
  const now = new Date().toISOString();
  await db.run("UPDATE bookings SET status = ?, updatedAt = ? WHERE id = ?", status, now, id);
  return bookingJson(await db.get("SELECT * FROM bookings WHERE id = ?", id));
}

export function bookingJson(row) {
  if (!row) return null;
  return {
    ...row,
    whatsappSame: !!row.whatsappSame,
    landmark: row.landmark || "",
    note: row.note || "",
    secondName: row.secondName || null,
  };
}
