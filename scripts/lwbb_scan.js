const fs = require("fs");
const path = require("path");

function canonPlayerID(o) {
  return (
    o?.playerID ||
    o?.playerId ||
    o?.PlayerID ||
    o?.PlayerId ||
    null
  );
}

function listSeasonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort();
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const lwbbDir = path.join(process.cwd(), "src", "lwbb", "data");
const derivedDir = path.join(process.cwd(), "src", "_derived", "players");

const derived = new Set(
  (fs.existsSync(derivedDir) ? fs.readdirSync(derivedDir) : [])
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => f.replace(/\.json$/i, ""))
);

const lwbbIDs = new Set();

for (const f of listSeasonFiles(lwbbDir)) {
  const season = readJSON(path.join(lwbbDir, f));
  const roster = season.roster || [];

  for (const r of roster) {
    const id = canonPlayerID(r);
    if (id) lwbbIDs.add(String(id));
  }
}

const missing = [];

for (const id of lwbbIDs) {
  if (!derived.has(id)) missing.push(id);
}

missing.sort();

console.log("LWBB roster playerIDs:", lwbbIDs.size);
console.log("Derived player JSONs:", derived.size);
console.log("LWBB IDs missing from _derived:", missing.length);
console.log("First 25 missing:", missing.slice(0, 25));
