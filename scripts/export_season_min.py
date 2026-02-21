#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import pandas as pd


# =========================
# CONFIG
# =========================
PERSON_INDEX_PATH = Path("src/_data/personIndex.json")

# Default sheet names (edit if your workbook uses different ones)
SHEET_SEASONMETA = "SeasonMeta"
SHEET_SCHEDULERESULTS = "ScheduleResults"
SHEET_GAMESTATS = "GameStats"
SHEET_ROSTER = "Roster"

# Output filenames
OUT_SEASONMETA = "SeasonMeta_min.csv"
OUT_SCHEDULERESULTS = "ScheduleResults_min.csv"
OUT_GAMESTATS = "GameStats_min.csv"
OUT_ROSTER = "Roster_min.csv"


# =========================
# HELPERS
# =========================
def die(msg: str, code: int = 2):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)

def read_sheet(xlsx_path: Path, sheet_name: str) -> pd.DataFrame:
    try:
        return pd.read_excel(xlsx_path, sheet_name=sheet_name, dtype=str).fillna("")
    except Exception as e:
        die(f"Could not read sheet '{sheet_name}' from {xlsx_path}: {e}")

def to_iso_date(series: pd.Series) -> pd.Series:
    # handles Excel date serials and strings; blanks remain blank
    dt = pd.to_datetime(series, errors="coerce")
    out = dt.dt.strftime("%Y-%m-%d")
    return out.where(~dt.isna(), "")

def safe_select(df: pd.DataFrame, cols: list[str], sheet_name: str) -> pd.DataFrame:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        die(
            f"{sheet_name} missing expected columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )
    return df[cols].copy()

def write_csv(df: pd.DataFrame, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False, encoding="utf-8")

def load_person_index_maps(path: Path):
    if not path.exists():
        die(f"Missing person index JSON at: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))

    # lock to your confirmed structure
    if not isinstance(data, dict) or "people" not in data or "byAlias" not in data:
        die("personIndex.json must be a dict with top-level keys: people, byAlias")

    people = data["people"]
    by_alias = data["byAlias"]

    if not isinstance(people, dict):
        die("personIndex.json['people'] must be a dict keyed by PID")
    if not isinstance(by_alias, dict):
        die("personIndex.json['byAlias'] must be a dict mapping alias->PID")

    alias_to_pid = {str(k).strip(): str(v).strip() for k, v in by_alias.items()}

    pid_to_name = {}
    for pid, obj in people.items():
        pid = str(pid).strip()
        if not pid:
            continue

        # always self-map PID
        alias_to_pid[pid] = pid

        if isinstance(obj, dict):
            name = (
                obj.get("name")
                or obj.get("nameFull")
                or obj.get("displayName")
                or obj.get("playerName")
                or obj.get("PlayerName")
                or ""
            )
            name = str(name).strip()
            if name:
                pid_to_name[pid] = name

    return alias_to_pid, pid_to_name

def map_id_to_pid(val: str, alias_to_pid: dict) -> str:
    s = str(val).strip() if val is not None else ""
    if not s:
        return ""
    return alias_to_pid.get(s, s)

def map_pid_to_name(pid: str, pid_to_name: dict) -> str:
    s = str(pid).strip() if pid is not None else ""
    if not s:
        return ""
    return pid_to_name.get(s, "")


# =========================
# MAIN
# =========================
def main():
    if len(sys.argv) < 2:
        die("Usage: python3 export_season_min.py <SeasonWorkbook.xlsx> [outdir]")

    xlsx_path = Path(sys.argv[1])
    if not xlsx_path.exists():
        die(f"Workbook not found: {xlsx_path}")

    outdir = Path(sys.argv[2]) if len(sys.argv) >= 3 else Path(".")
    alias_to_pid, pid_to_name = load_person_index_maps(PERSON_INDEX_PATH)

    # --- SeasonMeta ---
    seasonmeta = read_sheet(xlsx_path, SHEET_SEASONMETA)
    seasonmeta_min = safe_select(
        seasonmeta,
        cols=["CoachID", "SeasonYearEnd", "SportCode"],
        sheet_name="SeasonMeta"
    )
    seasonmeta_min["CoachID"] = seasonmeta_min["CoachID"].map(lambda x: map_id_to_pid(x, alias_to_pid))
    write_csv(seasonmeta_min, outdir / OUT_SEASONMETA)

    # --- ScheduleResults ---
    schedule = read_sheet(xlsx_path, SHEET_SCHEDULERESULTS)
    schedule_min = safe_select(
        schedule,
        cols=["GameDate", "Opponent", "Site", "Points for", "Points Against", "Outcome", "Notes", "GameID"],
        sheet_name="ScheduleResults"
    )
    schedule_min["GameDate"] = to_iso_date(schedule_min["GameDate"])
    write_csv(schedule_min, outdir / OUT_SCHEDULERESULTS)

    # --- GameStats ---
    gamestats = read_sheet(xlsx_path, SHEET_GAMESTATS)
    gamestats_min = safe_select(
        gamestats,
        cols=[
            "GameID", "PlayerID", "Jersey",  # inputs
            "2PM", "2PA", "3PM", "3PA", "FTM", "FTA",
            "Pts", "Reb", "TenPlusPoints", "DoubleDouble"
        ],
        sheet_name="GameStats"
    )

    # Normalize PlayerID -> PID
    gamestats_min["PlayerID"] = gamestats_min["PlayerID"].map(lambda x: map_id_to_pid(x, alias_to_pid))

    # Replace PlayerID -> PlayerName (canonical)
    gamestats_min.insert(
        3,  # after GameID, PlayerID, Jersey
        "PlayerName",
        gamestats_min["PlayerID"].map(lambda pid: map_pid_to_name(pid, pid_to_name))
    )

    # If you want to DROP PlayerID from export, uncomment next line:
    # gamestats_min = gamestats_min.drop(columns=["PlayerID"])

    write_csv(gamestats_min, outdir / OUT_GAMESTATS)

    # --- Roster ---
    roster = read_sheet(xlsx_path, SHEET_ROSTER)
    roster_min = safe_select(
        roster,
        cols=["Jersey", "Name"],
        sheet_name="Roster"
    )
    write_csv(roster_min, outdir / OUT_ROSTER)

    print("Done. Wrote:")
    print(" -", outdir / OUT_SEASONMETA)
    print(" -", outdir / OUT_SCHEDULERESULTS)
    print(" -", outdir / OUT_GAMESTATS)
    print(" -", outdir / OUT_ROSTER)


if __name__ == "__main__":
    main()