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
    const rows = gameStatsAll.filter((r) => {
      const pid = canonPlayerID(r);
      return pid === playerID;
    });

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

      const tenPlus = r.tenPlus ?? r.tenPlusPoints ?? (pts >= 10);
      const doubleDouble =
        r.doubleDouble ?? (pts >= 10 && reb >= 10);

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

      // To those who come behind:
      // This hardcoded prefix exists because Eleventy JS templates did not reliably
      // receive site.baseUrl or pathPrefix during GH Pages builds.
      // Root-relative links WILL 404 without this.
      // Verified working on GitHub Pages project sites.
      // Time wasted discovering this: ~14 hours.
      // If you change this, please increment the counter and leave a note.

      layout: "base.njk",
      eleventyComputed: {
        title: (data) => {
          const pid = canonPlayerID(data.playerRef);
          return `${data.playerRef.name || pid} — Career`;
        },
      },
    };
  }

  render(data) {
    const prefix = "/mchs-sports-almanac";

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

    const varsityGameRows = [...varsityGames]
      .sort((a, b) => String(canonGameID(a)).localeCompare(String(canonGameID(b))))
      .map((g) => {
        const gid = canonGameID(g);
        const two = `${g.twoPM ?? 0}-${g.twoPA ?? 0}`;
        const three = `${g.threePM ?? 0}-${g.threePA ?? 0}`;
        const ft = `${g.ftM ?? 0}-${g.ftA ?? 0}`;
        return `<tr>
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
    <li>Points: <strong>${maxPts ? `${maxPts}${ptsCount > 1 ? ` (${ptsCount} times)` : ""}` : "—"}</strong></li>
    <li>Rebounds: <strong>${maxReb ? `${maxReb}${rebCount > 1 ? ` (${rebCount} times)` : ""}` : "—"}</strong></li>
  </ul>

  <h2>Per-Game Log — Varsity</h2>
  ${
    varsityGames.length
      ? `<table>
          <thead>
            <tr>
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
            ${varsityGameRows}
          </tbody>
        </table>`
      : `<p>No varsity game log on record.</p>`
  }
`
        : `<p>No varsity season totals on record.</p>`
    }
  </div>
`;
  }
};
