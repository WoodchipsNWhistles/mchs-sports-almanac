// PERFORMANCE NOTE:
// Season JSON is cached/indexed once here on purpose.
// Do not re-read or re-parse season files inside render().

const fs = require("fs");
const path = require("path");

const SEASON_DIR = path.join(process.cwd(), "src", "lwbb", "data");
const opponents = require("../../meta/opponents.canon.json");

// -----------------------------
// Helpers
// -----------------------------
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

function pctDecimal(m, a) {
  if (!a || a === 0) return "—";
  return (m / a).toFixed(3).replace(/^0/, "");
}

function pctPercent(m, a) {
  if (!a || a === 0) return "—";
  return (100 * (m / a)).toFixed(1) + "%";
}

function sum(rows, key) {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function oppCodeFromBoxscore(b) {
  return (
    b.oppCode ||
    b.opponentCode ||
    b.opponentSlug ||
    (b.gameIDBase ? String(b.gameIDBase).split("-").pop() : null) ||
    (b.gameID ? String(b.gameID).split("-").pop() : null) ||
    null
  );
}

function oppNameFromCode(code) {
  return code && opponents.byCode && opponents.byCode[code] && opponents.byCode[code].name
    ? opponents.byCode[code].name
    : "Opponent";
}

function getSeasonYearEndFromGameID(gameID) {
  if (!gameID || String(gameID).length < 8) return null;
  const token = String(gameID).slice(4, 8);
  const yr = Number(token);
  return Number.isFinite(yr) ? yr : null;
}

function formatUsDate(isoLike) {
  if (!isoLike) return "";
  const s = String(isoLike);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const ymd = m ? m[1] : s.slice(0, 10);

  const d = new Date(ymd + "T00:00:00");
  if (Number.isNaN(d.getTime())) return ymd;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function gameIdFromRow(r) {
  return r.gameId || r.gameID || r.GameID || r.GameID_Base || null;
}

function playerIdFromRow(r) {
  return r.playerID || r.PlayerID || r.playerId || r.PlayerId || null;
}

function playerIdFromRoster(p) {
  return p.playerID || p.PlayerID || p.playerId || p.PlayerId || null;
}

// -----------------------------
// Season cache / index
// -----------------------------
const seasonCache = new Map();

function loadSeasonIndexed(seasonYearEnd) {
  if (!seasonYearEnd) return null;

  if (seasonCache.has(seasonYearEnd)) {
    return seasonCache.get(seasonYearEnd);
  }

  const seasonPath = path.join(SEASON_DIR, `${seasonYearEnd}.json`);
  if (!fs.existsSync(seasonPath)) {
    seasonCache.set(seasonYearEnd, null);
    return null;
  }

  const raw = fs.readFileSync(seasonPath, "utf-8");
  const season = safeJsonParse(raw, `${seasonYearEnd}.json`);

  const roster = season.roster || season.players || [];
  const gameStats = season.gameStats || season.stats || [];

  const rosterById = {};
  for (const p of roster) {
    const pid = playerIdFromRoster(p);
    if (pid) rosterById[pid] = p;
  }

  const rowsByGame = new Map();
  for (const r of gameStats) {
    const gid = gameIdFromRow(r);
    if (!gid) continue;
    if (!rowsByGame.has(gid)) rowsByGame.set(gid, []);
    rowsByGame.get(gid).push(r);
  }

  const indexed = {
    season,
    roster,
    gameStats,
    rosterById,
    rowsByGame,
  };

  seasonCache.set(seasonYearEnd, indexed);
  return indexed;
}

// -----------------------------
// Template
// -----------------------------
module.exports = class BoxscorePages {
  async data() {
    const seasonFiles = fs
      .readdirSync(SEASON_DIR)
      .filter((f) => /^\d{4}\.json$/.test(f))
      .sort();

    const boxscores = [];

    for (const filename of seasonFiles) {
      const seasonYearEnd = Number(filename.replace(".json", ""));
      const indexed = loadSeasonIndexed(seasonYearEnd);
      if (!indexed || !indexed.season) continue;

      const season = indexed.season;
      const schedule = season.schedule || [];

      const gameIdsFromSchedule = Array.from(
        new Set(
          schedule
            .map((g) => g.gameId || g.GameID || g.GameID_Base || g.gameIdBase)
            .filter(Boolean)
        )
      );

      for (const gameID of gameIdsFromSchedule) {
        const sched =
          schedule.find(
            (g) => (g.gameId || g.GameID || g.GameID_Base || g.gameIdBase) === gameID
          ) || {};

        boxscores.push({
          ...sched,
          gameID,
          seasonYearEnd,
          __sourceFile: filename,
          __seasonIndexed: indexed,
          __rowsAll: indexed.rowsByGame.get(gameID) || [],
        });
      }
    }

    return {
      boxscores,
      pagination: { data: "boxscores", size: 1, alias: "boxscore" },
      permalink: (data) => `/lwbb/boxscores/${data.boxscore.gameID}/index.html`,
      layout: "base.njk",
      eleventyComputed: {
        title: (data) => {
          const b = data.boxscore || {};
          const oppCode = oppCodeFromBoxscore(b);
          const opp = oppNameFromCode(oppCode);

          const dateRaw =
            b.dateISO || b.gameDate || b.GameDate || b.dateLabel || b.Date || b.date || "";
          const date = (String(dateRaw).match(/^(\d{4}-\d{2}-\d{2})/) || [null, ""])[1];

          const siteCode = b.siteCode || b.SiteCode || "";
          const atVs = siteCode === "A" ? "@" : "vs";

          return `Lady Wave Basketball - ${date || "Date Unknown"} ${atVs} ${opp}`;
        },
        description: (data) => {
          const b = data.boxscore || {};
          const code = oppCodeFromBoxscore(b);
          const name = oppNameFromCode(code);
          return `LWBB box score: ${name}`;
        },
      },
    };
  }

  render(data) {
    const b = data.boxscore || {};

    // -----------------------------
    // HEADER FIELDS
    // -----------------------------
    const oppCode = oppCodeFromBoxscore(b);
    const opponent = oppNameFromCode(oppCode);

    const dateRaw =
      b.dateISO ||
      b.gameDate ||
      b.GameDate ||
      b.dateLabel ||
      b.Date ||
      b.date ||
      "";
    const dateDisplay = formatUsDate(dateRaw);

    const siteCode = b.siteCode || b.SiteCode || "";
    const siteLabel =
      siteCode === "H"
        ? "Home"
        : siteCode === "A"
        ? "Away"
        : siteCode === "N"
        ? "Neutral"
        : siteCode === "U"
        ? "Unknown"
        : "";

    const pointsFor =
      b.pointsFor ??
      b["Points for"] ??
      b.PointsFor ??
      b["PointsFor"] ??
      null;

    const pointsAgainst =
      b.pointsAgainst ??
      b["Points Against"] ??
      b.PointsAgainst ??
      b["PointsAgainst"] ??
      null;

    const outcome = (b.outcome || b.Outcome || "").toString();

    const finalLine =
      pointsFor !== null && pointsAgainst !== null
        ? `Final: ${pointsFor}–${pointsAgainst}${outcome ? " • " + outcome : ""}`
        : "";

    // -----------------------------
    // SEASON / ROSTER / GAME ROWS
    // -----------------------------
    const seasonYearEnd = b.seasonYearEnd || getSeasonYearEndFromGameID(b.gameID);
    const indexed = b.__seasonIndexed || loadSeasonIndexed(seasonYearEnd);

    const rosterById = indexed?.rosterById || {};
    const rowsAll = b.__rowsAll || indexed?.rowsByGame?.get(b.gameID) || [];

    const rows = rowsAll.filter((r) => {
      const pid = playerIdFromRow(r);
      return pid && rosterById[pid];
    });

    // Aggregate duplicates per player
    const agg = new Map();
    for (const r of rows) {
      const pid = playerIdFromRow(r);
      if (!pid) continue;

      const prev = agg.get(pid) || {
        playerID: pid,
        jersey: r.jersey ?? r.Jersey ?? "",
        playerName: r.playerName ?? r.PlayerName ?? "",
        twoPM: 0,
        twoPA: 0,
        threePM: 0,
        threePA: 0,
        ftM: 0,
        ftA: 0,
        pts: 0,
        reb: 0,
      };

      prev.jersey = r.jersey ?? r.Jersey ?? prev.jersey;
      prev.playerName = r.playerName ?? r.PlayerName ?? prev.playerName;

      prev.twoPM += toNum(r.twoPM ?? r["2PM"]);
      prev.twoPA += toNum(r.twoPA ?? r["2PA"]);
      prev.threePM += toNum(r.threePM ?? r["3PM"]);
      prev.threePA += toNum(r.threePA ?? r["3PA"]);
      prev.ftM += toNum(r.ftM ?? r["FTM"]);
      prev.ftA += toNum(r.ftA ?? r["FTA"]);
      prev.pts += toNum(r.pts ?? r["Pts"]);
      prev.reb += toNum(r.reb ?? r["Reb"]);

      agg.set(pid, prev);
    }

    const playerRows = Array.from(agg.values()).map((r) => {
      const p = rosterById[r.playerID] || {};
      const pts = r.pts || 0;
      const reb = r.reb || 0;

      return {
        playerID: r.playerID,
        jersey: r.jersey ?? p.jersey ?? p.Jersey ?? "",
        name:
          r.playerName ??
          p.name ??
          p.Name ??
          `${p.firstName || p.FirstName || ""} ${p.lastName || p.LastName || ""}`.trim(),
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
    const hasStats = rows.length > 0;

    // choose decimal style
    const pct = pctDecimal;

    // Relative links
    const backToLwbbHref = "../../";
    const backToSeasonHref = `../../season/${seasonYearEnd}/`;
    const seasonDataHref = `../../data/${seasonYearEnd}.json`;

    return `
<header>
  <p class="kicker"><a href="${backToLwbbHref}">← Back to LWBB</a></p>
  <h1 class="masthead-title" style="font-size:clamp(1.9rem,3.5vw,3rem);">Box Score</h1>
  <hr class="rule">
</header>

<section class="grid single">
  <main>
    <p class="kicker"><a href="${backToSeasonHref}">← Back to season</a></p>

    <div class="article">
      <h2 style="margin-top:0;">${escapeHtml(opponent)}</h2>

      <div class="boxscore-header">
        <p><strong>${escapeHtml(dateDisplay)}</strong>${siteLabel ? ` • ${escapeHtml(siteLabel)}` : ""}</p>
        ${finalLine ? `<p><strong>${escapeHtml(finalLine)}</strong></p>` : ""}
      </div>

      ${
        hasStats
          ? `
      <div class="article">
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
          <tfoot>
            <tr>
              <th colspan="2">TEAM</th>
              <th>${twoM}-${twoA} (${pct(twoM, twoA)})</th>
              <th>${has3pt ? `${threeM}-${threeA} (${pct(threeM, threeA)})` : "—"}</th>
              <th>${ftMade}-${ftAtt} (${pct(ftMade, ftAtt)})</th>
              <th>—</th>
              <th>${fgM * 2 + threeM + ftMade}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      `
          : `
      <p class="small"><em>This box score is incomplete. If you have missing statistics, scorebooks, or official records for this game, please contact the site administrator to help improve the historical record.</em></p>
      `
      }

      <div class="article">
        <div class="box">
          <h3 style="margin:0 0 .5rem; font-family: var(--masthead);">Data Provenance</h3>
          <p class="small" style="margin:0;">Generated from canonical season JSON and per-game stats.</p>
          <p class="small" style="margin:.5rem 0 0;">
            Season: <a href="${seasonDataHref}">/lwbb/data/${seasonYearEnd}.json</a>
          </p>
          <p class="small" style="margin:.5rem 0 0;">
            Source file: <code>${escapeHtml(b.__sourceFile || "")}</code>
          </p>
        </div>
      </div>

    </div>
  </main>
</section>
`;
  }
};