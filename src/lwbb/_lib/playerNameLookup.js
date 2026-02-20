// src/lwbb/_lib/playerNameLookup.js
const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(process.cwd(), "src", "_data", "personIndex.json");

function makeNameFromIndex(v) {
  const direct =
    (v?.display || v?.name || v?.fullName || v?.displayName || "").trim();
  if (direct) return direct;

  const first = (v?.first || v?.firstName || "").trim();
  const last = (v?.last || v?.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

module.exports = function buildPlayerNameLookup() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch {
    return {};
  }

  const people = raw?.people && typeof raw.people === "object" ? raw.people : {};
  const out = {};

  for (const [pid, rec] of Object.entries(people)) {
    if (!pid.startsWith("p_")) continue;
    const nm = makeNameFromIndex(rec);
    if (nm) out[pid] = nm;
  }

  return out;
};