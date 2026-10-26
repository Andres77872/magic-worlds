# Impact and priorities

## How to interpret impact

The audit establishes code behavior and controlled reproductions. User frustration, model contradiction, production outages, latency, and financial cost are potential consequences unless separately measured. There are no fabricated production incident counts or probability scores.

Use [finding IDs](02_findings_register.md) as the source of technical detail. Prioritize content preservation, bounded execution, permission enforcement, and reproducible runtime semantics.

## User-journey impact

| Journey | Trigger | Likely consequence | Findings |
|---|---|---|---|
| Author a campaign | Edit text, then attach a resource or receive a delayed save | Local edits can disappear | F06 |
| Edit from two tabs | Save an older full book after a newer update | Newer entries/settings can be replaced | F15 |
| Test an imported source | Run a backend preview or create a frozen attachment | Validation error or missing resource lore | F02 |
| Continue a scene | Refer to an entity indirectly in a later turn | Previously relevant entry stops being injected | F01 |
| Combine campaign books | Add/reorder/update attachments with different caps | One book controls the shared budget; priorities and recursion surprise the author | F03 |
| Protect a story secret | Use constant mode or import GM-only source material | Reveal rules do not reliably prevent spoilers | F04 |
| Write Spanish lore | Use a short key adjacent to accented letters | False whole-word activation | F14 |
| Debug a missing fact | Inspect a backend preview after editing inputs | Old results or missing exclusion reasons mislead | F13 |
| Inspect active memory | Rely on direct links, inline highlights, or snapshot badges | Effective inherited/frozen context is misrepresented | F12 |
| Use copied lore in a novel | Expect chat-style key/reveal rules | Scene reference behaves differently | F16 |
| Operate a large library | Login, browse, or generate with many linked books | More reads and payload than the immediate task needs | F17 |

## Technical impact by category

| Category | Exposure | Qualification |
|---|---|---|
| Content integrity | Draft replacement and stale full-book writes | Source-supported; complete browser/multi-client journeys still needed |
| Availability | Expensive regex on browser/server execution threads | Bounded child probes reproduced slow matching; no live load test |
| Permission correctness | Resource activation omits the resource feature key | Missing check reproduced; no cross-owner access established |
| Narrative integrity | Changing candidate set, lost recent triggers, premature secrets | Context-selection effects established; model outcomes need evaluation |
| Context/cost control | Under-counting tokens, implicit combined cap, broad summaries | Extra provider input/cost is a risk, not a measured spend |
| Explainability | Preview and UI use a narrower or stale view | Source-supported mismatch |
| Compatibility | Resource DTOs, regex dialect, copied lore, future external formats | Explicit contracts and loss reports needed |
| Scalability | Per-book child reads and whole-library source hydration | Benchmark before selecting caching or database changes |

## Recommended order

### Immediate containment and reliable editing

- F02: stop invalid/lossy resource snapshot and preview flows.
- F05: bound regex work and reject unsupported patterns predictably.
- F06/F15: preserve drafts and introduce stale-write rejection.
- F07: check the actual resource permission boundary.

These can progress without choosing semantic retrieval or building a new lore authoring experience. Snapshot changes still require the contract decisions in D03.

### Deterministic runtime policy

- F01/F03: decide history, budgets, recursion, and precedence.
- F04: define reveal/audience behavior.
- F08/F09: account for final prompt space and supported insertion locations.
- F10/F11/F14: make matching settings, labels, and Unicode behavior consistent.

Do not expand existing stored scanDepth values into a history window without a versioned migration decision.

### Trustworthy feedback and better usage

- F12/F13: effective-context inspection and fresh preview results.
- F16: explicit Story Studio copy semantics.
- F17: benchmark-guided summary and batch loading.
- Add reviewable extraction provenance and authoring/portability features from the gap backlog.

## Dependencies and shared outcomes

| Outcome | Required decisions | Relevant plan work |
|---|---|---|
| Resource snapshots preserve lore | D03 | WP02 |
| Edits survive delayed operations | D04 | WP04 |
| Predictable activation across books | D01, D02, D05 | WP05 |
| Spoilers respect audience | D06, D09 | WP06, WP09 |
| Final context matches its trace | D02, D05, D07 | WP05, WP07, WP08 |
| Permission changes have a defined effect | D08 | WP03 |
| Large-library improvements preserve correctness | D03, D04, D10 | WP10 |

Decision definitions are in [document 11](11_decisions_and_tracking.md).

## Trade-offs to review

- More history improves continuity but can reactivate irrelevant lore and consume budget.
- Cross-book recursion can support related settings but needs explicit boundaries and provenance.
- Rejecting an oversized entry preserves facts intact; trimming can remove the condition or exception that makes it correct.
- A frozen snapshot is reproducible but must preserve resource versions and disclose how updates are adopted.
- Persistent reveal state needs branch/edit/regeneration semantics; a text phrase is cheaper but must be described honestly.
- Semantic retrieval can improve recall but adds model/index lifecycle, authorization, latency, and evaluation work.
- Blocking generation on unavailable critical lore preserves canon; silent degradation may preserve availability while producing an unwanted reply. Decide rather than assuming either policy.
- A lower message role for imported reference material reduces authority confusion but does not by itself prevent prompt injection.

## What should not be claimed yet

Do not claim that secrets are an access-control system, provider token counts are exact, snapshots include all linked resources, preview reproduces final context, or the backend test suite passed. Do not call a field-value change a completed migration without an existing-data report and rollback.
