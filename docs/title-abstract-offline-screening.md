# Title/Abstract Offline Screening

This workflow reserves a fixed title/abstract batch for one reviewer, writes a standalone phone HTML file, and keeps those records out of the normal online queue until the offline decisions are imported or the pack is abandoned.

The generated HTML pack contains live screening records. Do not commit it, put it in `public/`, or deploy it as a static asset. Keep it as a local file and move it to the reviewer's phone directly.

## Create A Phone Pack

From the app directory:

```bash
cd /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction
npm run title-abstract:offline-export -- \
  --reviewer-profile-id 00000000-0000-0000-0000-000000000001 \
  --limit 2000 \
  --output /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/title-abstract-offline/gbi-title-abstract-offline.html \
  --apply
```

Reviewer profile ids can be checked in the `profiles` table. AbdelRahman Babiker is:

```text
00000000-0000-0000-0000-000000000001
```

The export script:

- selects eligible `title_abstract` records only;
- excludes records that already have a human title/abstract vote;
- excludes records already reserved in another active offline pack;
- writes an active reservation into each selected record's metadata;
- writes a manifest next to the HTML pack;
- writes only successfully reserved records into the phone HTML.

Run the same command without `--apply` for a no-write eligibility count.

To rebuild the phone HTML for an already reserved pack without changing the database:

```bash
cd /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction
npm run title-abstract:offline-export -- \
  --reviewer-profile-id 00000000-0000-0000-0000-000000000001 \
  --existing-pack-id <pack-id> \
  --output /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/exports/title-abstract-offline/gbi-title-abstract-offline.html
```

## Use On Phone

Preferred path: open the hosted pack URL on the phone while online:

```text
https://fifa-gbi-data-extraction-amber.vercel.app/title-abstract-offline/<pack-id>
```

For Abdel's current reserved pack:

```text
https://fifa-gbi-data-extraction-amber.vercel.app/title-abstract-offline/ta-offline-2026-06-04T23-11-19-423Z-a3a83b66
```

This URL is intentionally not behind profile selection. It serves the reserved pack as AbdelRahman Babiker's reviewer profile so the exported JSON imports under that reviewer id. Wait until the header says `Offline reload ready on this device.` before travelling.

The older local `.html` transfer path is available as a fallback, but iOS Files/Quick Look can preview HTML without running JavaScript. If the title/abstract area is blank, the phone is previewing the file instead of running it as a browser app. Use the hosted URL instead.

On iPhone with the hosted URL:

1. Open the hosted pack URL in Safari while on WiFi.
2. Confirm the title/abstract content is visible.
3. Confirm the header says `Offline reload ready on this device.`
4. Put the phone into Airplane Mode and refresh once as a test.
5. Keep that browser tab for the trip.
6. Make include, exclude, or flag decisions.
7. Every 25 decisions, use `Download JSON` or `Copy JSON` as a backup.
8. At the end, tap `Export decisions`, then `Download JSON` or `Copy JSON`.

For local HTML file fallback:

1. Move the generated `.html` file to the phone before travelling. AirDrop, iCloud Drive, Finder file sync, or another direct file transfer is fine.
2. Open it in a browser that actually runs local HTML JavaScript, not just a file preview.
3. Make include, exclude, or flag decisions. After each saved decision, the page advances to the next record and scrolls back to the top.
4. Every 25 decisions, use `Download JSON` or `Copy JSON` as a backup.
5. At the end, tap `Export decisions`, then `Download JSON` or `Copy JSON`.

No network is needed after the hosted page has loaded and cached on the phone, or after a working local HTML file has loaded. The only prerequisite after that is a way to bring the exported JSON back when online.

Phone browser storage is not a durable database. Export JSON backups periodically and before closing tabs, clearing browser data, changing phones, or updating iOS. If the phone browser does not allow storage for the local file, the page will show a warning and decisions will still work in the open page, but they must be exported before leaving or reloading it.

## Import Decisions

First run a dry run:

```bash
cd /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction
npm run title-abstract:offline-import -- \
  --reviewer-profile-id 00000000-0000-0000-0000-000000000001 \
  --input /path/to/decisions.json
```

If the dry run looks correct, apply:

```bash
npm run title-abstract:offline-import -- \
  --reviewer-profile-id 00000000-0000-0000-0000-000000000001 \
  --input /path/to/decisions.json \
  --apply
```

The importer writes reviewer votes only. It does not rewrite existing human votes and does not add resolver decisions.
If an include import is interrupted after the vote is saved but before the full-text placeholder is linked, rerun the same import command. The importer will recover the interrupted promotion instead of adding a second vote or duplicate placeholder.

## Release A Pack

After imported decisions are checked, release the remaining active reservations:

```bash
cd /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction
npm run title-abstract:offline-release -- \
  --reviewer-profile-id 00000000-0000-0000-0000-000000000001 \
  --pack-id <pack-id> \
  --decisions /path/to/decisions.json \
  --confirm-imported \
  --apply
```

The `--decisions` file is required with `--confirm-imported`. Release checks that every decision in that JSON has already imported and that included records have finished full-text linking before it releases any remaining active reservations.

If a pack was never used and should be discarded, use the explicit abandon path:

```bash
npm run title-abstract:offline-release -- \
  --reviewer-profile-id 00000000-0000-0000-0000-000000000001 \
  --pack-id <pack-id> \
  --abandon \
  --apply
```

Do not release an active pack before importing its JSON unless the offline work is intentionally being abandoned. Releasing first makes those records eligible for normal online screening again.

## Deployment Notes

The deployed app only needs the code and migration so the online queue hides active offline reservations and exposes the `Reserved offline` filter. The phone pack itself is intentionally not deployed.

Before committing or deploying code changes, run:

```bash
cd /Users/abdelbabiker/Downloads/GBI-DE-MVP-main/fifa-gbi-data-extraction
for f in tests/title-abstract-*.test.mjs; do node --experimental-strip-types "$f" || exit 1; done
npm exec --yes tsx -- --test tests/title-abstract-*.test.mjs
npm run lint
npm run build
```
