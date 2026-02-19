const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && (p.endsWith(".json") || p.endsWith(".njk") || p.endsWith(".js"))) out.push(p);
  }
  return out;
}

const OLD_ID = /\b[A-Z]{3}[A-Z]{3}\d{4}\b/g;

let hits = 0;

for (const f of walk(ROOT)) {
  const txt = fs.readFileSync(f, "utf8");
  const m = txt.match(OLD_ID);
  if (m && m.length) {
    hits += m.length;
    console.log(`${f}  (${m.length})  ${Array.from(new Set(m)).slice(0, 12).join(", ")}${m.length > 12 ? ", ..." : ""}`);
  }
}

console.log(`\nTotal old-id hits: ${hits}`);
process.exit(hits ? 1 : 0);