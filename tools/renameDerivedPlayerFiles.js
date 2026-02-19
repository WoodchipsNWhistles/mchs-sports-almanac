const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(process.cwd(), "src", "_data", "personIndex.json");
const DERIVED_DIR = path.join(process.cwd(), "src", "_derived", "players");

const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));

function looksOldId(stem) {
  return /^[A-Z]{3}[A-Z]{3}\d{4}$/.test(stem);
}

let renamed = 0;
let skippedExists = 0;

for (const ent of fs.readdirSync(DERIVED_DIR, { withFileTypes: true })) {
  if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
  if (ent.name === "index.json") continue;

  const stem = ent.name.replace(/\.json$/, "");
  if (!looksOldId(stem)) continue;

  const pid = index.byAlias[stem];
  if (!pid) continue;

  const from = path.join(DERIVED_DIR, ent.name);
  const to = path.join(DERIVED_DIR, `${pid}.json`);

  if (fs.existsSync(to)) {
    skippedExists++;
    continue;
  }

  fs.renameSync(from, to);
  renamed++;
}

console.log(`Renamed: ${renamed}`);
console.log(`Skipped (target exists): ${skippedExists}`);