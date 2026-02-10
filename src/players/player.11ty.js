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
  // Expect: GWBB2025-20241203-A-FLOYDC
  const m = String(gameID).match(/-(\d{8})-/);
  if (!m) return "";
  const y = m[1].slice(0, 4);
  const mo = m[1].slice(4, 6);
  const d = m[1].slice(6, 8);
  return `${y}-${mo}-${d}`;
}

function opponentFromGameID(gameID) {
  if (!gameID) return "";
  // Expect: GWBB2025-20241203-A-FLOYDC
  const parts = String(gameID).split("-");
  if (parts.length < 4) return "";
  return parts.slice(3).join("-"); // supports any hyphenated opponent tokens
}

function siteFromGameID(gameID) {
  if (!gameID) return "";
  const s = String(gameID);
  if (s.includes("-H-")) return "vs";
  if (s.includes("-A-")) return "@";
  return "";
}

// Pull *canonical* GWBB seasons from src/gwbb/data/*.json
function loadGwbbSeasonFiles() {
  const dir = path.join(process.cwd(), "src", "gwbb", "data");
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

// Build a Varsity seasons array from canonical season JSON
function buildVarsitySeasonsFromCanonical(playerID) {
  const seasons = [];
  const seasonFiles = loadGwbbSeasonFiles();

  for (const { seasonYearEnd, season } of seasonFiles) {
    const gameStatsAll = season.gameStats || season.stats || [];
    const rows = gameStatsAll.filter((r) => canonPlayerID(r) === playerID);

    if (!rows.length) continue;

    // normalize rows + compute derived flags if missing
    const normRows = rows.map((r) => {
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
    });

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

// sort by season ascending
seasons.sort((a, b) => (a.seasonYearEnd || 0) - (b.seasonYearEnd || 0));
return seasons;
}

module.exports = class PlayerPage {
  data() {

  return {
    pagination: {
      data: "playerIndex",
      size: 1,
      alias: "playerRef",
    },

    permalink: (data) => {
      const pid = canonPlayerID(data.playerRef);
      return `/players/${pid}/index.html`;
    },

    layout: "base.njk",

    eleventyComputed: {
      title: (data) => {
        const pid = canonPlayerID(data.playerRef);
        return `${data.playerRef?.name || pid} — Career`;
      },
    },
  };
}

  render(data) {
    const prefix = "";

    const playerID = canonPlayerID(data.playerRef);

    // Base player identity comes from _derived (name/gradYear/etc)
    const p = path.join("src", "_derived", "players", `${playerID}.json`);
    const player = JSON.parse(fs.readFileSync(p, "utf8"));

    // ✅ IMPORTANT FIX:
    // Always rebuild Varsity seasons from canonical season JSON (src/gwbb/data/*.json)
    // so player pages reflect missing-game patches immediately.
    player.seasons = buildVarsitySeasonsFromCanonical(playerID);

    const varsitySeasons = (player.seasons ?? []).filter((s) => s.level === "V");
    const varsityGames = varsitySeasons.flatMap((s) => s.gameStats ?? []);

    const careerTenPlus = varsityGames.filter((g) => Number(g.tenPlus) > 0).length;
    const careerDoubleDoubles = varsityGames.filter((g) => Number(g.doubleDouble) > 0).length;

    const nonZero = (n) => Number(n) > 0;

    const maxPts = Math.max(0, ...varsityGames.map((g) => Number(g.pts)).filter(nonZero));
    const maxReb = Math.max(0, ...varsityGames.map((g) => Number(g.reb)).filter(nonZero));

    const ptsCount = varsityGames.filter((g) => Number(g.pts) === maxPts && nonZero(g.pts)).length;
    const rebCount = varsityGames.filter((g) => Number(g.reb) === maxReb && nonZero(g.reb)).length;

    const careerTotals = varsitySeasons.reduce(
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
      {
        games: 0,
        twoPM: 0,
        twoPA: 0,
        threePM: 0,
        threePA: 0,
        ftM: 0,
        ftA: 0,
        reb: 0,
        pts: 0,
      }
    );

    const fmtSeason = (y) => `${y - 1}-${String(y).slice(-2)}`;

    const pct = (m, a) => {
      const mm = Number(m) || 0;
      const aa = Number(a) || 0;
      if (!aa) return "—";
      return `${((mm / aa) * 100).toFixed(1)}%`;
    };

    const gameUrl = (gameID) => `${prefix}/gwbb/boxscores/${gameID}`;

    // ---------------- Option C: collapse per season ----------------
    const sortByGameID = (a, b) =>
      String(canonGameID(a)).localeCompare(String(canonGameID(b)));

    let careerCounter = 0;

    const seasonLogsHtml = varsitySeasons
      .map((s) => {
        const seasonLabel = fmtSeason(s.seasonYearEnd);
        const games = [...(s.gameStats ?? [])].sort(sortByGameID);
        const gamesCount = games.length;

        const t = s.totals ?? {};
        const seasonPts = Number(t.pts ?? 0);
        const seasonReb = Number(t.reb ?? 0);

        const rowsHtml = games
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
              <td><a href="${gameUrl(gid)}/">${gid}</a></td>
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
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>`
            : `<p>No game log on record for this season.</p>`;

        const summary = `${seasonLabel} — ${gamesCount} game${
          gamesCount === 1 ? "" : "s"
        } — ${seasonPts} pts, ${seasonReb} reb`;

        return `<details class="season">
          <summary>${summary}</summary>
          <div class="season-body">
            ${inner}
          </div>
        </details>`;
      })
      .join("\n");

    const perGameSectionHtml = `
      <h2>Per-Game Log — Varsity</h2>
      ${
        varsitySeasons.length
          ? `<div class="season-log">${seasonLogsHtml}</div>`
          : `<p>No varsity game log on record.</p>`
      }
    `;

    // ---------------- End Option C ----------------

    const varsityRows = varsitySeasons
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

    return `
  <div class="article">
    <h1>${player.name ?? player.playerID ?? player.playerId}</h1>
    <p><strong>PlayerID:</strong> ${player.playerID ?? player.playerId}</p>
    <p><strong>Grad Year:</strong> ${player.gradYear ?? player.gradyear ?? "—"}</p>

    <h2>Meade County Greenwave Basketball</h2>

    <h2>Season Totals — Varsity</h2>
    ${
      varsitySeasons.length
        ? `<table>
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
    <tbody>
      ${varsityRows}
    </tbody>
  </table>

  <h2>Career Totals — Varsity</h2>
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

  <h2>Best Games on Record — Varsity</h2>
  <ul>
    <li>Points: <strong>${
      maxPts ? `${maxPts}${ptsCount > 1 ? ` (${ptsCount} times)` : ""}` : "—"
    }</strong></li>
    <li>Rebounds: <strong>${
      maxReb ? `${maxReb}${rebCount > 1 ? ` (${rebCount} times)` : ""}` : "—"
    }</strong></li>
  </ul>

  ${perGameSectionHtml}
`
        : `<p>No varsity season totals on record.</p>`
    }
  </div>
`;
  }
};
