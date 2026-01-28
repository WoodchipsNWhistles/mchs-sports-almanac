const fs = require("fs");
const path = require("path");

function pickCoachId(r) {
  return (
    r.coachId ||
    r.CoachIDPasted ||
    r.CoachID ||
    r.coachID ||
    r.id ||
    r.ID ||
    null
  );
}

function pickCoachName(r) {
  // Prefer explicit display fields
  const direct =
    r.coachName ||
    r.CoachName ||
    r.displayName ||
    r.DisplayName ||
    r.name ||
    r.Name ||
    r.fullName ||
    r.FullName ||
    null;

  if (direct) return String(direct).trim();

  // Try First/Last combos if present
  const first = r.firstName || r.FirstName || "";
  const last = r.lastName || r.LastName || "";
  const combo = `${String(first).trim()} ${String(last).trim()}`.trim();
  return combo || null;
}

module.exports = function () {
  const p = path.join(process.cwd(), "src", "_data", "coachIdLookup.json");
  if (!fs.existsSync(p)) return {};

  const rows = JSON.parse(fs.readFileSync(p, "utf8")) || [];
  const idx = {};

  for (const r of rows) {
    const coachId = pickCoachId(r);
    if (!coachId) continue;

    const key = String(coachId).trim();
    idx[key] = {
      ...r,
      coachId: key,
      coachName: pickCoachName(r) || key,
    };
  }

  return idx;
};
