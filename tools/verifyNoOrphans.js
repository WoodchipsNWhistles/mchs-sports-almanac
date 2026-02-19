const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const INDEX_PATH = path.join(process.cwd(), "src", "_data", "personIndex.json");

// p_0000000001 format
const PID_RE = /\bp_\d{10}\b/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && (p.endsWith(".json") || p.endsWith(".njk") || p.endsWith(".js"))) out.push(p);
  }
  return out;
}

const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const known = new Set(Object.keys(index.people || {}));
const seen = new Set();

// Scan src/ for pid references
for (const f of walk(ROOT)) {
  const txt = fs.readFileSync(f, "utf8");
  const m = txt.match(PID_RE);
  if (!m) continue;
  for (const pid of m) seen.add(pid);
}

// Orphans = referenced but not present in personIndex.people
const orphans = Array.from(seen).filter(pid => !known.has(pid)).sort();

console.log(`Unique pids referenced in src/: ${seen.size}`);
console.log(`Known pids in personIndex: ${known.size}`);
console.log(`Orphans: ${orphans.length}`);

if (orphans.length) {
  console.log(`Sample orphans: ${orphans.slice(0, 50).join(", ")}`);
  process.exit(2);
}