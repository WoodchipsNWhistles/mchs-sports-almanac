#!/usr/bin/env python3
"""
Export SeasonMetaData table (one row per season) -> JSON

Usage:
  python3 scripts/season_meta_table_to_json.py \
    --xlsx "_inbox/GWBB-SeasonMetaData.xlsx" \
    --sheet "seasonMetaData" \
    --out "src/gwbb/data/seasonMeta.json"
"""

import argparse
import json
import math
from pathlib import Path

import pandas as pd


def _json_safe(val):
    if isinstance(val, float) and math.isnan(val):
        return None
    # convert numpy ints etc.
    if hasattr(val, "item"):
        try:
            return val.item()
        except Exception:
            pass
    return val


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True, help="Path to workbook containing seasonMetaData table")
    ap.add_argument("--sheet", default="seasonMetaData", help="Sheet name (default: seasonMetaData)")
    ap.add_argument("--out", required=True, help="Output JSON path")
    args = ap.parse_args()

    xlsx = Path(args.xlsx).expanduser().resolve()
    out = Path(args.out).expanduser()

    if not xlsx.exists():
        raise SystemExit(f"ERROR: xlsx not found: {xlsx}")

    df = pd.read_excel(xlsx, sheet_name=args.sheet, engine="openpyxl")
    df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")
    df.columns = [str(c).strip() for c in df.columns]

    # Normalize types
    df = df.where(pd.notnull(df), None)

    # Force ints for known flag columns if present
    flag_cols = [
        "districtChampion","districtRunnerUp","regionChampion","regionRunnerUp",
        "stateSweet16","stateElite8","stateFinalFour","stateFinalist","stateChampion",
    ]
    for c in flag_cols:
        if c in df.columns:
            df[c] = df[c].apply(lambda x: int(x) if x in (0, 1, 0.0, 1.0) else (0 if x is None else int(x)))

    if "seasonYearEnd" in df.columns:
        df["seasonYearEnd"] = df["seasonYearEnd"].apply(lambda x: int(x) if x is not None else None)

    records = []
    for r in df.to_dict(orient="records"):
        records.append({k: _json_safe(v) for k, v in r.items()})

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: wrote {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
