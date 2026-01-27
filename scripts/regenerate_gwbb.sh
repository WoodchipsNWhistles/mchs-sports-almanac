#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

INBOX="_inbox"
OUT="src/gwbb/data"
SCRIPT="scripts/season_xlsx_to_json.py"

# If venv exists, use it (helps when you run script directly)
if [ -f ".venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  . ".venv/bin/activate"
fi

# YEAR|FILENAME lines (ordered)
SEASONS='
2012|GW-Basketball-2011-12.xlsx
2013|GW-Basketball-2012-13.xlsx
2014|GW-Basketball-2013-14.xlsm
2015|GW-Basketball-2014-15.xlsx
2016|GW-Basketball-2015-16.xlsx
2017|GW-Basketball-2016-17.xlsx
2018|GW-Basketball-2017-18.xlsx
2019|GW-Basketball-2018-19.xlsm
2020|GW-Basketball-2019-20.xlsx
2021|GW-Basketball-2020-21.xlsx
2022|GW-Basketball-2021-22.xlsx
2023|GW-Basketball-2022-23.xlsx
2024|GW-Basketball-2023-24.xlsx
2025|GW-Basketball-2024-25.xlsx
'

echo "$SEASONS" | while IFS='|' read -r YEAR FILE; do
  [ -z "${YEAR:-}" ] && continue
  XPATH="${INBOX}/${FILE}"

  echo "==> ${YEAR} from ${XPATH}"

  if [ ! -f "$XPATH" ]; then
    echo "WARN: missing file: $XPATH (skipping)"
    continue
  fi

  python3 "$SCRIPT" \
    --xlsx "$XPATH" \
    --year "$YEAR" \
    --out "${OUT}/${YEAR}.json"
done
