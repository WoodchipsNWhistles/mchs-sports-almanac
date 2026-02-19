const fs = require("fs");
const path = require("path");

function canonPlayerID(obj) {
  return obj?.playerID || obj?.playerId || obj?.PlayerID || obj?.PlayerId || null;
}

function canonGameID(obj) {
  return (
    obj?.gameId ||
    obj?.gameID ||
    obj?.GameID ||
    obj?.GameId ||
    obj?.GameID_Base ||
    obj?.gameIdBase ||
    null
  );
}

function safeNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function sum(rows, key) {
  return rows.reduce((acc, r) => acc + safeNum(r?.[key]), 0);
}

function dateFromGameID(gameID) {
  if (!gameID) return "";
  const m = String(gameID).match(/-(\d{8})-/);
  if (!m) return "";
  const y = m[1].slice(0, 4);
  const mo = m[1].slice(4, 6);
  const d = m[1].slice(6, 8);
  return `${y}-${mo}-${d}`;
}

function opponentFromGameID(gameID) {
  if (!gameID) return "";
  const parts = String(gameID).split("-");
  if (parts.length < 4) return "";
  return parts.slice(3).join("-");
}

function siteFromGameID(gameID) {
  if (!gameID) return "";
  const s = String(gameID);
  if (s.includes("-H-")) return "vs";
  if (s.includes("-A-")) return "@";
  return "";
}

function fmtSeason(y) {
  return `${y - 1}-${String(y).slice(-2)}`;
}

function pct(m, a) {
  const mm = Number(m) || 0;
  const aa = Number(a) || 0;
  if (!aa) return "—";
  return `${((mm / aa) * 100).toFixed(1)}%`;
}

// -------------------- Load season files --------------------

function loadSeasonFiles(dirParts) {
  const dir = path.join(process.cwd(), ...dirParts);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => {
      const full = path.join(dir, f);
      const raw = fs.readFileSync(full, "utf8");
      const season = JSON.parse(raw);
      const seasonYearEnd = season.seasonYear || Number(f.replace(".json", ""));
      return { seasonYearEnd, season };
    });
}

function loadGwbbSeasonFiles() {
  return loadSeasonFiles(["src", "gwbb", "data"]);
}

function loadLwbbSeasonFiles() {
  return loadSeasonFiles(["src", "lwbb", "data"]);
}

// -------------------- Build seasons from canonical --------------------

function normalizeStatRow(r, playerID) {
  const twoPM = safeNum(r.twoPM ?? r["2PM"]);
  const twoPA = safeNum(r.twoPA ?? r["2PA"]);
  const threePM = safeNum(r.threePM ?? r["3PM"]);
  const threePA = safeNum(r.threePA ?? r["3PA"]);
  const ftM = safeNum(r.ftM ?? r["FTM"]);
  const ftA = safeNum(r.ftA ?? r["FTA"]);
  const pts = safeNum(r.pts ?? r["Pts"]);
  const reb = safeNum(r.reb ?? r["Reb"]);

  const tenPlus = r.tenPlus ?? r.tenPlusPoints ?? pts >= 10;
  const doubleDouble = r.doubleDouble ?? (pts >= 10 && reb >= 10);

  return {
    gameId: canonGameID(r),
    playerId: playerID,
    jersey: r.jersey ?? r.Jersey ?? "",
    playerName: r.playerName ?? r.PlayerName ?? "",
    twoPM,
    twoPA,
    threePM,
    threePA,
    ftM,
    ftA,
    pts,
    reb,
    tenPlus: Boolean(tenPlus),
    doubleDouble: Boolean(doubleDouble),
  };
}

function buildGwbbSeasons(playerID) {
  const seasons = [];
  const seasonFiles = loadGwbbSeasonFiles();

  for (const { seasonYearEnd, season } of seasonFiles) {
    const gameStatsAll = season.gameStats || season.stats || [];
    const rows = Array.isArray(gameStatsAll)
      ? gameStatsAll.filter((r) => canonPlayerID(r) === playerID)
      : [];

    if (!rows.length) continue;

    const normRows = rows.map((r) => normalizeStatRow(r, playerID));

    const totals = {
      twoPM: sum(normRows, "twoPM"),
      twoPA: sum(normRows, "twoPA"),
      threePM: sum(normRows, "threePM"),
      threePA: sum(normRows, "threePA"),
      ftM: sum(normRows, "ftM"),
      ftA: sum(normRows, "ftA"),
      pts: sum(normRows, "pts"),
      reb: sum(normRows, "reb"),
    };

    seasons.push({
      seasonYearEnd,
      level: "V",
      gamesPlayed: normRows.length,
      totals,
      gameStats: normRows,
    });
  }

  seasons.sort((a, b) => (a.seasonYearEnd || 0) - (b.seasonYearEnd || 0));
  return seasons;
}

// MVP rules for LWBB:
// - If player appears in roster, include season even if no per-game stats exist
// - If stats exist, normalize same way as GWBB
function buildLwbbSeasons(playerID) {
  const seasons = [];
  const seasonFiles = loadLwbbSeasonFiles();

  for (const { seasonYearEnd, season } of seasonFiles) {
    const roster = Array.isArray(season.roster) ? season.roster : [];
    const onRoster = roster.some((r) => canonPlayerID(r) === playerID);

    const gameStatsAll = season.gameStats || season.stats || [];
    const rows = Array.isArray(gameStatsAll)
      ? gameStatsAll.filter((r) => canonPlayerID(r) === playerID)
      : [];

    if (!onRoster && !rows.length) continue;

    const normRows = rows.map((r) => normalizeStatRow(r, playerID));

    const totals = {
      twoPM: sum(normRows, "twoPM"),
      twoPA: sum(normRows, "twoPA"),
      threePM: sum(normRows, "threePM"),
      threePA: sum(normRows, "threePA"),
      ftM: sum(normRows, "ftM"),
      ftA: sum(normRows, "ftA"),
      pts: sum(normRows, "pts"),
      reb: sum(normRows, "reb"),
    };

    seasons.push({
      seasonYearEnd,
      level: "V",
      onRoster: Boolean(onRoster),
      gamesPlayed: normRows.length,
      totals,
      gameStats: normRows,
    });
  }

  seasons.sort((a, b) => (a.seasonYearEnd || 0) - (b.seasonYearEnd || 0));
  return seasons;
}

// -------------------- Render a sport block (tables + log) --------------------

function renderBasketballBlock({
  sportTitle,
  seasons,
  boxscorePrefix,
  levelLabel = "Varsity",
}) {
  if (!seasons.length) return "";

  const games = seasons.flatMap((s) => s.gameStats ?? []);

  const careerTenPlus = games.filter((g) => Number(g.tenPlus) > 0).length;
  const careerDoubleDoubles = games.filter((g) => Number(g.doubleDouble) > 0).length;

  const nonZero = (n) => Number(n) > 0;
  const maxPts = Math.max(0, ...games.map((g) => Number(g.pts)).filter(nonZero));
  const maxReb = Math.max(0, ...games.map((g) => Number(g.reb)).filter(nonZero));
  const ptsCount = games.filter((g) => Number(g.pts) === maxPts && nonZero(g.pts)).length;
  const rebCount = games.filter((g) => Number(g.reb) === maxReb && nonZero(g.reb)).length;

  const careerTotals = seasons.reduce(
    (acc, s) => {
      const t = s.totals ?? {};
      acc.games += s.gamesPlayed ?? 0;
      acc.twoPM += t.twoPM ?? 0;
      acc.twoPA += t.twoPA ?? 0;
      acc.threePM += t.threePM ?? 0;
      acc.threePA += t.threePA ?? 0;
      acc.ftM += t.ftM ?? 0;
      acc.ftA += t.ftA ?? 0;
      acc.reb += t.reb ?? 0;
      acc.pts += t.pts ?? 0;
      return acc;
    },
    { games: 0, twoPM: 0, twoPA: 0, threePM: 0, threePA: 0, ftM: 0, ftA: 0, reb: 0, pts: 0 }
  );

  const seasonRows = seasons
    .map((s) => {
      const t = s.totals ?? {};
      const lines = s.gameStats ?? [];
      const tenPlus = lines.filter((g) => Number(g.tenPlus) > 0).length;
      const dd = lines.filter((g) => Number(g.doubleDouble) > 0).length;

      const two = `${t.twoPM ?? 0}-${t.twoPA ?? 0}`;
      const three = `${t.threePM ?? 0}-${t.threePA ?? 0}`;
      const ft = `${t.ftM ?? 0}-${t.ftA ?? 0}`;

      return `<tr>
        <td>${fmtSeason(s.seasonYearEnd)}</td>
        <td>${s.gamesPlayed ?? 0}</td>
        <td>${two}</td>
        <td>${pct(t.twoPM, t.twoPA)}</td>
        <td>${three}</td>
        <td>${pct(t.threePM, t.threePA)}</td>
        <td>${ft}</td>
        <td>${pct(t.ftM, t.ftA)}</td>
        <td>${tenPlus}</td>
        <td>${dd}</td>
        <td>${t.reb ?? 0}</td>
        <td><strong>${t.pts ?? 0}</strong></td>
      </tr>`;
    })
    .join("");

  const gameUrl = (gameID) => `${boxscorePrefix}${gameID}`;

  // Per-game log (collapse per season)
  const sortByGameID = (a, b) => String(canonGameID(a)).localeCompare(String(canonGameID(b)));
  let careerCounter = 0;

  const seasonLogsHtml = seasons
    .map((s) => {
      const seasonLabel = fmtSeason(s.seasonYearEnd);
      const gamesThisSeason = [...(s.gameStats ?? [])].sort(sortByGameID);
      const gamesCount = gamesThisSeason.length;

      const t = s.totals ?? {};
      const seasonPts = Number(t.pts ?? 0);
      const seasonReb = Number(t.reb ?? 0);

      const rowsHtml = gamesThisSeason
        .map((g, seasonIdx) => {
          careerCounter += 1;

          const gid = canonGameID(g);
          if (!gid) return "";

          const dateStr = dateFromGameID(gid);
          const opp = opponentFromGameID(gid);
          const site = siteFromGameID(gid);

          const two = `${g.twoPM ?? 0}-${g.twoPA ?? 0}`;
          const three = `${g.threePM ?? 0}-${g.threePA ?? 0}`;
          const ft = `${g.ftM ?? 0}-${g.ftA ?? 0}`;

          return `<tr>
            <td>${careerCounter}</td>
            <td>${seasonIdx + 1}</td>
            <td>${dateStr || "—"}</td>
            <td>${site && opp ? `${site} ${opp}` : opp || "—"}</td>
            <td><a href="${gameUrl(gid)}">${gid}</a></td>
            <td>${two}</td>
            <td>${pct(g.twoPM, g.twoPA)}</td>
            <td>${three}</td>
            <td>${pct(g.threePM, g.threePA)}</td>
            <td>${ft}</td>
            <td>${pct(g.ftM, g.ftA)}</td>
            <td>${g.reb ?? 0}</td>
            <td><strong>${g.pts ?? 0}</strong></td>
          </tr>`;
        })
        .join("");

      const inner =
        gamesCount > 0
          ? `<table>
              <thead>
                <tr>
                  <th>#Career</th>
                  <th>#Season</th>
                  <th>Date</th>
                  <th>Opp</th>
                  <th>Game</th>
                  <th>2PT</th>
                  <th>2PT%</th>
                  <th>3PT</th>
                  <th>3PT%</th>
                  <th>FT</th>
                  <th>FT%</th>
                  <th>REB</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>`
          : `<p>No game log on record for this season.</p>`;

      const summary = `${seasonLabel} — ${gamesCount} game${gamesCount === 1 ? "" : "s"} — ${seasonPts} pts, ${seasonReb} reb`;

      return `<details class="season">
        <summary>${summary}</summary>
        <div class="season-body">${inner}</div>
      </details>`;
    })
    .join("\n");

  const perGameSectionHtml = `
    <h2>Per-Game Log — ${levelLabel}</h2>
    ${seasons.length ? `<div class="season-log">${seasonLogsHtml}</div>` : `<p>No varsity game log on record.</p>`}
  `;

  // If literally no per-game rows exist, treat as incomplete stats for this sport
  const hasStats = games.length > 0;

  if (!hasStats) {
    return `
      <h2>${sportTitle}</h2>
      <div class="notice notice--incomplete">
        <p><strong>Incomplete statistics:</strong> this player page currently reflects roster appearances for these seasons. If you have missing statistics, scorebooks, or official records, please contact the site administrator to help improve the historical record.</p>
      </div>
    `;
  }

  return `
    <h2>${sportTitle}</h2>

    <h2>Season Totals — ${levelLabel}</h2>
    <table>
      <thead>
        <tr>
          <th>Season</th>
          <th>G</th>
          <th>2PT</th>
          <th>2PT%</th>
          <th>3PT</th>
          <th>3PT%</th>
          <th>FT</th>
          <th>FT%</th>
          <th>10+</th>
          <th>Double-<br>Doubles</th>
          <th>REB</th>
          <th>PTS</th>
        </tr>
      </thead>
      <tbody>${seasonRows}</tbody>
    </table>

    <h2>Career Totals — ${levelLabel}</h2>
    <table>
      <thead>
        <tr>
          <th>G</th>
          <th>2PT</th>
          <th>2PT%</th>
          <th>3PT</th>
          <th>3PT%</th>
          <th>FT</th>
          <th>FT%</th>
          <th>10+</th>
          <th>Double-<br>Doubles</th>
          <th>REB</th>
          <th>PTS</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${careerTotals.games}</td>
          <td>${careerTotals.twoPM}-${careerTotals.twoPA}</td>
          <td>${pct(careerTotals.twoPM, careerTotals.twoPA)}</td>
          <td>${careerTotals.threePM}-${careerTotals.threePA}</td>
          <td>${pct(careerTotals.threePM, careerTotals.threePA)}</td>
          <td>${careerTotals.ftM}-${careerTotals.ftA}</td>
          <td>${pct(careerTotals.ftM, careerTotals.ftA)}</td>
          <td>${careerTenPlus}</td>
          <td>${careerDoubleDoubles}</td>
          <td>${careerTotals.reb}</td>
          <td><strong>${careerTotals.pts}</strong></td>
        </tr>
      </tbody>
    </table>

    <h2>Best Games on Record — ${levelLabel}</h2>
    <ul>
      <li>Points: <strong>${maxPts ? `${maxPts}${ptsCount > 1 ? ` (${ptsCount} times)` : ""}` : "—"}</strong></li>
      <li>Rebounds: <strong>${maxReb ? `${maxReb}${rebCount > 1 ? ` (${rebCount} times)` : ""}` : "—"}</strong></li>
    </ul>

    ${perGameSectionHtml}
  `;
}

// -------------------- Eleventy page --------------------

module.exports = class PlayerPage {
  data() {
    return {
      pagination: {
        data: "playersIndex.players",
        size: 1,
        alias: "playerRef",
        filter: (p) => Boolean(canonPlayerID(p) || p?.personID),
      },

      permalink: (data) => {
        const pid = canonPlayerID(data.playerRef) || data.playerRef?.personID;
        if (!pid) return false;
        return `/players/${pid}/index.html`;
      },

      layout: "base.njk",

      eleventyComputed: {
        title: (data) => {
          const pid = canonPlayerID(data.playerRef) || data.playerRef?.personID;
          return `${data.playerRef?.name || pid} — Career`;
        },
      },
    };
  }

  render(data) {
    const prefix = "";

    const playerID = canonPlayerID(data.playerRef) || data.playerRef?.personID;
    if (!playerID) return "";

    const p = path.join("src", "_derived", "players", `${playerID}.json`);
    const player = JSON.parse(fs.readFileSync(p, "utf8"));

    const gwbbSeasons = buildGwbbSeasons(playerID);
    const lwbbSeasons = buildLwbbSeasons(playerID);
    
    const gwbbBlock = renderBasketballBlock({
      sportTitle: "Meade County Greenwave Basketball",
      seasons: gwbbSeasons,
      boxscorePrefix: `${prefix}/gwbb/boxscores/`,
      levelLabel: "Varsity",
    });


    // LWBB: always show header if rostered, even if no stats
let lwbbBlock = "";

if (lwbbSeasons.length) {
  const rosterYears = lwbbSeasons
    .map((s) => fmtSeason(s.seasonYearEnd))
    .join(", ");

  const lwbbHasGameStats = lwbbSeasons.some(
    (s) => (s.gameStats ?? []).length > 0
  );

  lwbbBlock = `
    <h2>Meade County LadyWave Basketball</h2>
    <p><strong>Seasons rostered:</strong> ${rosterYears}</p>
    ${
      !lwbbHasGameStats
        ? `<div class="notice notice--incomplete">
             <p><strong>Incomplete statistics:</strong> this player page currently reflects roster appearances for LadyWave seasons. If you have missing statistics, scorebooks, or official records, please contact the site administrator to help improve the historical record.</p>
           </div>`
        : ""
    }
    ${renderBasketballBlock({
      sportTitle: "", // prevent duplicate h2
      seasons: lwbbSeasons,
      boxscorePrefix: `${prefix}/lwbb/boxscores/`,
      levelLabel: "Varsity",
    })}
  `;
}

    return `
  <div class="article">
    <h1>${player.name ?? player.playerID ?? player.playerId}</h1>
    <p><strong>PlayerID:</strong> ${player.playerID ?? player.playerId}</p>
    <p><strong>Grad Year:</strong> ${player.gradYear ?? player.gradyear ?? "—"}</p>

    ${gwbbBlock}
    ${lwbbBlock}
  </div>
`;
  }
};
