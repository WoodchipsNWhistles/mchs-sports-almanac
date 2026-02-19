const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const INDEX_PATH = path.join(process.cwd(), "src", "_data", "personIndex.json");
const MERGES_PATH = path.join(process.cwd(), "tools", "personMerges.json");

const OLD_ID_RE = /\b([A-Z]{3}[A-Z]{3}\d{4})\b/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && (p.endsWith(".json") || p.endsWith(".njk") || p.endsWith(".js"))) out.push(p);
  }
  return out;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const index = loadJson(INDEX_PATH);
const merges = fs.existsSync(MERGES_PATH) ? (loadJson(MERGES_PATH).hard_merge || {}) : {};

function resolveMerge(oldId) {
  let cur = oldId;
  const seen = new Set();
  while (merges[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = merges[cur];
  }
  return cur;
}

function mapOldToPid(oldId) {
  const canon = resolveMerge(oldId);
  return index.byAlias[canon] || null;
}

let filesTouched = 0;
let totalReplacements = 0;
const missing = new Set();

for (const f of walk(ROOT)) {
  const txt = fs.readFileSync(f, "utf8");
  let didTouch = false;

  const out = txt.replace(OLD_ID_RE, (full, id) => {
    const pid = mapOldToPid(id);
    if (!pid) {
      missing.add(resolveMerge(id));
      return full; // leave it
    }
    totalReplacements++;
    didTouch = true;
    return pid;
  });

  if (didTouch) {
    fs.writeFileSync(f, out, "utf8");
    filesTouched++;
  }
}

console.log(`Files touched: ${filesTouched}`);
console.log(`Total replacements: ${totalReplacements}`);

if (missing.size) {
  console.log(`Missing mappings (need byAlias entries): ${missing.size}`);
  console.log(Array.from(missing).slice(0, 80).join(", "));
  process.exit(2);
}