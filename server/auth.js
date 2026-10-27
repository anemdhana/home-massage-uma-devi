import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function secret() {
  if (process.env.COOKIE_SECRET) return process.env.COOKIE_SECRET;
  if (process.env.VERCEL) {
    const error = new Error("Set COOKIE_SECRET on Vercel.");
    error.status = 503;
    error.code = "VALIDATION";
    throw error;
  }
  return "uma-dev-local-secret";
}
const MAX_AGE = 14 * 24 * 60 * 60;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function signSession(mobile) {
  const payload = Buffer.from(
    JSON.stringify({ mobile, exp: Date.now() + MAX_AGE * 1000 })
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(cookieHeader) {
  const match = String(cookieHeader || "").match(/(?:^|;\s*)uma_session=([^;]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.mobile || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  const parts = [
    `uma_session=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${MAX_AGE}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie() {
  return "uma_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}
