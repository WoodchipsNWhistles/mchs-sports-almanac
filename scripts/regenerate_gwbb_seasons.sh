#!/usr/bin/env bash
set -euo pipefail

# Run from repo root: ./scripts/regenerate_gwbb_seasons.sh
# Expects files: _inbox/GW-Basketball-YYYY-YY.xlsx
# Writes to: src/gwbb/data/YYYY.json

INBOX="_inbox"
SCRIPT="scripts/season_xlsx_to_json.py"
OUTDIR="src/gwbb/data"

mkdir -p "$OUTDIR"

shopt -s nullglob
files=("$INBOX"/GW-Basketball-*.xlsx)

if (( ${#files[@]} == 0 )); then
  echo "ERROR: No files found matching $INBOX/GW-Basketball-*.xlsx"
  exit 1
fi

echo "Found ${#files[@]} workbook(s)."

for f in "${files[@]}"; do
  base="$(basename "$f")"   # e.g., GW-Basketball-2017-18.xlsx

  # Extract the first 4-digit year from filename
  if [[ "$base" =~ ([0-9]{4})-([0-9]{2}) ]]; then
    year="${BASH_REMATCH[1]}"   # 2017 (school year start)
    year2="${BASH_REMATCH[2]}"  # 18  (school year end, 2-digit)
  else
    echo "SKIP: can't parse year from filename: $base"
    continue
  fi

  # Almanac convention: seasonYear = ending year (2017-18 -> 2018)
  end_year=$(( 2000 + 10#$year2 ))
  season_year="${year:0:2}${end_year}"  # e.g. "20" + "18" -> 2018
  # But safer/clearer:
  season_year=$(( (year/100)*100 + 10#$year2 ))  # 2017/100=20 -> 2000+18=2018

  out="$OUTDIR/$season_year.json"

  echo "=== $base -> $out (seasonYear=$season_year) ==="
  python "$SCRIPT" --xlsx "$f" --year "$season_year" --out "$out"
done

echo
echo "DONE: regenerated GWBB JSON seasons into $OUTDIR/"
