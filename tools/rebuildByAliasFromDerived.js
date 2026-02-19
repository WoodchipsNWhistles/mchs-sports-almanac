const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(process.cwd(), "src", "_data", "personIndex.json");
const DERIVED_DIR = path.join(process.cwd(), "src", "_derived", "players");

const PID_RE = /\bp_\d{10}\b/;

function looksOldId(stem) {
  return /^[A-Z]{3}[A-Z]{3}\d{4}$/.test(stem);
}

function extractPid(obj) {
  if (!obj) return null;

  // Common key guesses first
  const directKeys = ["playerID", "personID", "pid", "id"];
  for (const k of directKeys) {
    const v = obj[k];
    if (typeof v === "string" && PID_RE.test(v)) return v.match(PID_RE)[0];
  }

  // Fallback: scan the JSON string for the first pid
  const s = JSON.stringify(obj);
  const m = s.match(PID_RE);
  return m ? m[0] : null;
}

const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
index.byAlias = index.byAlias || {};
index.people = index.people || {};
index.meta = index.meta || {};

let mapped = 0;
let missingPid = 0;

for (const ent of fs.readdirSync(DERIVED_DIR, { withFileTypes: true })) {
  if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
  if (ent.name === "index.json") continue;

  const stem = ent.name.replace(/\.json$/, "");
  if (!looksOldId(stem)) continue;

  const full = path.join(DERIVED_DIR, ent.name);
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    missingPid++;
    continue;
  }

  const pid = extractPid(obj);
  if (!pid) {
    missingPid++;
    continue;
  }

  index.byAlias[stem] = pid;
  mapped++;
}

index.meta.updated = "2026-02-19";

fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf8");

console.log(`Derived files scanned (old-id filenames): ${mapped + missingPid}`);
console.log(`byAlias mappings written: ${mapped}`);
console.log(`Files missing pid inside JSON: ${missingPid}`);