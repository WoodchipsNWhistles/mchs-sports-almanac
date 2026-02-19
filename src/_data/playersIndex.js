const fs = require("fs");
const path = require("path");

function safeStr(x) {
  return (x ?? "").toString().trim();
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function canonPlayerID(obj) {
  return obj?.playerID || obj?.playerId || obj?.PlayerID || obj?.PlayerId || null;
}

// Very light “best effort” parse:
// - prefer explicit fields from JSON
// - fallback to splitting `name` if needed
function deriveLastNameFromName(name) {
  const nm = safeStr(name);
  if (!nm) return "";
  if (nm.includes(",")) return safeStr(nm.split(",")[0]);
  const parts = nm.split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function deriveLastName(player) {
  const last = safeStr(player.last || player.lastName);
  if (last) return last;
  return deriveLastNameFromName(player.name);
}

function deriveGradYear(player /*, playerID */) {
  const gy = safeNum(player.gradYear ?? player.gradyear ?? player.grad);
  return gy || null;
}

function readAllDerivedPlayers() {
  const dir = path.join(process.cwd(), "src", "_derived", "players");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => {
      if (!f.toLowerCase().endsWith(".json")) return false;

      // Exclude non-player artifacts
      const base = f.replace(/\.json$/i, "").toLowerCase();
      if (base === "index") return false;

      return true;
    })
    .sort();

  const players = [];

  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const raw = fs.readFileSync(full, "utf8");
      const p = JSON.parse(raw);

      const id = canonPlayerID(p);
      if (!id) continue; // skip non-canonical derived artifacts

      const name = safeStr(p.name) || id;

      const last = deriveLastName(p);
      const gradYear = deriveGradYear(p, id);

      players.push({
        personID: id,
        name,
        last,
        gradYear, // number or null
        role: "Player",
      });
    } catch (e) {
      // One bad JSON shouldn’t fail the whole build
      continue;
    }
  }

  return players;
}

function readAllCoachesFromLookup() {
  const file = path.join(process.cwd(), "src", "_data", "coachIdLookup.json");
  if (!fs.existsSync(file)) return [];

  try {
    const raw = fs.readFileSync(file, "utf8");
    const j = JSON.parse(raw);

    // Support multiple shapes:
    // 1) Array of rows: [ {CoachIDPasted,...}, ... ]
    // 2) Object with rows/data: { rows:[...]} or { data:[...] }
    const rows = Array.isArray(j)
      ? j
      : (Array.isArray(j.rows) && j.rows) || (Array.isArray(j.data) && j.data) || [];

    return rows
      .map((r) => {
        const id = safeStr(r.CoachIDPasted);
        const name = safeStr(r.DisplayName) || safeStr(r.Name_Normalized) || id;
        if (!id || !name) return null;

        const last = deriveLastNameFromName(name);

        return {
          personID: id,
          name,
          last,
          gradYear: null,
          role: "Coach",
          notes: safeStr(r.Notes),
          nameNormalized: safeStr(r.Name_Normalized),
        };
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}


function sortPeopleAZ(a, b) {
  const al = safeStr(a.last).toUpperCase();
  const bl = safeStr(b.last).toUpperCase();
  if (al !== bl) return al.localeCompare(bl);

  const an = safeStr(a.name).toUpperCase();
  const bn = safeStr(b.name).toUpperCase();
  if (an !== bn) return an.localeCompare(bn);

  return safeStr(a.personID).localeCompare(safeStr(b.personID));
}

module.exports = () => {
  const players = readAllDerivedPlayers();
  const coaches = readAllCoachesFromLookup();

  // Merge into People (Players + Coaches)
  const allPeople = [...players, ...coaches];

  // A–Z list: everyone
  const byLastName = [...allPeople].sort(sortPeopleAZ);

  // Grad Year grouping: players only (or anyone with a gradYear)
  const byGradYear = {};
  for (const p of players) {
    const gy = p.gradYear;
    const key = gy ? String(gy) : "Unknown";
    if (!byGradYear[key]) byGradYear[key] = [];
    byGradYear[key].push(p);
  }

  for (const k of Object.keys(byGradYear)) {
    byGradYear[k].sort(sortPeopleAZ);
  }

  const gradYearKeys = Object.keys(byGradYear).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return Number(b) - Number(a);
  });

  return {
    all: allPeople,
    players,
    coaches,
    byLastName,
    byGradYear,
    gradYearKeys,
  };
};
