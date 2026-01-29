console.log("LOADED: src/gwbb/_data/careerTotals.js");

// src/gwbb/_data/careerTotals.js
const fs = require("fs");
const path = require("path");

// Adjust if your season JSONs live somewhere else:
const DATA_DIR = path.join(process.cwd(), "src", "gwbb", "data");

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(m, a) {
  return a > 0 ? m / a : null;
}

module.exports = function () {
  // Load all season JSON files in src/gwbb/data (e.g., 2012.json, 2025.json)
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(DATA_DIR, f));

  const byPlayer = new Map();

  let seasonsScanned = 0;
  let rowsScanned = 0;

  for (const file of files) {
    const season = JSON.parse(fs.readFileSync(file, "utf8"));
    seasonsScanned++;

    const rows = Array.isArray(season.gameStats) ? season.gameStats : [];
    for (const r of rows) {
      rowsScanned++;

      const playerID = r.playerID || r.playerId;
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

  // Optional: uncomment for one-time debugging
  // console.log({ seasonsScanned, rowsScanned, players: out.length });

  return out;
};
