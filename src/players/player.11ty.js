const fs = require("fs");
const path = require("path");

module.exports = class PlayerPage {
  data() {
    return {
      pagination: {
        data: "playerIndex",
        size: 1,
        alias: "playerRef",
      },
      permalink: (data) => `/players/${data.playerRef.playerID}/index.html`,
      layout: "base.njk",
      eleventyComputed: {
        title: (data) =>
          `${data.playerRef.name || data.playerRef.playerID} — Career`,
      },
    };
  }

  render(data) {
    const playerID = data.playerRef.playerID;
    const p = path.join("src", "_derived", "players", `${playerID}.json`);
    const player = JSON.parse(fs.readFileSync(p, "utf8"));

    const varsitySeasons = (player.seasons ?? []).filter(
      (s) => s.level === "V"
    );
    
    const varsityGames = varsitySeasons.flatMap((s) => s.gameStats ?? []);
    
    const careerTenPlus = varsityGames.filter((g) => Number(g.tenPlus) > 0).length;
const careerDoubleDoubles = varsityGames.filter((g) => Number(g.doubleDouble) > 0).length;


const nonZero = (n) => Number(n) > 0;

const maxPts = Math.max(
  0,
  ...varsityGames.map((g) => Number(g.pts)).filter(nonZero)
);
const maxReb = Math.max(
  0,
  ...varsityGames.map((g) => Number(g.reb)).filter(nonZero)
);

const ptsCount = varsityGames.filter(
  (g) => Number(g.pts) === maxPts && nonZero(g.pts)
).length;

const rebCount = varsityGames.filter(
  (g) => Number(g.reb) === maxReb && nonZero(g.reb)
).length;

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

const gameUrl = (gameID) => `/gwbb/boxscores/${gameID}/`;
const varsityGameRows = [...varsityGames]
  .sort((a, b) => String(a.gameID).localeCompare(String(b.gameID)))
  .map((g) => {
    const two = `${g.twoPM ?? 0}-${g.twoPA ?? 0}`;
    const three = `${g.threePM ?? 0}-${g.threePA ?? 0}`;
    const ft = `${g.ftM ?? 0}-${g.ftA ?? 0}`;
    return `<tr>
      <td><a href="${gameUrl(g.gameID)}">${g.gameID}</a></td>
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
    <h1>${player.name ?? player.playerID}</h1>
    <p><strong>PlayerID:</strong> ${player.playerID}</p>
    <p><strong>Grad Year:</strong> ${player.gradYear ?? "—"}</p>
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
  <li>
    Points: <strong>${maxPts ? `${maxPts}${ptsCount > 1 ? ` (${ptsCount} times)` : ""}` : "—"}</strong>
  </li>
  <li>
    Rebounds: <strong>${maxReb ? `${maxReb}${rebCount > 1 ? ` (${rebCount} times)` : ""}` : "—"}</strong>
  </li>
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
