#!/usr/bin/env bash
#
# Rebuild both study exports from live Supabase data, end to end.
#
#   bash scripts/build-exports.sh
#
# Produces, in exports/ (timestamped) and on the Desktop (stable filenames):
#
#   analysis.csv             the analysis dataset
#   descriptive-analysis.csv the descriptive summary built from a wider source export
#
# Every exclusion rule now lives in DEFAULT_EXCLUDED_STATUSES inside
# export-all-studies.mjs, so the analysis export takes no flags at all. The
# descriptive export re-admits the statuses Abdel wants described but not
# analysed, via --allow-status. Nothing here depends on flags typed by hand.
#
# The run fails loudly if the paper or row counts drift from EXPECTED_* below.
# When a drift is real (new extractions land), update the expectations in the
# same commit so the change is visible in the diff rather than silent.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="${HOME}/Desktop"
STAMP="$(date -u +%Y-%m-%d)"

# Statuses kept in the descriptive breakdown but excluded from analysis.
DESCRIPTIVE_ALLOW=(systematic_review mental_health referee)

EXPECTED_ANALYSIS_PAPERS=456
EXPECTED_ANALYSIS_ROWS=1197
EXPECTED_DESCRIPTIVE_PAPERS=493
EXPECTED_DESCRIPTIVE_ROWS=1244
EXPECTED_ANALYTIC_UNITS=487

cd "$ROOT"

# Pull `key=value` out of a script's stdout, which both exporters print.
field() { sed -n "s/^$2=//p" <<<"$1" | tail -1; }

check() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "DRIFT: ${label} is ${actual}, expected ${expected}." >&2
    echo "       If the data genuinely changed, update EXPECTED_* in $0." >&2
    exit 1
  fi
  printf '  %-28s %s\n' "$label" "$actual"
}

echo "==> analysis export"
analysis_out="$(node scripts/export-all-studies.mjs --output-prefix "analysis-${STAMP}")"
analysis_csv="$(field "$analysis_out" output)"
check "papers" "$(field "$analysis_out" papers_exported)" "$EXPECTED_ANALYSIS_PAPERS"
check "rows" "$(field "$analysis_out" rows)" "$EXPECTED_ANALYSIS_ROWS"

echo "==> descriptive source export"
allow_args=()
for status in "${DESCRIPTIVE_ALLOW[@]}"; do allow_args+=(--allow-status "$status"); done
descriptive_out="$(node scripts/export-all-studies.mjs \
  --output-prefix "descriptive-source-${STAMP}" "${allow_args[@]}")"
descriptive_csv="$(field "$descriptive_out" output)"
check "papers" "$(field "$descriptive_out" papers_exported)" "$EXPECTED_DESCRIPTIVE_PAPERS"
check "rows" "$(field "$descriptive_out" rows)" "$EXPECTED_DESCRIPTIVE_ROWS"

echo "==> descriptive summary"
summary_out="$(python3 scripts/build_descriptive_summary.py "$descriptive_csv" \
  --output-prefix "descriptive-summary-${STAMP}")"
summary_csv="$(field "$summary_out" output)"
check "analytic units" "$(field "$summary_out" analytic_units)" "$EXPECTED_ANALYTIC_UNITS"

cp "$analysis_csv" "${DESKTOP}/analysis.csv"
cp "$summary_csv" "${DESKTOP}/descriptive-analysis.csv"

echo
echo "Desktop:"
echo "  ${DESKTOP}/analysis.csv"
echo "  ${DESKTOP}/descriptive-analysis.csv"
echo "Timestamped source, plus -excluded- and -granular-subset-rows- audits, in exports/."
