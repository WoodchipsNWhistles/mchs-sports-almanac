const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "src");
const INDEX_PATH = path.join(process.cwd(), "src", "_data", "personIndex.json");
const MERGES_PATH = path.join(process.cwd(), "tools", "personMerges.json");

// Matches your old derived IDs like ABEDYL2021 (and ignores CLAELL2026-01 due to hyphen)
const OLD_ID_RE = /\b[A-Z]{3}[A-Z]{3}\d{4}\b/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && (p.endsWith(".json") || p.endsWith(".njk") || p.endsWith(".js"))) out.push(p);
  }
  return out;
}

function pad10(n) {
  return String(n).padStart(10, "0");
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

// 1) Collect all old IDs across project
const found = new Set();
for (const f of walk(ROOT)) {
  const txt = fs.readFileSync(f, "utf8");
  const m = txt.match(OLD_ID_RE);
  if (!m) continue;
  for (const id of m) found.add(id);
}

// 2) Canonicalize via merges
const canonical = new Set(Array.from(found, resolveMerge));

// 3) Ensure containers + nextPid exists
index.people = index.people || {};
index.byAlias = index.byAlias || {};
index.meta = index.meta || {};
if (!Number.isInteger(index.meta.nextPid)) index.meta.nextPid = 26;

let minted = 0;

// 4) Deterministic order keeps output stable
for (const oldId of Array.from(canonical).sort()) {
  if (index.byAlias[oldId]) continue;

  const pid = `p_${pad10(index.meta.nextPid++)}`;
  index.byAlias[oldId] = pid;

  // Create placeholder person record if missing
  if (!index.people[pid]) {
    index.people[pid] = {
      display: oldId,
      sort: oldId,
      roles: ["player"],
      aliases: [oldId]
    };
  }
  minted++;
}

index.meta.updated = "2026-02-19";

// 5) Write back
fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf8");

// 6) Report
console.log(`Old IDs found (raw): ${found.size}`);
console.log(`Old IDs canonical (post-merge): ${canonical.size}`);
console.log(`New p_ minted this run: ${minted}`);
console.log(`nextPid is now: ${index.meta.nextPid}`);