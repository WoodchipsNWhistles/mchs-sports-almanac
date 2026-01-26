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
    const fmtSeason = (y) => `${y - 1}-${String(y).slice(-2)}`;

    const varsityRows = varsitySeasons
      .map((s) => {
        const t = s.totals ?? {};
        const two = `${t.twoPM ?? 0}-${t.twoPA ?? 0}`;
        const three = `${t.threePM ?? 0}-${t.threePA ?? 0}`;
        const ft = `${t.ftM ?? 0}-${t.ftA ?? 0}`;
        return `<tr>
          <td>${fmtSeason(s.seasonYearEnd)}</td>
          <td>${s.gamesPlayed ?? 0}</td>
          <td>${two}</td>
          <td>${three}</td>
          <td>${ft}</td>
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
                <th>3PT</th>
                <th>FT</th>
                <th>REB</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${varsityRows}
            </tbody>
          </table>`
        : `<p>No varsity season totals on record.</p>`
    }
  </div>
`;

  }
};
