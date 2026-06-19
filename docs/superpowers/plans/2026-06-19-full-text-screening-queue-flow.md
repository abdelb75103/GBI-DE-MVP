# Full-text Screening Queue Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-backed, 20-record full-text screening queue that preserves URL context and advances to the next matching paper after a saved decision.

**Architecture:** A pure queue-contract module owns URL normalization, filter labels, page clamping, record filtering, and next-record selection. The database layer exposes a paged full-text queue read model used by both the server-rendered queue page and the GET API; the existing decision endpoint remains unchanged. Queue and reader clients serialize the same context so navigation and terminal notices remain deterministic.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase-backed database helpers, Node test runner.

---

### Task 1: Queue contract and navigation behavior

**Files:**
- Create: `fifa-gbi-data-extraction/src/lib/screening/full-text-queue.ts`
- Create: `fifa-gbi-data-extraction/tests/full-text-queue.test.mjs`

- [ ] **Step 1: Write failing contract tests**

Add tests for invalid filter fallback, trimmed/omitted search, positive page parsing, filter labels, queue/reader URL serialization, page clamping, 20-record slicing, completed-record exclusion, and next-record selection at and beyond page boundaries.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/full-text-queue.test.mjs`

Expected: FAIL because `src/lib/screening/full-text-queue.ts` does not exist.

- [ ] **Step 3: Implement the pure queue contract**

Define `FULL_TEXT_QUEUE_PAGE_SIZE = 20`, the existing filter union, a fixed filter-label map, an allowlisted `filter_empty` notice, parsing/serialization helpers, filtering/search helpers that delegate work status to the existing reviewer-decision module, page clamping, and next-record selection using the originating row position.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/full-text-queue.test.mjs`

Expected: all queue-contract tests pass.

### Task 2: Server-backed queue page and API

**Files:**
- Modify: `fifa-gbi-data-extraction/src/lib/db/screening.ts`
- Modify: `fifa-gbi-data-extraction/src/lib/mock-db.ts`
- Modify: `fifa-gbi-data-extraction/src/app/api/full-text-screening/route.ts`
- Modify: `fifa-gbi-data-extraction/src/app/full-text-screening/page.tsx`
- Extend: `fifa-gbi-data-extraction/tests/full-text-queue.test.mjs`

- [ ] **Step 1: Add failing pagination/read-model tests**

Test 20-record pages, filtered totals, total counts, out-of-range page clamping, and navigation lookup that excludes the completed record.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/full-text-queue.test.mjs`

Expected: FAIL because the paged read model is absent.

- [ ] **Step 3: Implement the paged database helper and endpoint contract**

Add `listFullTextQueuePage` to the database facade. Parse the GET endpoint with the shared contract and return the fixed-size page plus normalized context; when `navigation=next`, return only the next matching record ID. Update the server page to parse `searchParams` and load that page.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/full-text-queue.test.mjs`

Expected: all read-model tests pass.

### Task 3: Queue URL state and numbered pagination UI

**Files:**
- Modify: `fifa-gbi-data-extraction/src/components/full-text-screening-client.tsx`

- [ ] **Step 1: Route all queue interactions through the shared URL contract**

Replace client-side unbounded filtering with the server page payload. Filter/search changes write `filter`, trimmed `search`, and `page=1`; pagination writes the selected page. Search updates are debounced and server-backed.

- [ ] **Step 2: Render queue context and accessible controls**

Render the current range and filtered total, active-filter-specific empty text, numbered pages, Previous/Next disabled states, `aria-label`s, and `aria-current="page"`. Queue paper links include filter, search, page, and originating row position.

- [ ] **Step 3: Preserve upload behavior without unbounded refreshes**

After an upload or PDF attachment, refresh the current server route rather than fetching all records.

- [ ] **Step 4: Run lint/type-facing checks**

Run: `npx eslint src/components/full-text-screening-client.tsx src/app/full-text-screening/page.tsx src/app/api/full-text-screening/route.ts src/lib/screening/full-text-queue.ts src/lib/db/screening.ts src/lib/mock-db.ts`

Expected: exit 0.

### Task 4: Reader context, save-and-advance, and terminal messaging

**Files:**
- Modify: `fifa-gbi-data-extraction/src/app/full-text-screening/[id]/page.tsx`
- Modify: `fifa-gbi-data-extraction/src/components/full-text-screening-workspace-client.tsx`
- Extend: `fifa-gbi-data-extraction/tests/full-text-queue.test.mjs`

- [ ] **Step 1: Add failing reader-context/navigation tests**

Test direct-reader fallback to All records page 1, exact Back-to-queue reconstruction, reader URL preservation, next-record lookup, and allowlisted terminal notice output.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/full-text-queue.test.mjs`

Expected: the new context assertions fail before reader wiring.

- [ ] **Step 3: Implement reader context and post-save navigation**

Pass normalized queue context from the reader server page. After the existing decision PATCH succeeds, call the queue GET endpoint for the next candidate. Navigate to that reader with preserved context, or back to the preserved queue with `notice=filter_empty`. If lookup fails, retain the saved record, show that the vote was saved, and keep a visible Back-to-queue action.

- [ ] **Step 4: Guard duplicate submissions**

Disable decision choices, conflict-mode choices, and submit while the save/navigation transition is pending. Navigation starts only after a successful save response.

- [ ] **Step 5: Run focused tests and lint**

Run: `node --test tests/full-text-queue.test.mjs tests/title-abstract-supabase-finalize.test.mjs`

Run: `npx eslint src/components/full-text-screening-workspace-client.tsx src/app/full-text-screening/[id]/page.tsx`

Expected: both commands exit 0.

### Task 5: Linked-path regression verification

**Files:**
- Review only: full-text decision route, PDF routes/uploads, promotion helpers, reviewer decision rules, title/abstract promotion tests.

- [ ] **Step 1: Run the full local test suite**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Next.js build exits 0.

- [ ] **Step 3: Inspect any existing development server without restarting it**

Read the current terminal/process state. If a reachable existing server is available, verify queue URL normalization, pagination, exact Back-to-queue context, and save-and-advance in the browser. If none is available, report browser verification as not run without starting or restarting one.

- [ ] **Step 4: Review the final diff against the approved spec**

Confirm decision persistence, immutable human vote records, conflict rules, AI fields, PDF behavior, and promotion code were not altered. Confirm no commit or push occurred.
