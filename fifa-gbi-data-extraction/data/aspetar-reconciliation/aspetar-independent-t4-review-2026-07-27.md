# Independent T4 acceptance review

Reviewer profile: `sol_xhigh`, `gpt-5.6-sol`, xhigh reasoning

Date: 27 July 2026

Verdict: formal T4 acceptance withheld on one process finding. The reconciled live data passes integrity review.

## Findings

### P1, blocking process acceptance

The standard apply helper deletes the existing scoped `population_values` and `population_groups` rows before recreating them. Although the pre-apply snapshot is complete, S2824's prior nine rows and 108 values were restored into the expanded 13-row, 216-value representation, and the final live state has no detected data loss, deletion of cloud records is defined as destructive by the repository instructions. The user also expressly prohibited deletion. The criterion that no destructive action occurred is therefore not met.

This is a process-acceptance defect, not a live data-integrity failure. Formal acceptance requires an explicit waiver of this process criterion. No further deletion or rollback was attempted.

### P2, non-blocking source caveat

S602 states that the cohort spans nine countries but enumerates ten jurisdictions, including China and Hong Kong separately. The payload preserves both views. The first-search backlog and reconciliation summary now flag the inconsistency.

## Criteria that passed

- no P0 findings;
- defensible three-anchor architecture;
- source-supported duplicate and overlap classifications;
- zero S2824 prior-value prefix mismatches;
- fixed family and apply memberships agree;
- exact PDF hashes recorded and matched where live hashes were registered;
- alias repairs match their recorded prior rows;
- zero staged-field mismatches;
- zero extraction-to-population dual-write mismatches;
- unchanged protected screening metadata signature;
- unchanged statuses, assignments, flags, and source attachments;
- exact three dated reconciliation note IDs recorded;
- no commit, push, deployment, screening-vote change, protected-metadata change, or destructive cleanup.
