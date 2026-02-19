// src/lwbb/_lib/careerTotals.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "src", "lwbb", "data");

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(m, a) {
  return a > 0 ? m / a : null;
}

function isDoubleDoubleFlag(v) {
  // Accept: true, "true", 1, "1"
  if (v === true) return true;
  if (v === "true") return true;
  return Number(v) === 1;
}

module.exports = function buildLwbbCareerTotals() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(DATA_DIR, f));

  const byPlayer = new Map();

  for (const file of files) {
    const season = JSON.parse(fs.readFileSync(file, "utf8"));

    const rows = Array.isArray(season.gameStats) ? season.gameStats : [];
    for (const r of rows) {
      const playerID = r.playerID || r.playerId || r.PlayerID || r.PlayerId;
      if (!playerID) continue;

      const cur = byPlayer.get(playerID) || {
        playerID,
        gp: 0,
        pts: 0,
        reb: 0,
        twoPM: 0,
        twoPA: 0,
        threePM: 0,
        threePA: 0,
        ftM: 0,
        ftA: 0,
        doubleDoubles: 0,
      };

      // one row = one game appearance
      cur.gp += 1;

      cur.pts += toNum(r.pts);
      cur.reb += toNum(r.reb);

      cur.twoPM += toNum(r.twoPM);
      cur.twoPA += toNum(r.twoPA);
      cur.threePM += toNum(r.threePM);
      cur.threePA += toNum(r.threePA);
      cur.ftM += toNum(r.ftM);
      cur.ftA += toNum(r.ftA);

      // Double-doubles flag (if present)
      const dd = r.doubleDouble ?? r.doubleDoubles ?? r.dd;
      if (isDoubleDoubleFlag(dd)) {
        cur.doubleDoubles += 1;
      }

      byPlayer.set(playerID, cur);
    }
  }

  const out = Array.from(byPlayer.values()).map((p) => {
    const fgM = p.twoPM + p.threePM;
    const fgA = p.twoPA + p.threePA;

    return {
      ...p,
      fgM,
      fgA,
      fgPct: pct(fgM, fgA),
      threePct: pct(p.threePM, p.threePA),
      ftPct: pct(p.ftM, p.ftA),
    };
  });

  return out;
};
