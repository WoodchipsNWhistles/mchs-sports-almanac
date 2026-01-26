import json
from pathlib import Path

# Path to season file
SEASON_PATH = Path("src/gwbb/data/2025.json")

# Load JSON
with SEASON_PATH.open("r", encoding="utf-8") as f:
    season = json.load(f)

changed = 0

# Iterate schedule games
for game in season.get("schedule", []):
    if "boxscoreID" not in game:
        game["boxscoreID"] = game["gameID"]
        changed += 1

# Write back to file
with SEASON_PATH.open("w", encoding="utf-8") as f:
    json.dump(season, f, indent=2)

print(f"Added boxscoreID to {changed} games.")

