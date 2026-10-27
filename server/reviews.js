import { HttpError, toInstant, todayYmd } from "./slots.js";

function clean(value) {
  return String(value ?? "").trim();
}

function fail(field, message) {
  throw new HttpError(400, "VALIDATION", message, field);
}

function mobileOf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function displayName(customerName) {
  const first = clean(customerName).split(/\s+/)[0] || "Customer";
  return first.slice(0, 40);
}

function publicReview(row) {
  return {
    id: row.id,
    packageId: row.packageId,
    packageName: row.packageName,
    rating: Number(row.rating),
    summary: row.summary,
    displayName: row.displayName,
    date: todayYmd(new Date(row.createdAt).getTime()),
  };
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

async function bookingForReview(db, reference, mobile) {
  const code = clean(reference).toUpperCase().replace(/\s+/g, "");
  const phone = mobileOf(mobile);
  if (!/^UD[0-9A-Z]{4}$/.test(code)) fail("reference", "Enter the booking reference from your confirmation.");
  if (!/^[6-9][0-9]{9}$/.test(phone)) fail("mobile", "Enter the 10-digit mobile used for the booking.");
  const row = await db.get("SELECT * FROM bookings WHERE reference = ?", code);
  if (!row || row.mobile !== phone) fail("reference", "That booking reference and mobile do not match.");
  return row;
}

function visitState(row, existing) {
  if (existing) return "done";
  if (row.status === "CANCELLED") return "cancelled";
  const ended = toInstant(row.date, row.end) <= new Date().toISOString();
  if (row.status === "COMPLETED" || ended) return "ready";
  return "early";
}

export async function reviewCheck(db, reference, mobile) {
  const row = await bookingForReview(db, reference, mobile);
  const existing = await db.get("SELECT * FROM reviews WHERE bookingId = ?", row.id);
  const state = visitState(row, existing);
  return {
    reference: row.reference,
    packageId: row.packageId,
    packageName: row.packageName,
    date: row.date,
    start: row.start,
    state,
    review: existing ? publicReview(existing) : null,
  };
}

export async function createReview(db, body) {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail("rating", "Choose a rating from 1 to 5.");
  const summary = clean(body.summary).replace(/\s+/g, " ");
  if (summary.length < 8) fail("summary", "Write a short note about the visit.");
  if (summary.length > 240) fail("summary", "Keep the note under 240 characters.");

  return db.transaction(async (tx) => {
    const row = await bookingForReview(tx, body.reference, body.mobile);
    const existing = await tx.get("SELECT id FROM reviews WHERE bookingId = ?", row.id);
    const state = visitState(row, existing);
    if (state === "done") throw new HttpError(409, "STATUS", "This visit already has a review.");
    if (state === "cancelled") throw new HttpError(400, "VALIDATION", "That booking was cancelled, so it cannot be rated.");
    if (state === "early") throw new HttpError(400, "VALIDATION", "You can rate this visit after it ends.");
    const id = `rv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    await tx.run(
      `INSERT INTO reviews (
        id, bookingId, packageId, packageName, rating, summary, displayName, visible, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      id,
      row.id,
      row.packageId,
      row.packageName,
      rating,
      summary,
      displayName(row.customerName),
      createdAt
    );
    return publicReview(await tx.get("SELECT * FROM reviews WHERE id = ?", id));
  });
}

export async function listReviews(db) {
  const reviews = await db.all(
    `SELECT id, packageId, packageName, rating, summary, displayName, createdAt
     FROM reviews WHERE visible = 1 ORDER BY createdAt DESC LIMIT 30`
  );
  const averages = await db.all(
    `SELECT packageId, COUNT(*) AS count, AVG(rating) AS average
     FROM reviews WHERE visible = 1 GROUP BY packageId`
  );
  return {
    reviews: reviews.map(publicReview),
    averages: averages.map((row) => ({
      packageId: row.packageId,
      count: Number(row.count),
      average: round1(row.average),
    })),
  };
}

export async function listAdminReviews(db) {
  const rows = await db.all(
    `SELECT r.id, r.packageName, r.rating, r.summary, r.displayName, r.visible, r.createdAt, b.reference
     FROM reviews r JOIN bookings b ON b.id = r.bookingId
     ORDER BY r.createdAt DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    packageName: row.packageName,
    rating: Number(row.rating),
    summary: row.summary,
    displayName: row.displayName,
    visible: !!row.visible,
    date: todayYmd(new Date(row.createdAt).getTime()),
  }));
}

export async function setReviewVisible(db, id, visible) {
  const row = await db.get("SELECT id FROM reviews WHERE id = ?", id);
  if (!row) throw new HttpError(404, "VALIDATION", "That review was not found.");
  await db.run("UPDATE reviews SET visible = ? WHERE id = ?", visible ? 1 : 0, id);
  const list = await listAdminReviews(db);
  return list.find((item) => item.id === id);
}
