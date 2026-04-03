# Covidence Query Workflow

This workflow is read-only with respect to Covidence.

It has two data sources:

- Covidence CSV exports normalized into local JSON snapshots.
- Live browser snapshots from the active signed-in Covidence tab in Google Chrome.

## 1. Ingest a Covidence export

```bash
node scripts/covidence-query.mjs ingest-export \
  --csv /abs/path/review.csv \
  --out-dir /abs/path/covidence-query
```

This creates a timestamped JSON snapshot that can be queried later.

## 2. Capture a live Covidence browser snapshot

Preconditions:

- You are signed into Covidence in Google Chrome.
- Chrome has `View > Developer > Allow JavaScript from Apple Events` enabled.
- The active Chrome tab is already on the Covidence page you want to inspect.

Run:

```bash
node scripts/covidence-query.mjs snapshot-browser \
  --out-dir /abs/path/covidence-query
```

This captures the current page URL, heading, visible study links, row text, inferred statuses, and tags.

## 3. Query a snapshot

Examples:

```bash
node scripts/covidence-query.mjs query --source /abs/path/covidence-query
node scripts/covidence-query.mjs query --source /abs/path/covidence-query --status unresolved
node scripts/covidence-query.mjs query --source /abs/path/covidence-query --tag include
node scripts/covidence-query.mjs query --source /abs/path/covidence-query --text "ACL"
node scripts/covidence-query.mjs query --source /abs/path/covidence-query --study "Gasparin"
```

By default, `--source` may point to either a JSON snapshot file or a directory containing snapshots. If it is a directory, the latest JSON snapshot is used.

## 4. Compare two snapshots

```bash
node scripts/covidence-query.mjs diff \
  --left /abs/path/older-snapshot.json \
  --right /abs/path/newer-snapshot.json
```

This reports:

- records added in the newer snapshot
- records missing from the newer snapshot
- records whose status, tags, title, study, or visible row text changed
