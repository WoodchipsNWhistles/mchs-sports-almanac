#!/usr/bin/env python3
"""
MCHS Almanac — GWBB season ingest (Excel tables -> canonical JSON)

Usage:
  python3 scripts/season_xlsx_to_json.py \
    --xlsx "_inbox/LW-Basketball-2025-26.xlsm" \
    --year 2026 \
    --out "src/lwbb/data/2026.json"

Notes:
- Expects sheets: SeasonMeta, ScheduleResults, Roster, GameStats
- Writes a single season JSON with:
    seasonMeta (object), roster (list), schedule (list), gameStats (list)
- Does not assume PowerQuery table objects; reads the full sheet and drops empty rows.
"""

import argparse
import json
import math
import datetime
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json_safe(val):
    """Convert pandas/Excel values to JSON-serializable types."""
    if isinstance(val, float) and math.isnan(val):
        return None
    if isinstance(val, (pd.Timestamp, datetime.datetime, datetime.date)):
        return val.isoformat()
    return val


def _rename_keys(record: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
    return {mapping.get(k, k): v for k, v in record.items()}


# ---------------------------------------------------------------------------
# Column rename maps  (Excel header -> canonical JSON key)
# ---------------------------------------------------------------------------

SCHEDULE_RENAME = {
    "GameDate":       "GameDate",
    "Date":           "Date",
    "Opponent":       "Opponent",
    "Site":           "Site",
    "Points for":     "Points for",
    "Points Against": "Points Against",
    "Outcome":        "Outcome",
    "Standings":      "Standings",
    "Notes":          "Notes",
    "SiteCode":       "SiteCode",
    "OppCode":        "OppCode",
    "GameID_Base":    "GameID_Base",
    "GameSortKey":    "GameSortKey",
    "GameID":         "GameID",
}

ROSTER_RENAME = {
    "Jersey":          "Jersey",
    "Name":            "Name",
    "Position":        "Position",
    "Grade":           "Grade",
    "GradeFull":       "GradeFull",
    "GraduationYear":  "GraduationYear",
    "FirstName":       "FirstName",
    "LastName":        "LastName",
    "PlayerID_Base":   "PlayerID_Base",
    "PlayerID_Suffix": "PlayerID_Suffix",
    "PlayerID":        "PlayerID",
}

GAMESTATS_RENAME = {
    "GameID":         "GameID",
    "PlayerID":       "PlayerID",
    "Jersey":         "Jersey",
    "PlayerName":     "PlayerName",
    "2PM":            "2PM",
    "2PA":            "2PA",
    "3PM":            "3PM",
    "3PA":            "3PA",
    "FTM":            "FTM",
    "FTA":            "FTA",
    "Pts":            "Pts",
    "Reb":            "Reb",
    "TenPlusPoints":  "TenPlusPoints",
    "DoubleDouble":   "DoubleDouble",
}

# Maps sheet name -> its rename dict
SHEET_CONFIG = {
    "ScheduleResults": SCHEDULE_RENAME,
    "Roster":          ROSTER_RENAME,
    "GameStats":       GAMESTATS_RENAME,
    # SeasonMeta is handled separately; no column renames needed.
}

REQUIRED_SHEETS = ["SeasonMeta", "ScheduleResults", "Roster", "GameStats"]


# ---------------------------------------------------------------------------
# Sheet readers
# ---------------------------------------------------------------------------

def _read_sheet(xlsx: Path, sheet: str) -> pd.DataFrame:
    df = pd.read_excel(xlsx, sheet_name=sheet, engine="openpyxl")
    df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
    df.columns = [str(c).strip() for c in df.columns]

    rename_map = SHEET_CONFIG.get(sheet, {})
    if rename_map:
        df = df.rename(columns=rename_map)

    return df


def _df_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    df2 = df.copy().where(pd.notnull(df), None)
    records = df2.to_dict(orient="records")
    for row in records:
        for k, v in row.items():
            row[k] = _json_safe(v)
    return records


def _season_meta_to_object(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Accepts either:
      A) key/value pairs: columns like ["Key","Value"] (case-insensitive), or
      B) one-row header format where each column is a field.
    """
    cols_lower = [c.lower() for c in df.columns]

    if "key" in cols_lower and "value" in cols_lower:
        k_col = df.columns[cols_lower.index("key")]
        v_col = df.columns[cols_lower.index("value")]
        meta: Dict[str, Any] = {}
        for _, row in df.iterrows():
            k = row.get(k_col)
            if k is None:
                continue
            meta[str(k).strip()] = _json_safe(row.get(v_col))
        return meta

    # Single-row object fallback
    if df.empty:
        return {}
    return {k: (None if pd.isna(v) else _json_safe(v)) for k, v in df.iloc[0].to_dict().items()}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True, help="Path to season workbook (.xlsx or .xlsm)")
    ap.add_argument("--year", required=True, type=int, help="Season year (e.g. 2026 for 2025-26)")
    ap.add_argument("--out",  required=True, help="Output JSON path (e.g. src/gwbb/data/2026.json)")
    args = ap.parse_args()

    xlsx = Path(args.xlsx).expanduser().resolve()
    out  = Path(args.out).expanduser()

    if not xlsx.exists():
        raise SystemExit(f"ERROR: xlsx not found: {xlsx}")

    # Validate required sheets
    xl = pd.ExcelFile(xlsx, engine="openpyxl")
    missing = [s for s in REQUIRED_SHEETS if s not in xl.sheet_names]
    if missing:
        raise SystemExit(f"ERROR: Missing required sheets: {missing}\nFound: {xl.sheet_names}")

    # Read sheets
    season_meta_df = _read_sheet(xlsx, "SeasonMeta")
    schedule_df    = _read_sheet(xlsx, "ScheduleResults")
    roster_df      = _read_sheet(xlsx, "Roster")
    gamestats_df   = _read_sheet(xlsx, "GameStats")

    # Validate expected columns after renaming
    def _check_cols(df, expected, sheet):
        missing_cols = [c for c in expected if c not in df.columns]
        if missing_cols:
            print(f"WARNING [{sheet}]: expected columns not found after rename: {missing_cols}")
            print(f"  Actual columns: {list(df.columns)}")

    _check_cols(schedule_df,  list(SCHEDULE_RENAME.values()),  "ScheduleResults")
    _check_cols(roster_df,    list(ROSTER_RENAME.values()),    "Roster")
    _check_cols(gamestats_df, list(GAMESTATS_RENAME.values()), "GameStats")

    # Build output
    season = {
        "seasonYear": args.year,
        "seasonMeta": _season_meta_to_object(season_meta_df),
        "schedule":   _df_to_records(schedule_df),
        "roster":     _df_to_records(roster_df),
        "gameStats":  _df_to_records(gamestats_df),
    }

    # Write
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(season, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK: wrote {out} ({out.stat().st_size:,} bytes)")
    print("Next: run 11ty build to publish into docs/ if your pipeline copies data files.")


if __name__ == "__main__":
    main()