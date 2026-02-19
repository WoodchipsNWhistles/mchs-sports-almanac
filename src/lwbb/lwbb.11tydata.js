const buildPlayerNameLookup = require("./_lib/playerNameLookup.js");
const buildLwbbCareerTotals = require("./_lib/careerTotals.js");

module.exports = () => {
  const TOP = 10;

  const rowsRaw = buildLwbbCareerTotals();

  const rows = rowsRaw.map((r) => ({
    ...r,
    ppg: r.gp > 0 ? r.pts / r.gp : null,
    rpg: r.gp > 0 ? r.reb / r.gp : null,
  }));

  const playerNameLookup = buildPlayerNameLookup();

  const playerLinkLookup = {};
  for (const r of rows) {
    if (!r.playerID) continue;
    playerLinkLookup[r.playerID] = `/players/${r.playerID}/`;
  }

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const sortByKeysDesc = (arr, keys) => {
    const out = [...arr];
    out.sort((a, b) => {
      for (const k of keys) {
        const av = a[k];
        const bv = b[k];

        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull && bNull) continue;
        if (aNull) return 1;
        if (bNull) return -1;

        const diff = num(bv) - num(av);
        if (diff !== 0) return diff;
      }

      return String(a.playerID || "").localeCompare(String(b.playerID || ""));
    });
    return out;
  };

  const topN = (arr, n, keys, filterFn = null) => {
    const filtered = filterFn ? arr.filter(filterFn) : arr;
    return sortByKeysDesc(filtered, keys).slice(0, n);
  };

  const lwbbCareerPtsTop10 = topN(rows, TOP, ["pts", "gp"]);
  const lwbbCareerRebTop10 = topN(rows, TOP, ["reb", "gp"]);

  const lwbbCareer3PMTop10 = topN(rows, TOP, ["threePM", "threePA", "gp"]);
  const lwbbCareer3PATop10 = topN(rows, TOP, ["threePA", "threePM", "gp"]);

  const lwbbCareerFTMTop10 = topN(rows, TOP, ["ftM", "ftA", "gp"]);
  const lwbbCareerFTATop10 = topN(rows, TOP, ["ftA", "ftM", "gp"]);

  const lwbbCareerPPGTop10 = topN(
    rows,
    TOP,
    ["ppg", "gp", "pts"],
    (r) => r.gp >= 30 && r.ppg !== null
  );

  const lwbbCareerRPGTop10 = topN(
    rows,
    TOP,
    ["rpg", "gp", "reb"],
    (r) => r.gp >= 30 && r.rpg !== null
  );

  const lwbbCareerFGPctTop10 = topN(
    rows,
    TOP,
    ["fgPct", "fgA", "fgM"],
    (r) => (r.fgA ?? 0) >= 150 && r.fgPct !== null
  );

  const lwbbCareer3PPctTop10 = topN(
    rows,
    TOP,
    ["threePct", "threePA", "threePM"],
    (r) => (r.threePA ?? 0) >= 60 && r.threePct !== null
  );

  const lwbbCareerFTPctTop10 = topN(
    rows,
    TOP,
    ["ftPct", "ftA", "ftM"],
    (r) => (r.ftA ?? 0) >= 50 && r.ftPct !== null
  );

  const lwbbCareerDDTop10 = topN(rows, TOP, ["doubleDoubles", "gp", "reb", "pts"]);

  return {
    eleventyComputed: {
      permalink: (data) =>
        data.page?.filePathStem === "/lwbb/index"
          ? "/lwbb/index.html"
          : data.permalink,
    },

    playerNameLookup,
    playerLinkLookup,

    lwbbCareerPtsTop10,
    lwbbCareerRebTop10,

    lwbbCareer3PMTop10,
    lwbbCareer3PATop10,

    lwbbCareerFTMTop10,
    lwbbCareerFTATop10,

    lwbbCareerFGPctTop10,
    lwbbCareer3PPctTop10,
    lwbbCareerFTPctTop10,

    lwbbCareerPPGTop10,
    lwbbCareerRPGTop10,

    lwbbCareerDDTop10,
  };
};
