const fs = require("fs");
const path = require("path");

const BOX_DIR = path.join(process.cwd(), "src", "gwbb", "boxscores");
const SEASON_DIR = path.join(process.cwd(), "src", "gwbb", "data");

function safeJsonParse(txt, filename) {
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filename}: ${e.message}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Basketball-style decimal: .451 (instead of 45.1%)
function pctDecimal(m, a) {
  if (!a || a === 0) return "—";
  return (m / a).toFixed(3).replace(/^0/, "");
}

// Percent style: 45.1%
function pctPercent(m, a) {
  if (!a || a === 0) return "—";
  return (100 * (m / a)).toFixed(1) + "%";
}

function sum(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function getSeasonYearEndFromGameID(gameID) {
  // GWBB2025-YYYYMMDD-...
  const token = gameID.slice(4, 8);
  const yr = Number(token);
  return Number.isFinite(yr) ? yr : null;
}

function loadSeason(seasonYearEnd) {
  if (!seasonYearEnd) return null;
  const seasonPath = path.join(SEASON_DIR, `${seasonYearEnd}.json`);
  if (!fs.existsSync(seasonPath)) return null;
  const raw = fs.readFileSync(seasonPath, "utf-8");
  return safeJsonParse(raw, `${seasonYearEnd}.json`);
}

module.exports = class BoxscorePages {
  async data() {
    const files = fs
      .readdirSync(BOX_DIR)
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .sort();

    const boxscores = files.map((filename) => {
      const fullPath = path.join(BOX_DIR, filename);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const obj = safeJsonParse(raw, filename);

      const gameID = obj.gameID || path.basename(filename, ".json");
      const seasonYearEnd =
        obj.seasonYearEnd || getSeasonYearEndFromGameID(gameID);

      return {
        ...obj,
        gameID,
        seasonYearEnd,
        __sourceFile: filename,
      };
    });

    return {
      boxscores,

      pagination: { data: "boxscores", size: 1, alias: "boxscore" },

      permalink: (data) =>
        `/gwbb/boxscores/${data.boxscore.gameID}/index.html`,

      layout: "base.njk",

      eleventyComputed: {
        title: (data) => `${data.boxscore.gameID} — Box Score`,
        description: (data) => {
          const b = data.boxscore;
          return `GWBB box score: ${b.opponent || "Opponent"} (${b.dateISO || ""})`;
        },
      },
    };
  }

  render(data) {
    const b = data.boxscore;
    const dateDisplay = b.dateLabel || b.dateISO || b.date || "";

    const siteLabel =
  b.siteCode === "H" ? "Home" :
  b.siteCode === "A" ? "Away" :
  b.siteCode === "N" ? "Neutral" :
  b.siteCode === "U" ? "Unknown" :
  "";


    const seasonYearEnd = b.seasonYearEnd || 2025;
    const season = loadSeason(seasonYearEnd);

   const roster = (season && (season.roster || season.players)) || [];
const gameStats = (season && (season.gameStats || season.stats)) || [];

// Build roster lookup FIRST
const rosterById = {};
for (const p of roster) {
  if (p && p.playerID) rosterById[p.playerID] = p;
}

// Now filter stats to this game AND only our roster players
const rows = gameStats.filter(
  (r) => r.gameID === b.gameID && r.playerID && rosterById[r.playerID]
);

// Aggregate any duplicate lines for the same playerID in the same game
const agg = new Map();

for (const r of rows) {
  const key = r.playerID;
  const prev = agg.get(key) || {
    playerID: key,
    jersey: r.jersey ?? "",
    playerName: r.playerName ?? "",
    twoPM: 0, twoPA: 0,
    threePM: 0, threePA: 0,
    ftM: 0, ftA: 0,
    pts: 0,
    reb: 0,
  };

  prev.jersey = r.jersey ?? prev.jersey;
  prev.playerName = r.playerName ?? prev.playerName;

  prev.twoPM += Number(r.twoPM) || 0;
  prev.twoPA += Number(r.twoPA) || 0;
  prev.threePM += Number(r.threePM) || 0;
  prev.threePA += Number(r.threePA) || 0;
  prev.ftM += Number(r.ftM) || 0;
  prev.ftA += Number(r.ftA) || 0;
  prev.pts += Number(r.pts) || 0;
  prev.reb += Number(r.reb) || 0;

  agg.set(key, prev);
}

// Normalize + enrich player rows for display (one row per player)
const playerRows = Array.from(agg.values()).map((r) => {
  const p = rosterById[r.playerID] || {};
  const pts = r.pts || 0;
  const reb = r.reb || 0;

  return {
    playerID: r.playerID,
    jersey: r.jersey ?? p.jersey ?? "",
    name:
      r.playerName ??
      p.name ??
      `${p.first || ""} ${p.last || ""}`.trim(),
    twoPM: r.twoPM || 0,
    twoPA: r.twoPA || 0,
    threePM: r.threePM || 0,
    threePA: r.threePA || 0,
    ftM: r.ftM || 0,
    ftA: r.ftA || 0,
    pts,
    reb,
    tenPlus: pts >= 10,
    doubleDouble: pts >= 10 && reb >= 10,
  };
});



    // Sort: jersey asc; fallback name
    playerRows.sort((a, c) => {
      const aj = Number(a.jersey);
      const cj = Number(c.jersey);
      if (Number.isFinite(aj) && Number.isFinite(cj) && aj !== cj) return aj - cj;
      return String(a.name).localeCompare(String(c.name));
    });

    // Team totals
    const twoM = sum(playerRows, "twoPM");
    const twoA = sum(playerRows, "twoPA");
    const threeM = sum(playerRows, "threePM");
    const threeA = sum(playerRows, "threePA");
    const ftMade = sum(playerRows, "ftM");
    const ftAtt = sum(playerRows, "ftA");

    const fgM = twoM + threeM;
    const fgA = twoA + threeA;

    const has3pt = threeA > 0;
    const isStub = (b.status || "") === "stub";
    const hasStats = playerRows.length > 0;

    // Choose one: decimal (.451) is classic; swap to pctPercent if you prefer 45.1%
    const pct = pctDecimal;

    // Relative links (boxscore pages live at /gwbb/boxscores/<id>/)
    const backToGwbbHref = "../../";
    const backToSeasonHref = `../../season/${seasonYearEnd}/`;
    const seasonDataHref = `../../data/${seasonYearEnd}.json`;

    return `
<header>
  <p class="kicker"><a href="${backToGwbbHref}">← Back to GWBB</a></p>
  <h1 class="masthead-title" style="font-size:clamp(1.9rem,3.5vw,3rem);">
    Box Score
  </h1>
  <hr class="rule">
</header>

<section class="grid single">

  <main>
    <p class="kicker"><a href="${backToSeasonHref}">← Back to season</a></p>

    <div class="article">
      <h2 style="margin-top:0;">${escapeHtml(b.opponent || "Opponent")}</h2>

      <p class="small" style="margin:.25rem 0 0;">
      <strong>${escapeHtml(dateDisplay)}</strong>

        • ${escapeHtml(siteLabel || "")}
      </p>

      <p class="lede" style="margin-top:.75rem;">
        <strong>Final:</strong>
        ${escapeHtml(String(b.pf ?? ""))}–${escapeHtml(String(b.pa ?? ""))}
        ${b.outcome ? ` • <strong>${escapeHtml(b.outcome)}</strong>` : ""}
      </p>

${
  hasStats
    ? `<p class="small" style="margin:.75rem 0 0;">
        <strong>Shooting:</strong>
        FG ${fgM}-${fgA} (${pct(fgM, fgA)}) •
        ${has3pt ? `3PT ${threeM}-${threeA} (${pct(threeM, threeA)}) •` : `3PT — •`}
        FT ${ftMade}-${ftAtt} (${pct(ftMade, ftAtt)})
      </p>`
    : `<div class="box" style="margin-top:.75rem;">
         <p style="margin:0;">
           <strong>This box score is incomplete.</strong>
           If you have missing statistics, scorebooks, or official records for this game, please contact the site administrator to help improve the historical record.
         </p>
       </div>`
}


    ${
      hasStats
        ? `<div class="article">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>2PT</th>
                  <th>3PT</th>
                  <th>FT</th>
                  <th>REB</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                ${playerRows
                  .map(
                    (r) => `<tr>
                      <td>${escapeHtml(String(r.jersey))}</td>
                      <td>
<a href="../../../players/${escapeHtml(String(r.playerID))}/">
    ${escapeHtml(String(r.name))}
  </a>
</td>

                      <td>${r.twoPM}-${r.twoPA}</td>
                      <td>${has3pt ? `${r.threePM}-${r.threePA}` : "—"}</td>
                      <td>${r.ftM}-${r.ftA}</td>
                      <td>${escapeHtml(String(r.reb))}</td>
                      <td><strong>${escapeHtml(String(r.pts))}</strong></td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        : ""
    }

<div class="article">
  <div class="box">
    <h3 style="margin:0 0 .5rem; font-family: var(--masthead);">
      Data Provenance
    </h3>
    <p class="small" style="margin:0;">
      Generated from canonical season JSON and per-game boxscore JSON.
    </p>
    <p class="small" style="margin:.5rem 0 0;">
      Season:
      <a href="${seasonDataHref}">
        /gwbb/data/${seasonYearEnd}.json
      </a>
    </p>
    <p class="small" style="margin:.5rem 0 0;">
      Source file:
      <code>${escapeHtml(b.__sourceFile || "")}</code>
    </p>
  </div>
</div>

  </main>

 
</section>
`;
  }
};
