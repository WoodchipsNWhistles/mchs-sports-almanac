// src/gwbb/_lib/playerNameLookup.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "src", "gwbb", "data");

function pickName(p) {
  // Try common shapes you've used elsewhere
  if (!p || typeof p !== "object") return null;

  // already composed
  if (p.name) return String(p.name);

  const first = p.first || p.firstName;
  const last = p.last || p.lastName;

  if (first && last) return `${first} ${last}`;
  if (last) return String(last);
  return null;
}
function getAny(obj, candidates) {
  if (!obj || typeof obj !== "object") return undefined;

  // direct hits first
  for (const k of candidates) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }

  // case-insensitive fallback
  const lower = Object.create(null);
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = k;

  for (const k of candidates) {
    const realKey = lower[String(k).toLowerCase()];
    if (realKey && obj[realKey] !== undefined && obj[realKey] !== null && obj[realKey] !== "")
      return obj[realKey];
  }

  return undefined;
}

function getPlayerID(x) {
  return getAny(x, ["playerID", "playerId", "PlayerID", "PlayerId"]);
}

function getName(x) {
  return getAny(x, ["name", "Name", "playerName", "PlayerName", "fullName", "FullName"]);
}

module.exports = function buildPlayerNameLookup() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(DATA_DIR, f));

  const lookup = {}; // playerID -> name

  for (const file of files) {
    const season = JSON.parse(fs.readFileSync(file, "utf8"));

    // Try the most likely roster keys
    const roster =
      (Array.isArray(season.roster) && season.roster) ||
      (Array.isArray(season.players) && season.players) ||
      (Array.isArray(season.teamRoster) && season.teamRoster) ||
      [];

    for (const p of roster) {
const playerID = getPlayerID(p);
if (!playerID) continue;

if (!lookup[playerID]) {
  const nm = getName(p) || pickName(p);
  if (nm) lookup[playerID] = String(nm);
}

    }
  }

  return lookup;
};
