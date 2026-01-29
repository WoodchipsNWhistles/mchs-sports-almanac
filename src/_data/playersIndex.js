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
// - prefer explicit fields from _derived JSON
// - fallback to splitting `name` if needed
function deriveLastName(player) {
  const last = safeStr(player.last || player.lastName);
  if (last) return last;

  const name = safeStr(player.name);
  if (!name) return "";

  // If "Last, First"
  if (name.includes(",")) return safeStr(name.split(",")[0]);

  // Else assume last token
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function deriveGradYear(player, playerID) {
  const gy = safeNum(player.gradYear ?? player.gradyear ?? player.grad);
  if (gy) return gy;

  // Optional fallback: if you ever embed gradYear in playerID suffix, add logic here.
  // For now, return null if not present in derived JSON.
  return null;
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

      const id = canonPlayerID(p) || f.replace(/\.json$/i, "");
      const name = safeStr(p.name) || id;

      const last = deriveLastName(p);
      const gradYear = deriveGradYear(p, id);

      players.push({
        playerID: id,
        name,
        last,
        gradYear, // number or null
      });
    } catch (e) {
      // If one bad JSON exists, don’t fail the whole build.
      // You can surface this later if you want.
      continue;
    }
  }

  return players;
}

module.exports = () => {
  const all = readAllDerivedPlayers();

  // Sort A–Z by last name, then first/name, then ID
  const byLastName = [...all].sort((a, b) => {
    const al = safeStr(a.last).toUpperCase();
    const bl = safeStr(b.last).toUpperCase();
    if (al !== bl) return al.localeCompare(bl);

    const an = safeStr(a.name).toUpperCase();
    const bn = safeStr(b.name).toUpperCase();
    if (an !== bn) return an.localeCompare(bn);

    return safeStr(a.playerID).localeCompare(safeStr(b.playerID));
  });

  // Group by grad year (descending years later in template)
  const byGradYear = {};
  for (const p of all) {
    const gy = p.gradYear;
    const key = gy ? String(gy) : "Unknown";
    if (!byGradYear[key]) byGradYear[key] = [];
    byGradYear[key].push(p);
  }

  // Sort each gradYear group
  for (const k of Object.keys(byGradYear)) {
    byGradYear[k].sort((a, b) => {
      const an = safeStr(a.name).toUpperCase();
      const bn = safeStr(b.name).toUpperCase();
      if (an !== bn) return an.localeCompare(bn);
      return safeStr(a.playerID).localeCompare(safeStr(b.playerID));
    });
  }

  // Year keys sorted numerically descending, with "Unknown" last
  const gradYearKeys = Object.keys(byGradYear).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return Number(b) - Number(a);
  });

  return {
    all,
    byLastName,
    byGradYear,
    gradYearKeys,
  };
};
