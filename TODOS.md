# TODOS

## UI/UX Backlog (from plan-ceo-review)

### Real store logos (once a licensed asset source exists)

**What:** Replace/augment the auto-generated monogram badges with actual chain logo images (Walmart, Publix, ALDI, Costco, etc.).

**Why:** More visually recognizable/polished than initials for major chains a household shops at regularly.

**Context:** Deferred during the store-customization round because no licensed logo asset source is available in an automated session — embedding real trademarked images requires the user to source them (official press/media kits, or their own downloads). Monogram badges (colored circle + initials, using the store's editable color) ship instead this round, with zero licensing exposure. Revisit if the user wants to supply actual logo files, or a licensed logo API becomes worth paying for.

**Effort:** S
**Priority:** P3
**Depends on:** User supplying actual logo image files (or choosing a licensed logo API)

### Tap-to-open edit-sheet redesign for line-item editing

**What:** Replace the packed inline table row in the receipt review screen with a full-width, tap-to-open edit panel per line item, instead of editing inline in a dense multi-column row.

**Why:** Fixes the underlying cramped-layout problem itself, not just the symptoms (double-tap-to-select, tiny tap targets) that the targeted CSS fixes address this round.

**Context:** This round ships targeted fixes (dvh units, 16px+ font, larger tap targets, scoped text-selection) that directly resolve the specific friction reported. If the review table still feels visually cramped on a phone after using those fixes for a while, this is the natural next step — tapping a row opens a full-width edit sheet with room for more context per edit (catalog match, price history) that doesn't fit in a table row today.

**Effort:** L
**Priority:** P3
**Depends on:** Using the targeted CSS fixes first to see if they're sufficient

### Hook-level tests with mocked Supabase responses

**What:** Establish a testing pattern (e.g. `vi.mock('../lib/supabase')`) for hook-level error-path coverage. Currently this project's Vitest setup only unit-tests pure functions (`itemMatcher.test.ts`, etc.).

**Why:** The new RPC/query error paths introduced by the top-items query, MTD comparison, and store-rename handling are all rescued in code (user sees a friendly error) but not covered by any test — a regression in error handling would go unnoticed until a user hits it.

**Context:** No hook-level or component-level test pattern with mocked Supabase calls exists in this project yet. Establishing one would be a real but separate investment beyond this round's scope, and would become the reusable pattern for testing every future hook's error paths, not just these three.

**Effort:** M
**Priority:** P3
**Depends on:** None
