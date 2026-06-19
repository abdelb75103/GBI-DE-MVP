# Full-text screening queue flow design

Date: 2026-06-19

## Objective

Make full-text screening a continuous review workflow: show 20 records per queue page, preserve queue context when opening and leaving a paper, and advance automatically after a saved decision.

## Queue behavior

- Load full-text records through a server-backed paginated endpoint.
- Use a fixed page size of 20.
- Replace the unbounded table with numbered pagination plus Previous and Next controls.
- Store `filter`, `search`, and `page` in the queue URL.
- Changing the filter or search resets the page to 1.
- The queue summary reports the current range and filtered total.
- Empty queues name the active filter, for example: `No papers in “Needs my vote”.`

## Reader context

- Queue links to a paper include the originating `filter`, `search`, and `page` as URL parameters.
- The reader's Back to queue link reconstructs that exact queue URL.
- Directly opened reader URLs without queue context fall back to the All records queue on page 1.

## Save and advance

After a reviewer vote or conflict resolution is saved successfully:

1. Query the current filtered queue using the preserved filter and search.
2. Exclude the completed record from candidate navigation.
3. Navigate to the next matching paper, preserving queue context.
4. If the current page has no remaining candidate, continue with the next available filtered page.
5. If the filter has no papers remaining, return to the preserved queue and insert its display label into the terminal message, for example: `No more papers in “Needs my vote”.`

The decision API remains responsible only for saving the decision. Navigation is a separate read-only step, so a navigation failure cannot make a successful vote appear unsaved. If next-paper lookup fails, show that the vote was saved and provide a clear Back to queue action.

## State and URL contract

- `filter`: one of the existing full-text queue filters; invalid values become `all`.
- `search`: trimmed free text; omitted when empty.
- `page`: positive one-based integer; invalid or out-of-range values are clamped.
- `notice`: optional queue-return status used for terminal messaging, with a fixed allowlist rather than arbitrary text.

## Accessibility and interaction

- Pagination controls use buttons/links with disabled states and accessible labels.
- The current page is announced with `aria-current="page"`.
- Saving disables duplicate submissions until the request completes.
- Automatic navigation occurs only after the save response succeeds.
- Terminal and error messages remain visible near the queue or decision panel and are not conveyed by color alone.

## Affected paths

- Full-text queue page and client component.
- Full-text queue API and database query helpers.
- Full-text reader page and workspace client.
- New full-text queue/navigation helpers and focused tests.
- Existing decision persistence, human vote records, conflict rules, PDF handling, AI recommendations, and extraction promotion remain unchanged.

## Verification

- Unit tests for URL parsing/serialization, page clamping, next-record selection, and filter labels.
- Component or helper tests proving a completed record advances to the next matching record.
- API tests for 20-record pages, filtered totals, and out-of-range pages.
- Manual browser verification using the existing development server when available; do not restart it.
