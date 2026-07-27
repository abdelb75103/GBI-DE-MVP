# Independent T4 acceptance review, 27 July 2026

Reviewer: independent `sol_xhigh` fresh-context review

Final decision: **ACCEPT**

Confidence: high

## Acceptance

The reviewer accepted the source-family overlap audit after two P1 findings were corrected:

1. The UEFA generator originally depended on an uncommitted, out-of-scope source audit. `uefa-source-family-evidence-input-2026-07-27.json` now freezes the exact required ledgers and source hash. A clean regeneration reproduced identical semantic hashes and all 155 treatments.
2. The export verifier originally checked CSV paper membership but not CSV row identity. It now parses both CSV scopes, asserts total row counts, and verifies exact paper ID, population position, label and Tournament / Series key across all 104 row policies.

The reviewer confirmed that:

- the inventory contains 842 unique, non-null live study IDs;
- the extension contains 155 treatments and 97 complete row maps;
- the combined tournament union contains 182 papers and 104 row policies;
- S076/S261/S1431, S112/S1091, S2824 and UEFA master row ownership are coherent and bound to stable live evidence;
- staged source links, exclusions, labels, positions and expected values reconcile to the frozen inventory;
- reconstructed rollback metadata is self-consistent with zero prior-treatment mismatches;
- apply-window protected hashes match for papers, notes, files, extractions, populations, screening records and votes;
- the later S3577 session-heartbeat drift is ephemeral concurrent activity and does not invalidate the apply-window proof.

## Remaining P2

The underlying application exporter uses unpaginated per-paper queries. The current audited maximum is 652 population values for one paper, below the Supabase row cap, so this is not a current acceptance blocker. A future paper above the cap should trigger pagination work.
