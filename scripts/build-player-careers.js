/* Build derived career JSON for players (initially GWBB varsity only)
 *
 * Inputs:
 *   src/gwbb/data/*.json  (starting with 2025.json)
 *
 * Outputs:
 *   src/_derived/players/<playerID>.json
 *   src/_derived/players/index.json
 */

const fs = require("fs");
const path = require("path");

const INPUT_DIR = path.join("src", "gwbb", "data");
const OUTPUT_DIR = path.join("src", "_derived", "players");

// Bootstrap defaults (current project state)
const DEFAULT_SPORT_CODE = "GWBB";
const DEFAULT_LEVEL = "V";
const DEFAULT_ROLE = "athlete";

// ---------- helpers ----------
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// tolerate either top-level or season-scoped shapes
function getRoster(seasonJson) {
  return seasonJson?.season?.roster ?? seasonJson?.roster ?? [];
}

function getGameStats(seasonJson) {
  return seasonJson?.season?.gameStats ?? seasonJson?.gameStats ?? [];
}

function getSeasonYearEndFromFilename(filename) {
  const m = filename.match(/^(\d{4})\.json$/);
  return m ? Number(m[1]) : null;
}

// ---------- main ----------
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const seasonFiles = fs
  .readdirSync(INPUT_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

const players = new Map();
const index = [];

for (const file of seasonFiles) {
  const seasonPath = path.join(INPUT_DIR, file);
  const seasonJson = readJson(seasonPath);

  const roster = getRoster(seasonJson);
  const gameStats = getGameStats(seasonJson);

  const seasonYearEnd = getSeasonYearEndFromFilename(file);
  if (!seasonYearEnd) continue;

  // group stats by playerID
  const statsByPlayer = new Map();
  for (const row of gameStats) {
    const pid = row?.playerID || row?.PlayerID;
    if (!pid) continue;
    if (!statsByPlayer.has(pid)) statsByPlayer.set(pid, []);
    statsByPlayer.get(pid).push(row);
  }

  for (const r of roster) {
    const pid = r?.playerID || r?.PlayerID;
    if (!pid) continue;

    if (!players.has(pid)) {
      players.set(pid, {
        playerID: pid,

playerIDBase: r.playerIDBase ?? r.PlayerID_Base ?? null,
playerIDSuffix: r.playerIDSuffix ?? r.PlayerID_Suffix ?? null,
jersey: r.jersey ?? r.Jersey ?? null,
first: r.first ?? r.FirstName ?? null,
last: r.last ?? r.LastName ?? null,
name: r.name ?? r.Name ?? ((r.FirstName && r.LastName) ? `${r.FirstName} ${r.LastName}` : null),
pos: r.pos ?? r.Position ?? null,
grade: r.grade ?? r.Grade ?? null,
gradeFull: r.gradeFull ?? r.GradeFull ?? null,
gradYear: r.gradYear ?? r.GraduationYear ?? null,


        participation: [],
        seasons: []
      });
    }

    const career = players.get(pid);

    // participation (derived)
    career.participation.push({
      sportCode: DEFAULT_SPORT_CODE,
      seasonYearEnd,
      level: DEFAULT_LEVEL,
      role: DEFAULT_ROLE
    });

    const lines = statsByPlayer.get(pid) ?? [];

    const totals = lines.reduce(
      (acc, row) => {
        acc.games += 1;
        acc.pts += safeNum(row.pts);
        acc.reb += safeNum(row.reb);
        acc.twoPM += safeNum(row.twoPM);
        acc.twoPA += safeNum(row.twoPA);
        acc.threePM += safeNum(row.threePM);
        acc.threePA += safeNum(row.threePA);
        acc.ftM += safeNum(row.ftM);
        acc.ftA += safeNum(row.ftA);
        return acc;
      },
      {
        games: 0,
        pts: 0,
        reb: 0,
        twoPM: 0,
        twoPA: 0,
        threePM: 0,
        threePA: 0,
        ftM: 0,
        ftA: 0
      }
    );

    career.seasons.push({
      sportCode: DEFAULT_SPORT_CODE,
      seasonYearEnd,
      level: DEFAULT_LEVEL,
      gamesPlayed: totals.games,
      totals,
      gameStats: lines
    });
  }
}

// write output files
for (const [pid, career] of players.entries()) {
  career.participation.sort((a, b) => a.seasonYearEnd - b.seasonYearEnd);
  career.seasons.sort((a, b) => a.seasonYearEnd - b.seasonYearEnd);

  writeJson(path.join(OUTPUT_DIR, `${pid}.json`), career);

  index.push({
    playerID: pid,
    name: career.name,
    last: career.last,
    first: career.first,
    gradYear: career.gradYear
  });
}

index.sort((a, b) => {
  const la = (a.last ?? "").toUpperCase();
  const lb = (b.last ?? "").toUpperCase();
  if (la !== lb) return la.localeCompare(lb);
  const fa = (a.first ?? "").toUpperCase();
  const fb = (b.first ?? "").toUpperCase();
  if (fa !== fb) return fa.localeCompare(fb);
  return a.playerID.localeCompare(b.playerID);
});

writeJson(path.join(OUTPUT_DIR, "index.json"), index);

console.log(
  `Built ${players.size} player career files from ${seasonFiles.length} season file(s).`
);
