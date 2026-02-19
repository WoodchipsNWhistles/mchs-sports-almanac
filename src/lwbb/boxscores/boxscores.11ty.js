const fs = require("fs");
const path = require("path");

const SEASON_DIR = path.join(process.cwd(), "src", "lwbb", "data");

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

// YYYY-MM-DD or YYYY-MM-DDTHH... -> "Month D, YYYY"
function formatUsDate(isoLike) {
  if (!isoLike) return "";
  const s = String(isoLike);

  // best-effort: grab leading YYYY-MM-DD if present
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

module.exports = class BoxscorePages {
  async data() {
    // Load all season JSON files
    const seasonFiles = fs
      .readdirSync(SEASON_DIR)
      .filter((f) => /^\d{4}\.json$/.test(f))
      .sort();

    const boxscores = [];

    for (const filename of seasonFiles) {
      const fullPath = path.join(SEASON_DIR, filename);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const season = safeJsonParse(raw, filename);

      const seasonYearEnd =
        season.seasonYear || Number(filename.replace(".json", ""));
      const schedule = season.schedule || [];
      const gameStats = season.gameStats || [];

// Build from schedule so we can render "incomplete box score" pages too
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
      (g) =>
        (g.gameId || g.GameID || g.GameID_Base || g.gameIdBase) === gameID
    ) || {};

  boxscores.push({
    ...sched,
    gameID,
    seasonYearEnd,
    __sourceFile: filename,
  });
}
}

    return {
      boxscores,

      pagination: { data: "boxscores", size: 1, alias: "boxscore" },

      permalink: (data) =>
        `/lwbb/boxscores/${data.boxscore.gameID}/index.html`,

      layout: "base.njk",

      eleventyComputed: {
        title: (data) => `${data.boxscore.gameID} — Box Score`,
        description: (data) => {
          const b = data.boxscore;
          return `LWBB box score: ${b.opponent || b.Opponent || "Opponent"} (${
            b.dateLabel || b.dateISO || b.Date || ""
          })`;
        },
      },
    };
  }

  render(data) {
    const b = data.boxscore;

    // -----------------------------
    // HEADER FIELDS (single source)
    // -----------------------------
    const opponent = b.opponent || b.Opponent || "Opponent";

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
        ? `Final: ${pointsFor}–${pointsAgainst}${
            outcome ? " • " + outcome : ""
          }`
        : "";

    // -----------------------------
    // LOAD SEASON + GAME STATS
    // -----------------------------
    const seasonYearEnd = b.seasonYearEnd || getSeasonYearEndFromGameID(b.gameID);
    const season = loadSeason(seasonYearEnd);

    const roster = (season && (season.roster || season.players)) || [];
    const gameStats = (season && (season.gameStats || season.stats)) || [];

    // Roster lookup (support both legacy and codex keys)
    const rosterById = {};
    for (const p of roster) {
      const pid = (p && (p.playerID || p.PlayerID || p.playerId || p.PlayerId)) || null;
      if (pid) rosterById[pid] = p;
    }

    // Rows for this game (support both legacy and codex keys)
    const rowsAll = gameStats.filter((r) => {
      const rg = r.gameId || r.gameID || r.GameID || r.GameID_Base;
      return rg === b.gameID;
    });

    // Only keep rows that map to a roster player (by playerID)
    const rows = rowsAll.filter((r) => {
      const rp = r.playerID || r.PlayerID || r.playerId || r.PlayerId;
      return rp && rosterById[rp];
    });

    // Aggregate duplicates per player
    const agg = new Map();
    for (const r of rows) {
      const pid = r.playerID || r.PlayerID || r.playerId || r.PlayerId;
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

      prev.twoPM += Number(r.twoPM ?? r["2PM"]) || 0;
      prev.twoPA += Number(r.twoPA ?? r["2PA"]) || 0;
      prev.threePM += Number(r.threePM ?? r["3PM"]) || 0;
      prev.threePA += Number(r.threePA ?? r["3PA"]) || 0;
      prev.ftM += Number(r.ftM ?? r["FTM"]) || 0;
      prev.ftA += Number(r.ftA ?? r["FTA"]) || 0;
      prev.pts += Number(r.pts ?? r["Pts"]) || 0;
      prev.reb += Number(r.reb ?? r["Reb"]) || 0;

      agg.set(pid, prev);
    }

    // Enrich player rows for display
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
    const hasStats = rows.length > 0;

    // Choose one: decimal (.451) is classic; swap to pctPercent if you prefer 45.1%
    const pct = pctDecimal;

    // Relative links (boxscore pages live at /gwbb/boxscores/<id>/)
    const backToLwbbHref = "../../";
    const backToSeasonHref = `../../season/${seasonYearEnd}/`;
    const seasonDataHref = `../../data/${seasonYearEnd}.json`;

    // -----------------------------
    // RENDER (NO DUPLICATE HEADER)
    // -----------------------------
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
