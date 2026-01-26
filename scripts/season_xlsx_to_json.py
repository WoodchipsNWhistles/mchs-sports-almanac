#!/usr/bin/env python3
"""
MCHS Almanac — GWBB season ingest (Excel tables -> canonical JSON)

Usage:
  python scripts/season_xlsx_to_json.py \
    --xlsx "_inbox/GW-Basketball-2023-24.xlsx" \
    --year 2024 \
    --out "src/gwbb/data/2024.json"

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

def _json_safe(val):
    # pandas/Excel missing numeric values often become float NaN
    if isinstance(val, float) and math.isnan(val):
        return None

    # timestamps/dates -> ISO strings
    if isinstance(val, (pd.Timestamp, datetime.datetime, datetime.date)):
        return val.isoformat()

    return val



REQUIRED_SHEETS = ["SeasonMeta", "ScheduleResults", "Roster", "GameStats"]


def _read_sheet(xlsx: Path, sheet: str) -> pd.DataFrame:
    df = pd.read_excel(xlsx, sheet_name=sheet, engine="openpyxl")
    # Drop fully-empty rows/cols
    df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
    # Normalize column names: keep as-is but strip whitespace
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _df_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    df2 = df.copy()
    df2 = df2.where(pd.notnull(df2), None)

    records = df2.to_dict(orient="records")
    for row in records:
        for k, v in row.items():
            row[k] = _json_safe(v)

    return records


def _season_meta_to_object(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Accepts either:
      A) key/value pairs: columns like ["Key","Value"] (case-insensitive), OR
      B) one-row header format where each column is a field.
    """
    cols_lower = [c.lower() for c in df.columns]
    if "key" in cols_lower and "value" in cols_lower:
        k_col = df.columns[cols_lower.index("key")]
        v_col = df.columns[cols_lower.index("value")]
        meta: Dict[str, Any] = {}
        for _, row in df.iterrows():
            k = row.get(k_col)
            v = row.get(v_col)
            if k is None:
                continue
            meta[str(k).strip()] = v
        return meta

    # Otherwise: treat as single-row object (first row)
    if len(df.index) < 1:
        return {}
    row0 = df.iloc[0].to_dict()
    # NaN->None
    row0 = {k: (None if pd.isna(v) else v) for k, v in row0.items()}
    return row0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True, help="Path to season workbook (.xlsx)")
    ap.add_argument("--year", required=True, type=int, help="Season year folder key (e.g., 2024 for 2023-24)")
    ap.add_argument("--out", required=True, help="Output JSON path (e.g., src/gwbb/data/2024.json)")
    args = ap.parse_args()

    xlsx = Path(args.xlsx).expanduser().resolve()
    out = Path(args.out).expanduser()

    if not xlsx.exists():
        raise SystemExit(f"ERROR: xlsx not found: {xlsx}")

    # Validate sheets exist
    xl = pd.ExcelFile(xlsx, engine="openpyxl")
    missing = [s for s in REQUIRED_SHEETS if s not in xl.sheet_names]
    if missing:
        raise SystemExit(f"ERROR: Missing required sheets: {missing}\nFound: {xl.sheet_names}")

    season_meta_df = _read_sheet(xlsx, "SeasonMeta")
    schedule_df = _read_sheet(xlsx, "ScheduleResults")
    roster_df = _read_sheet(xlsx, "Roster")
    gamestats_df = _read_sheet(xlsx, "GameStats")

    season = {
        "seasonYear": args.year,
        "seasonMeta": _season_meta_to_object(season_meta_df),
        "schedule": _df_to_records(schedule_df),
        "roster": _df_to_records(roster_df),
        "gameStats": _df_to_records(gamestats_df),
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(season, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"OK: wrote {out} ({out.stat().st_size:,} bytes)")
    print("Next: run 11ty build to publish into docs/ if your pipeline copies data files.")


if __name__ == "__main__":
    main()
