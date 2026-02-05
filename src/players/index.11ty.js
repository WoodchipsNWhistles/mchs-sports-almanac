module.exports = class PlayersIndexPage {
  data() {
    return {
      permalink: "/players/",
      layout: "base.njk",
      title: "Players",
    };
  }

  render(data) {
    const prefix = "/mchs-sports-almanac";
    const playerLink = (pid) => `${prefix}/players/${pid}/`;

    const canonPID = (p) =>
      p?.personID || p?.playerID || p?.playerId || p?.PlayerID || p?.PlayerId || null;

    const idx = data.playersIndex || data.playerIndex || {};
    const byGradYear = idx.byGradYear || {};
    const gradYearKeys = idx.gradYearKeys || [];
    const byLastName = idx.byLastName || [];

    const gradBlocks = gradYearKeys
      .map((k) => {
        const list = byGradYear[k] || [];
        const items = list
          .map((p) => {
            if (p.role && String(p.role).toLowerCase() !== "player") return "";
            const pid = canonPID(p);
            if (!pid) return "";
            const name = p.name || `${p.first || ""} ${p.last || ""}`.trim() || pid;
            return `<li><a href="${playerLink(pid)}">${name}</a></li>`;
          })
          .filter(Boolean)
          .join("");

        return `
          <details class="year">
            <summary>${k} <span class="muted">(${list.length})</span></summary>
            <ul class="columns">${items}</ul>
          </details>
        `;
      })
      .join("\n");

    const byLetter = {};
    for (const p of byLastName) {
      if (p.role && String(p.role).toLowerCase() !== "player") continue;
      const last = (p.last || "").trim();
      const base = (last || p.name || "").trim();
      const ch = base ? base[0].toUpperCase() : "#";
      const letter = ch >= "A" && ch <= "Z" ? ch : "#";
      if (!byLetter[letter]) byLetter[letter] = [];
      byLetter[letter].push(p);
    }

    const letterKeys = Object.keys(byLetter).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });

    const azBlocks = letterKeys
      .map((letter) => {
        const list = byLetter[letter] || [];
        const items = list
          .map((p) => {
            const pid = canonPID(p);
            if (!pid) return "";
            const name = p.name || `${p.first || ""} ${p.last || ""}`.trim() || pid;
            const gy = p.gradYear ? ` (${p.gradYear})` : "";
            return `<li><a href="${playerLink(pid)}">${name}</a><span class="muted">${gy}</span></li>`;
          })
          .filter(Boolean)
          .join("");

        return `
          <details class="letter">
            <summary>${letter} <span class="muted">(${list.length})</span></summary>
            <ul class="columns">${items}</ul>
          </details>
        `;
      })
      .join("\n");

    return `
<div class="article">
  <h1>People</h1>

  <p>
    Browse by graduation year (collapsed by default), or scan the full A–Z list.
  </p>

  <h2>Players by Grad Year</h2>
  <div class="players-by-year">
    ${gradBlocks || "<p>No players on record.</p>"}
  </div>

  <hr>

  <h2>Players A–Z</h2>
  ${
    byLastName.length
      ? `<div class="players-az">${azBlocks}</div>`
      : `<p>No players on record.</p>`
  }
</div>
`;
  }
};
