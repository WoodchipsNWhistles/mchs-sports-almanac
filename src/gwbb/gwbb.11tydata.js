// src/gwbb/gwbb.11tydata.js
const buildPlayerNameLookup = require("./_lib/playerNameLookup.js");
const buildGwbbCareerTotals = require("./_lib/careerTotals.js");

module.exports = () => {
  const TOP = 10;

  const rowsRaw = buildGwbbCareerTotals();

  // Add rate stats
  const rows = rowsRaw.map((r) => ({
    ...r,
    ppg: r.gp > 0 ? r.pts / r.gp : null,
    rpg: r.gp > 0 ? r.reb / r.gp : null,
  }));

  // Build name + link lookups
  const playerNameLookup = buildPlayerNameLookup();

  const playerLinkLookup = {};
  for (const r of rows) {
    if (!r.playerID) continue;
    playerLinkLookup[r.playerID] = `/mchs-sports-almanac/players/${r.playerID}/`;
  }

  // ---------- Helpers ----------
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  /**
   * Sort rows by a primary key (desc), then by tiebreakers (desc),
   * then by playerID (asc) for stability.
   */
  const sortByKeysDesc = (arr, keys) => {
    const out = [...arr];
    out.sort((a, b) => {
      for (const k of keys) {
        const av = a[k];
        const bv = b[k];

        // nulls last
        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull && bNull) continue;
        if (aNull) return 1;
        if (bNull) return -1;

        const diff = num(bv) - num(av);
        if (diff !== 0) return diff;
      }

      // stable final tiebreak (alphabetical by ID)
      return String(a.playerID || "").localeCompare(String(b.playerID || ""));
    });
    return out;
  };

  const topN = (arr, n, keys, filterFn = null) => {
    const filtered = filterFn ? arr.filter(filterFn) : arr;
    return sortByKeysDesc(filtered, keys).slice(0, n);
  };

  // ---------- Leaderboards (Top 10) ----------
  // Counting stats (ties: GP, then relevant volume when applicable)
  const gwbbCareerPtsTop10 = topN(rows, TOP, ["pts", "gp"]);
  const gwbbCareerRebTop10 = topN(rows, TOP, ["reb", "gp"]);

  const gwbbCareer3PMTop10 = topN(rows, TOP, ["threePM", "threePA", "gp"]);
  const gwbbCareer3PATop10 = topN(rows, TOP, ["threePA", "threePM", "gp"]);

  const gwbbCareerFTMTop10 = topN(rows, TOP, ["ftM", "ftA", "gp"]);
  const gwbbCareerFTATop10 = topN(rows, TOP, ["ftA", "ftM", "gp"]);

  // Rate stats with anti-outlier minimums + record-book tiebreakers
  // PPG/RPG: min GP >= 30; ties -> higher GP, then higher totals
  const gwbbCareerPPGTop10 = topN(
    rows,
    TOP,
    ["ppg", "gp", "pts"],
    (r) => r.gp >= 30 && r.ppg !== null
  );

  const gwbbCareerRPGTop10 = topN(
    rows,
    TOP,
    ["rpg", "gp", "reb"],
    (r) => r.gp >= 30 && r.rpg !== null
  );

  // FG%: min FGA >= 150; ties -> higher FGA, then higher FGM
  const gwbbCareerFGPctTop10 = topN(
    rows,
    TOP,
    ["fgPct", "fgA", "fgM"],
    (r) => (r.fgA ?? 0) >= 150 && r.fgPct !== null
  );

  // 3P%: min 3PA >= 60; ties -> higher 3PA, then higher 3PM
  const gwbbCareer3PPctTop10 = topN(
    rows,
    TOP,
    ["threePct", "threePA", "threePM"],
    (r) => (r.threePA ?? 0) >= 60 && r.threePct !== null
  );

  // FT%: min FTA >= 50; ties -> higher FTA, then higher FTM
  const gwbbCareerFTPctTop10 = topN(
    rows,
    TOP,
    ["ftPct", "ftA", "ftM"],
    (r) => (r.ftA ?? 0) >= 50 && r.ftPct !== null
  );

  // Double-Doubles: ties -> higher GP, then higher REB, then higher PTS
  const gwbbCareerDDTop10 = topN(rows, TOP, ["doubleDoubles", "gp", "reb", "pts"]);

  return {
    // lookups
    playerNameLookup,
    playerLinkLookup,

    // leaderboards
    gwbbCareerPtsTop10,
    gwbbCareerRebTop10,

    gwbbCareer3PMTop10,
    gwbbCareer3PATop10,

    gwbbCareerFTMTop10,
    gwbbCareerFTATop10,

    gwbbCareerFGPctTop10,
    gwbbCareer3PPctTop10,
    gwbbCareerFTPctTop10,

    gwbbCareerPPGTop10,
    gwbbCareerRPGTop10,

    gwbbCareerDDTop10,
  };
};
