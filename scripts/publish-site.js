import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const out = path.join(root, "public");

const pages = [
  ["index.html", "index.html"],
  ["about.html", "about.html"],
  ["book.html", "book.html"],
  ["done.html", "book/done.html"],
  ["login.html", "desk/login.html"],
  ["uma.html", "desk/index.html"],
  ["hours.html", "desk/hours.html"],
  ["packages.html", "desk/packages.html"],
  ["review.html", "review.html"],
  ["uma-reviews.html", "desk/reviews.html"],
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of ["app.css", "icons.js", "ui.js", "home.js", "book.js", "uma.js", "hours.js", "packages.js", "review.js", "uma-reviews.js"]) {
  cpSync(path.join(site, name), path.join(out, name));
}
cpSync(path.join(site, "vendor"), path.join(out, "vendor"), { recursive: true });
cpSync(path.join(site, "uma-devi.png"), path.join(out, "uma-devi.png"));
cpSync(path.join(site, "aura-logo.png"), path.join(out, "aura-logo.png"));
cpSync(path.join(site, "phonepe.jpeg"), path.join(out, "phonepe.jpeg"));
for (const [from, to] of pages) {
  const dest = path.join(out, to);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(path.join(site, from), dest);
}
