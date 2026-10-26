# Proposed behavior and contracts

**Status: proposal.** These contracts are implementation design input. Field names and endpoint shapes below are illustrative; no schema, route, or migration was added. Decisions D01–D10 remain open in [document 11](11_decisions_and_tracking.md).

## Desired invariants

1. Equal authorized inputs, revisions, and policy version produce equal deterministic candidate decisions.
2. No selected item bypasses owner, application, workspace, temporary feature permission, or audience checks.
3. Preview and live execution use the same evaluation policy; differences in available inputs are disclosed.
4. Candidate selection is distinct from prompt placement.
5. Final accounting includes the actual rendered fragments and an output reserve.
6. A frozen attachment contains the resource versions required to reproduce its meaning.
7. Any rejected write preserves the user's draft.
8. A trace can explain both selected and excluded candidates without leaking disallowed secrets.
9. User data and imported text cannot choose graphs, provider credentials, or privileged tools.
10. Literal matching and supported regex semantics agree across execution paths.

## Proposed activation pipeline

~~~mermaid
flowchart TD
    A[Resolve conversation and source identities] --> B[Authorize roots and candidate sources]
    B --> C[Resolve attachment modes and precedence]
    C --> D[Build bounded recent-message input]
    D --> E[Evaluate direct matches and explicit pins]
    E --> F[Evaluate disclosure and enabled gates]
    F --> G[Bounded permitted recursion]
    G --> H[Rank eligible candidates deterministically]
    H --> I[Apply entry, book, and conversation limits]
    I --> J[Render supported prompt locations]
    J --> K[Account for complete request and output reserve]
    K --> L[Store author-safe decision trace]
~~~

Recheck disclosure/permission eligibility for every recursive/semantic candidate. The ordering above does not allow a later retrieval path to bypass a gate.

## History and recursion

Separate concepts:

| Illustrative concept | Meaning | Compatibility question |
|---|---|---|
| historyMessageLimit | Recent eligible messages available for lexical matching | Existing scanDepth is not this value |
| maxRecursionPasses | Maximum additional/total recursive sweeps under a defined counting rule | Map old recursion behavior explicitly |
| recursionScope | Which books may emit/receive recursive triggers | Current any-book switch is not an accepted policy |
| includeParticipantNames | Whether named participants become matching input | Must use authorized session identities |
| policyVersion | Version of the interpretation and decision algorithm | Needed for old sessions and trace replay |

D01 chooses roles, message counting, regeneration, branch/edit/deletion semantics, and defaults. D02 chooses recursion scope and whether negative secondary conditions see only original input or the evolving recursive buffer. Set limits on passes, candidates, characters, and elapsed work; cycle detection alone is insufficient.

## Budgeting and selection

A proposed ceiling is:

~~~text
availableLore =
  min(conversationLoreLimit,
      modelInputLimit - baseRequest - protectedHistory - outputReserve)
~~~

All terms must use one compatible accounting unit or a labeled conservative fallback. Tool schemas, wrappers, placement text, and model-specific serialization belong in the full request calculation. Do not call whitespace estimates exact tokens.

D02 must decide whether each book's stored tokenBudget becomes a cap within the conversation ceiling, a preference, or a legacy-only setting. Summing every book's cap without a conversation ceiling is not sufficient.

A candidate ranking proposal, subject to review:

1. Explicit eligible session pins and mandatory continuity.
2. Direct relevant matches.
3. Permitted recursive/semantic matches.
4. Within each class: user priority, documented source precedence, then stable identity.

Insertion order controls rendering separately. If protected material cannot fit, return an actionable context-budget error or an explicitly accepted degraded mode. Do not silently truncate a fact away from its exception/reveal condition.

Trace every exclusion: disabled, permission, audience, no match, recursion limit, entry cap, book cap, conversation cap, invalid pattern, missing source, or unsupported placement.

## Resource contract boundaries

| Contract | Allowed authority | Required behavior |
|---|---|---|
| Source write | User-authored text and source metadata | Server recomputes hashes and preserves/invalidate extraction by source identity |
| Draft preview | Authorized unsaved fields plus owned source references | Server hydrates trusted derivatives; response identifies draft/base fingerprint |
| Linked attachment | Owned source identity | Resolves a saved revision under explicit freshness/permission rules |
| Snapshot creation | Authorized choice of source revision and reviewed local content, if supported | Server constructs and validates a complete immutable closure |
| Stored snapshot | Canonical source/entry/resource revisions needed for replay | Never consults current live source to fill missing historical facts silently |
| Native export | Explicit selected content/version scope | Versioned, bounded, lossless for the native model |
| External import | Untrusted external representation | Adapter returns conversion/loss/identity report; no execution authority |

D03 chooses whether snapshots may contain unsaved draft text. Whichever policy is chosen, client-provided extraction status, hashes, and provider/model claims must not become authoritative merely because they validate as strings.

Snapshot identity must distinguish attachment and source revision. Multiple attachments to one source may be deduplicated only after an explicit precedence policy. Preserve the author-visible reason and all contributing attachment paths.

## Matching and defaults

- Represent “inherit from book” explicitly or copy defaults at creation with documented override behavior.
- Preserve existing explicit entry choices during migration.
- Name primary-only any/all logic accurately; do not change persisted enum meaning solely to fix copy.
- Publish the six-mode truth table.
- Choose Unicode normalization, case folding, and boundary semantics in D05.
- Define a bounded common regex contract. Server validation is authoritative; local preview is explanatory.
- New resource-generated candidates should inherit an explicit policy rather than silently hardcoding unrelated flags.
- Disabled, stale, missing, or malformed sources have explainable handling.

## Disclosure and trust

D06 separates activation from what an actor may know:

- A key, constant flag, pin, or recursion hit establishes relevance only.
- A reveal/audience decision establishes eligibility for the target narrator/character/player.
- A model seeing private reference material is not proof that it will never reveal it.
- Structured reveal state, if adopted, belongs to the session/branch timeline.
- Imported source content and generated summaries retain source provenance and trust classification.
- Author-approved behavioral rules may need different treatment from third-party reference facts.
- Delimiters and lower-authority message placement mitigate confusion but are not a complete prompt-injection defense.

The initial implementation can be narrow. Do not imply narrative condition understanding from a literal phrase field.

## Editing and concurrency

D04 should select a book revision or canonical content stamp:

1. Load a base revision and retain the local draft separately.
2. Submit the expected revision and a stable operation identity where retry can otherwise duplicate work.
3. Lock and compare inside the server transaction.
4. Reject a stale base with conflict information.
5. Preserve the local draft and expose comparison/reload/save-as-copy as appropriate.
6. Merge resource-only responses without replacing unrelated local fields.
7. Apply a save response only to the generation of edits it acknowledged.
8. Maintain account/workspace late-result protections.

A successful save needs an explicit acknowledged state; “has an ID” is not the same as “all current edits are saved.”

## Effective lore and trace

A proposed effective-context projection includes:

- Conversation identity, workspace, policy version, and source input fingerprint.
- Resolved global/card/template/session paths and attachment mode.
- Source revision and snapshot identity.
- Candidate decisions with stable reason codes, matched keys where authorized, retrieval provenance, and estimated/measured cost label.
- Rendered location and selected content identity/hash.
- Staleness, degraded mode, and source-fetch errors.
- Redaction appropriate to the viewer.

The turn trace describes the packet built for that turn. A studio preview should say which draft, messages, and target projection it used. Inline mention decoration remains a lexical navigation aid unless explicitly connected to actual decisions.

## Story Studio and persona use

D09 decides whether Story Studio remains pinned-copy only or offers an additional conditional mode. Preserve existing copies until a deliberate conversion is accepted. Explain fields lost in the conversion and decide audience restrictions independently.

Resolve persona attachment policy consistently across adventure, solo/group chat, and calls. Use stored session identities rather than current unrelated editor selections.

## Compatibility and migration constraints

- Version the changed interpretation, not just the JSON shape.
- Audit existing regex and reveal configurations before stricter validation.
- Offer a dry-run report for changed activation outcomes.
- Preserve source, snapshot, and operation identities needed by recovery/Story Studio references.
- Do not silently convert scanDepth into history depth, flatten shared resources, drop external fields, or rewrite secret policy.
- Preserve archive, owner, feature-grant, and workspace enforcement.
- Extend the existing BFF architecture; the frontend still talks to exactly one backend.
- New response DTOs need corresponding frontend parsers; do not normalize a summary DTO into a supposedly complete empty-entry book.
