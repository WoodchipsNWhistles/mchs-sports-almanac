const fs = require("fs");
const path = require("path");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listSeasonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

function normOutcome(raw) {
  const o = (raw || "").toString().trim().toUpperCase();
  if (o === "WIN") return "W";
  if (o === "LOSS") return "L";
  if (o === "TIE") return "T";
  return null;
}

function tallySeason(season) {
  const games = season.schedule || [];
  let w = 0, l = 0, t = 0;

  for (const g of games) {
    const out = normOutcome(g.Outcome);
    if (!out) continue;
    if (out === "W") w++;
    else if (out === "L") l++;
    else t++;
  }

  return { w, l, t };
}

function tallySport(dir) {
  let w = 0, l = 0, t = 0;
  const seasonYears = [];

  for (const file of listSeasonFiles(dir)) {
    const season = readJson(file);

    // Extract year from filename (e.g., 2021.json)
    const year = Number(file.match(/(\d{4})\.json$/)?.[1]);
    if (Number.isFinite(year)) {
      seasonYears.push(year);
    }

    const part = tallySeason(season);
    w += part.w;
    l += part.l;
    t += part.t;
  }

  const decided = w + l;

  return {
    w,
    l,
    t,
    pct: decided ? w / decided : 0,
    firstSeasonYearEnd: seasonYears.length ? Math.min(...seasonYears) : null,
    lastSeasonYearEnd: seasonYears.length ? Math.max(...seasonYears) : null
  };
}
module.exports = function () {
  const root = process.cwd();
  return {
    lwbb: tallySport(path.join(root, "src", "lwbb", "data")),
    gwbb: tallySport(path.join(root, "src", "gwbb", "data")),
  };
};