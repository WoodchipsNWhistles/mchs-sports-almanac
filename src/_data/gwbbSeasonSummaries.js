const fs = require("fs");
const path = require("path");
const buildCoachLookup = require("./coachLookup.js");
const buildGwbbSeasonMeta = require("./gwbbSeasonMeta.js");

const DATA_DIR = path.join(process.cwd(), "src", "gwbb", "data");


function isCancelledGame(g) {
  const outcome = String(g.outcome ?? g.Outcome ?? "").toLowerCase();
  const notes = String(g.notes ?? g.Notes ?? "").toLowerCase();

  if (outcome.includes("cancel")) return true;
  if (notes.includes("cancel")) return true;

  // If you want an extra guardrail for the legacy “Tie 0–0” COVID rows:
  const pf = g.pointsFor ?? g["Points for"];
  const pa = g.pointsAgainst ?? g["Points Against"];
  if ((pf === 0 || pf === "0") && (pa === 0 || pa === "0") && notes.includes("covid")) return true;

  return false;
}

function computeWLPFPA(schedule) {
  let wins = 0;
  let losses = 0;
  let pfTotal = 0;
  let paTotal = 0;

  for (const g of schedule || []) {
    if (isCancelledGame(g)) continue;

    const pf = Number(g.pointsFor ?? g["Points for"]);
    const pa = Number(g.pointsAgainst ?? g["Points Against"]);

    // Only count games with real finals
    if (!Number.isFinite(pf) || !Number.isFinite(pa)) continue;

    pfTotal += pf;
    paTotal += pa;

    const outcome = String(g.outcome ?? g.Outcome ?? "").toLowerCase();
    if (outcome.startsWith("w")) wins += 1;
    else if (outcome.startsWith("l")) losses += 1;
    else {
      // fallback if outcome is messy: decide by score
      if (pf > pa) wins += 1;
      else if (pa > pf) losses += 1;
    }
  }

  return { wins, losses, pfTotal, paTotal };
}

function postseasonPhrase(meta) {
  if (!meta) return "";

  const parts = [];

  if (meta.districtChampion == 1) parts.push("District champion");
  else if (meta.districtRunnerUp == 1) parts.push("District runner-up");

  if (meta.regionChampion == 1) parts.push("Region champion");
  else if (meta.regionRunnerUp == 1) parts.push("Region runner-up");

  // Kentucky: Sweet 16 = state berth
  if (meta.stateChampion == 1) parts.push("State Champion");
  else if (meta.stateFinalist == 1) parts.push("State Finalist");
  else if (meta.stateFinalFour == 1) parts.push("State Final Four");
  else if (meta.stateElite8 == 1) parts.push("State Elite Eight");
  else if (meta.stateSweet16 == 1) parts.push("State Sweet 16");

  return parts.join(" • ");
}

module.exports = function (data) {
const coachLookup = buildCoachLookup();
const gwbbSeasonMeta = buildGwbbSeasonMeta();


  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => /^\d{4}\.json$/.test(f)) // ONLY season files like 2025.json
    .sort();

  const out = {};

  for (const f of files) {
    const seasonYearEnd = Number(f.replace(".json", ""));
    const season = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));

    const schedule = season.schedule || [];
    const { wins, losses, pfTotal, paTotal } = computeWLPFPA(schedule);

    const meta = gwbbSeasonMeta[seasonYearEnd] || null;
   const coachId =
  meta?.coachId ||
  meta?.coachID ||
  meta?.CoachID ||
  meta?.CoachId ||
  null;

    const coachName = coachId ? (coachLookup[coachId]?.coachName || coachId) : null;

    const seasonLabel = `${seasonYearEnd - 1}\u2013${String(seasonYearEnd).slice(-2)}`;
    const post = postseasonPhrase(meta);

const lede =
  coachName
    ? `In ${seasonLabel}, ${coachName} led Meade County to ${wins}–${losses} (${pfTotal}–${paTotal} in points).${post ? ` ${post}.` : ""}`
    : `In ${seasonLabel}, Meade County finished ${wins}–${losses} (${pfTotal}–${paTotal} in points).${post ? ` ${post}.` : ""}`;

    out[seasonYearEnd] = {
      seasonYearEnd,
      seasonLabel,
      coachId,
      coachName,
      wins,
      losses,
      pfTotal,
      paTotal,
      postseason: post,
      lede,
    };
  }

  return out;
};
