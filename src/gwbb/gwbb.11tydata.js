// src/gwbb/gwbb.11tydata.js
const buildPlayerNameLookup = require("./_lib/playerNameLookup.js");
const buildGwbbCareerTotals = require("./_lib/careerTotals.js");

module.exports = () => {
  const rows = buildGwbbCareerTotals();

  const gwbbCareerPtsLeaders = [...rows].sort(
    (a, b) => (b.pts ?? 0) - (a.pts ?? 0)
  );

  const gwbbCareerRebLeaders = [...rows].sort(
    (a, b) => (b.reb ?? 0) - (a.reb ?? 0)
  );

  const playerNameLookup = buildPlayerNameLookup();
  
    const playerLinkLookup = {};
  for (const r of rows) {
    if (!r.playerID) continue;
    playerLinkLookup[r.playerID] =
      `/mchs-sports-almanac/players/${r.playerID}/`;
  }

  return {
    gwbbCareerTotals: rows,
    gwbbCareerPtsTop10: gwbbCareerPtsLeaders.slice(0, 10),
    gwbbCareerRebTop10: gwbbCareerRebLeaders.slice(0, 10),
    playerNameLookup, 
    playerLinkLookup,
  };
};

