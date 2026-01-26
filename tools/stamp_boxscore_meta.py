import json
from pathlib import Path

SEASON_PATH = Path("src/gwbb/data/2025.json")
BOX_DIR = Path("src/gwbb/boxscores")

with SEASON_PATH.open("r", encoding="utf-8") as f:
    season = json.load(f)

sport_code = season.get("sportCode", "GWBB")
season_year_end = int(season.get("seasonYearEnd", 2025))
season_id = season.get("seasonID", f"{sport_code}{season_year_end}")

# Build lookup from schedule by gameID
schedule = season.get("schedule", [])
by_game = {g.get("gameID"): g for g in schedule if g.get("gameID")}

changed = 0
missing = 0

for box_path in sorted(BOX_DIR.glob("*.json")):
    game_id = box_path.stem

    if game_id not in by_game:
        # If there are stray files, leave them alone but report.
        missing += 1
        continue

    g = by_game[game_id]

    # Load existing boxscore JSON if present/valid; otherwise start fresh
    try:
        raw = box_path.read_text(encoding="utf-8").strip()
        box = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        box = {}

    # Stamp/overwrite canonical header fields (safe + repeatable)
    box["sportCode"] = sport_code
    box["seasonYearEnd"] = season_year_end
    box["seasonID"] = season_id
    box["gameID"] = game_id

    # Date: try to derive ISO from gameID token YYYYMMDD
    # Format: GWBB2025-20241206-H-BULLIT  -> 2024-12-06
    try:
        date_token = game_id.split("-")[1]
        box["dateISO"] = f"{date_token[0:4]}-{date_token[4:6]}-{date_token[6:8]}"
    except Exception:
        # fallback: keep existing or omit
        box.setdefault("dateISO", None)

    box["opponent"] = g.get("opponent")
    box["siteCode"] = g.get("siteCode")
    box["pf"] = g.get("pf")
    box["pa"] = g.get("pa")
    box["outcome"] = g.get("outcome")

    # Preserve status if already something else
    box.setdefault("status", "stub")

    box_path.write_text(json.dumps(box, indent=2) + "\n", encoding="utf-8")
    changed += 1

print(f"Updated {changed} boxscore files from {SEASON_PATH}.")
if missing:
    print(f"Note: {missing} boxscore files had no matching gameID in season schedule (left untouched).")
