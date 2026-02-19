const fs = require("fs");
const path = require("path");

function canonPlayerID(o) {
  return o?.playerID || o?.playerId || o?.PlayerID || o?.PlayerId || null;
}

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
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

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

const lwbbDir = path.join(process.cwd(), "src", "lwbb", "data");
const outDir = path.join(process.cwd(), "src", "_derived", "players");
ensureDir(outDir);

// Build a “best available” identity per playerId using the latest roster row we see.
// We’ll prefer rows with gradYear, and if multiple, we’ll take the one with the latest season file.
const byId = new Map();

for (const f of listSeasonFiles(lwbbDir)) {
  const seasonYear = Number(f.replace(".json", ""));
  const season = readJSON(path.join(lwbbDir, f));
  const roster = Array.isArray(season.roster) ? season.roster : [];

  for (const r of roster) {
    const id = canonPlayerID(r);
    if (!id) continue;

    const cur = byId.get(id);

    const candidate = {
      playerId: String(id),
      name: safeStr(r.name) || safeStr(`${r.firstName || ""} ${r.lastName || ""}`),
      firstName: safeStr(r.firstName),
      lastName: safeStr(r.lastName),
      gradYear: safeNum(r.gradYear),
      // keep these if present (harmless, helps later)
      playerIdBase: safeStr(r.playerIdBase),
      playerIdSuffix: r.playerIdSuffix ?? null,
      _srcSport: "LWBB",
      _srcSeasonYearEnd: seasonYear,
    };

    if (!cur) {
      byId.set(id, candidate);
      continue;
    }

    // Prefer having a gradYear, and prefer later season files as a tiebreaker.
    const curHasGY = !!safeNum(cur.gradYear);
    const candHasGY = !!safeNum(candidate.gradYear);

    if (!curHasGY && candHasGY) {
      byId.set(id, candidate);
    } else if (curHasGY === candHasGY) {
      if ((candidate._srcSeasonYearEnd ?? 0) > (cur._srcSeasonYearEnd ?? 0)) {
        byId.set(id, candidate);
      }
    }
  }
}

let wrote = 0;
let skipped = 0;

for (const [id, p] of byId.entries()) {
  const outPath = path.join(outDir, `${id}.json`);

  if (fs.existsSync(outPath)) {
    skipped += 1;
    continue;
  }

  // Minimal, stable payload: match existing derived style (name + gradYear + id fields)
  const payload = {
    playerId: p.playerId,
    playerID: p.playerId, // keep both to be friendly with existing code
    name: p.name || p.playerId,
    first: p.firstName || "",
    last: p.lastName || "",
    gradYear: p.gradYear,
    playerIdBase: p.playerIdBase || "",
    playerIdSuffix: p.playerIdSuffix,
    source: "LWBB-roster",
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  wrote += 1;
}

console.log("LWBB derived players discovered:", byId.size);
console.log("Wrote new derived player files:", wrote);
console.log("Skipped (already existed):", skipped);
console.log("Output dir:", outDir);
