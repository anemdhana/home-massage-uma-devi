import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clearSessionCookie, readSession, sessionCookie, signSession, verifyPassword } from "./auth.js";
import { openDatabase } from "./db.js";
import { HttpError, addDays, availability, bookingJson, changeStatus, holdBooking, todayYmd, toInstant } from "./slots.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const port = Number(process.env.PORT || 8090);
let db;
let opening;

function getDb() {
  if (!opening) {
    opening = openDatabase(root).catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

const pages = {
  "/": "index.html",
  "/book": "book.html",
  "/book/done": "done.html",
  "/uma/login": "login.html",
  "/uma": "uma.html",
  "/uma/hours": "hours.html",
  "/uma/packages": "packages.html",
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function send(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

function ok(res, data, status = 200, extra = {}) {
  send(res, status, { data }, extra);
}

function fail(res, error) {
  const status = error.status || 500;
  const code = error.code || "VALIDATION";
  const message = status === 500 ? "Something went wrong. Try again." : error.message;
  if (status === 500) console.error(error);
  send(res, status, { error: { code, message, field: error.field || null } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100000) {
        reject(new HttpError(400, "VALIDATION", "That request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "VALIDATION", "The request could not be read."));
      }
    });
    req.on("error", reject);
  });
}

async function therapist(req) {
  const session = readSession(req.headers.cookie);
  if (!session) throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
  const user = await db.get("SELECT mobile, name, role FROM users WHERE mobile = ?", session.mobile);
  if (!user || user.role !== "therapist") throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
  return user;
}

function packageJson(row) {
  return {
    id: row.id,
    name: row.name,
    includes: JSON.parse(row.includes || "[]"),
    priceInr: row.priceInr,
    durationMinutes: row.durationMinutes,
    audience: row.audience,
    bookable: !!row.bookable,
  };
}

async function practiceJson() {
  const row = await db.get("SELECT * FROM practice WHERE id = 'practice'");
  return {
    name: row.name,
    line: row.line,
    therapist: row.therapist,
    city: row.city,
    experienceLine: row.experienceLine,
    phoneDisplay: row.phoneDisplay,
    phoneTel: row.phoneTel,
    whatsappE164: row.whatsappE164,
    instagram: row.instagram,
    highlights: JSON.parse(row.highlights),
    techniques: JSON.parse(row.techniques),
    benefits: JSON.parse(row.benefits),
    enquireNote: row.enquireNote,
    timezone: row.timezone,
    leadMinutes: row.leadMinutes,
    horizonDays: row.horizonDays,
    slotMinutes: row.slotMinutes,
  };
}

async function listBookings(view, page, pageSize) {
  const today = todayYmd();
  let where = "date < ?";
  let params = [today];
  let order = "startAt DESC";
  if (view === "today") {
    where = "date = ?";
    order = "start ASC";
  } else if (view === "upcoming") {
    where = "date > ? AND status IN ('HELD', 'CONFIRMED')";
    order = "startAt ASC";
  } else if (view !== "past") {
    throw new HttpError(400, "VALIDATION", "Choose today, upcoming, or past.");
  }
  const total = (await db.get(`SELECT COUNT(*) AS n FROM bookings WHERE ${where}`, ...params)).n;
  const rows = await db.all(
    `SELECT id, reference, date, start, end, packageName, customerName, locality, status, priceInr
       FROM bookings WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize
  );
  return { rows, total, page, pageSize };
}

async function overlapsForBlock(date, start, end) {
  const startAt = toInstant(date, start);
  const endAt = toInstant(date, end);
  const rows = await db.all(
    `SELECT reference FROM bookings
       WHERE status IN ('HELD', 'CONFIRMED', 'COMPLETED')
         AND startAt < ? AND occupiedUntilAt > ?
       ORDER BY startAt`,
    endAt,
    startAt
  );
  return rows.map((row) => row.reference);
}

function parseHours(body) {
  const days = Array.isArray(body.days) ? body.days : null;
  if (!days || days.length !== 7) throw new HttpError(400, "VALIDATION", "Save all seven days.");
  const seen = new Set();
  const clean = days.map((day) => {
    if (!DAYS.includes(day.day) || seen.has(day.day)) {
      throw new HttpError(400, "VALIDATION", "Each weekday is listed once.");
    }
    seen.add(day.day);
    if (!day.open) return { day: day.day, open: 0, start: null, end: null };
    if (!/^\d{2}:\d{2}$/.test(day.start || "") || !/^\d{2}:\d{2}$/.test(day.end || "") || day.end <= day.start) {
      throw new HttpError(400, "VALIDATION", `Check the hours for ${day.day}.`, "days");
    }
    const [sh, sm] = day.start.split(":").map(Number);
    const [eh, em] = day.end.split(":").map(Number);
    if (sm % 30 || em % 30) throw new HttpError(400, "VALIDATION", `Use a 30-minute step for ${day.day}.`);
    return { day: day.day, open: 1, start: day.start, end: day.end };
  });
  if (seen.size !== 7) throw new HttpError(400, "VALIDATION", "Save all seven days.");
  return clean;
}

async function hoursJson() {
  const order = Object.fromEntries(DAYS.map((day, index) => [day, index]));
  const days = (await db.all("SELECT day, open, start, end FROM week_hours"))
    .sort((a, b) => order[a.day] - order[b.day])
    .map((row) => ({ day: row.day, open: !!row.open, start: row.start, end: row.end }));
  return { id: "week", days };
}

async function handleApi(req, res, url) {
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  const route = pathname.slice("/api/v1".length) || "/";
  const method = req.method;

  if (method === "GET" && route === "/practice") return ok(res, await practiceJson());
  if (method === "GET" && route === "/packages") {
    const rows = (await db.all("SELECT * FROM packages ORDER BY sort")).map(packageJson);
    return ok(res, rows);
  }
  if (method === "GET" && route === "/availability") {
    const data = await availability(db, url.searchParams.get("packageId"), url.searchParams.get("from") || todayYmd(), url.searchParams.get("to") || todayYmd());
    return ok(res, data);
  }
  if (method === "POST" && route === "/bookings") {
    const body = await readBody(req);
    return ok(res, await holdBooking(db, body), 201);
  }
  if (method === "POST" && route === "/auth/login") {
    const body = await readBody(req);
    const user = await db.get("SELECT * FROM users WHERE mobile = ?", String(body.mobile || "").trim());
    if (!user || !verifyPassword(body.password || "", user.passwordHash)) {
      throw new HttpError(401, "UNAUTHORIZED", "That mobile or password does not match.");
    }
    return ok(res, { mobile: user.mobile, name: user.name, role: user.role, home: "/uma" }, 200, {
      "set-cookie": sessionCookie(signSession(user.mobile)),
    });
  }

  if (method === "POST" && route === "/auth/logout") {
    await therapist(req);
    return ok(res, { ok: true }, 200, { "set-cookie": clearSessionCookie() });
  }
  if (method === "GET" && route === "/auth/me") {
    return ok(res, await therapist(req));
  }
  if (method === "GET" && route === "/admin/bookings") {
    await therapist(req);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
    const list = await listBookings(url.searchParams.get("view") || "today", page, pageSize);
    return send(res, 200, { data: list.rows, page: list.page, pageSize: list.pageSize, total: list.total });
  }
  const bookingMatch = route.match(/^\/admin\/bookings\/([^/]+)$/);
  if (bookingMatch && method === "GET") {
    await therapist(req);
    const row = bookingJson(await db.get("SELECT * FROM bookings WHERE id = ?", decodeURIComponent(bookingMatch[1])));
    if (!row) throw new HttpError(404, "VALIDATION", "That booking was not found.");
    return ok(res, row);
  }
  const statusMatch = route.match(/^\/admin\/bookings\/([^/]+)\/status$/);
  if (statusMatch && method === "POST") {
    await therapist(req);
    const body = await readBody(req);
    return ok(res, await changeStatus(db, decodeURIComponent(statusMatch[1]), body.status));
  }
  if (method === "GET" && route === "/admin/hours") {
    await therapist(req);
    return ok(res, await hoursJson());
  }
  if (method === "PUT" && route === "/admin/hours") {
    await therapist(req);
    const days = parseHours(await readBody(req));
    await db.transaction(async (tx) => {
      for (const day of days) await tx.run("UPDATE week_hours SET open = ?, start = ?, end = ? WHERE day = ?", day.open, day.start, day.end, day.day);
    });
    return ok(res, await hoursJson());
  }
  if (method === "GET" && route === "/admin/blocks") {
    await therapist(req);
    const from = url.searchParams.get("from") || todayYmd();
    const to = url.searchParams.get("to") || addDays(from, 21);
    const rows = await db.all("SELECT id, date, start, end, note FROM blocks WHERE date >= ? AND date <= ? ORDER BY date, start", from, to);
    return ok(res, rows);
  }
  if (method === "POST" && route === "/admin/blocks") {
    await therapist(req);
    const body = await readBody(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "") || !/^\d{2}:\d{2}$/.test(body.start || "") || !/^\d{2}:\d{2}$/.test(body.end || "") || body.end <= body.start) {
      throw new HttpError(400, "VALIDATION", "Choose a date, a start, and a later end.");
    }
    const id = `bl_${Date.now().toString(36)}`;
    const note = String(body.note || "").trim();
    await db.run("INSERT INTO blocks (id, date, start, end, note) VALUES (?, ?, ?, ?, ?)", id, body.date, body.start, body.end, note);
    return send(res, 201, {
      data: { id, date: body.date, start: body.start, end: body.end, note, overlaps: await overlapsForBlock(body.date, body.start, body.end) },
    });
  }
  const blockMatch = route.match(/^\/admin\/blocks\/([^/]+)$/);
  if (blockMatch && method === "DELETE") {
    await therapist(req);
    await db.run("DELETE FROM blocks WHERE id = ?", decodeURIComponent(blockMatch[1]));
    return ok(res, { ok: true });
  }
  const packageMatch = route.match(/^\/admin\/packages\/([^/]+)$/);
  if (packageMatch && method === "PUT") {
    await therapist(req);
    const id = decodeURIComponent(packageMatch[1]);
    const current = await db.get("SELECT * FROM packages WHERE id = ?", id);
    if (!current) throw new HttpError(404, "VALIDATION", "That package was not found.");
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const includes = Array.isArray(body.includes) ? body.includes.map((line) => String(line).trim()).filter(Boolean) : [];
    const priceInr = Number(body.priceInr);
    const durationMinutes = Number(body.durationMinutes);
    if (name.length < 2) throw new HttpError(400, "VALIDATION", "Enter a package name.", "name");
    if (!Number.isInteger(priceInr) || priceInr < 0) throw new HttpError(400, "VALIDATION", "Enter the price in rupees.", "priceInr");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 240) {
      throw new HttpError(400, "VALIDATION", "Choose a duration between 30 and 240 minutes.", "durationMinutes");
    }
    await db.run(
      "UPDATE packages SET name = ?, includes = ?, priceInr = ?, durationMinutes = ?, bookable = ? WHERE id = ?",
      name,
      JSON.stringify(includes),
      priceInr,
      durationMinutes,
      body.bookable === false ? 0 : 1,
      id
    );
    return ok(res, packageJson(await db.get("SELECT * FROM packages WHERE id = ?", id)));
  }
  throw new HttpError(404, "VALIDATION", "That page was not found.");
}

function serveFile(res, filePath) {
  if (!filePath.startsWith(site) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

function requestUrl(req) {
  const host = req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "http";
  let raw = req.url || "/";
  if (!raw.startsWith("/api/") && Array.isArray(req.query?.path)) {
    const query = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
    raw = `/api/v1/${req.query.path.map((part) => encodeURIComponent(part)).join("/")}${query}`;
  }
  return new URL(raw, `${proto}://${host}`);
}

export async function handleRequest(req, res) {
  try {
    db = await getDb();
    const url = requestUrl(req);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    const pathname = decodeURIComponent(url.pathname.replace(/\/$/, "") || "/");
    const page = pages[pathname];
    if (page) return serveFile(res, path.join(site, page));
    const rel = pathname.replace(/^\/+/, "");
    const asset = path.resolve(site, rel);
    if (asset !== site && !asset.startsWith(site + path.sep)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    serveFile(res, asset);
  } catch (error) {
    if (!res.headersSent) fail(res, error);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  createServer(handleRequest).listen(port, () => {
    console.log(`Uma Devi booking http://localhost:${port}`);
  });
}
