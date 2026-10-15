# Lorebook Research and Product Plan

**Reviewed 2026-10-14: WIP — default-disabled rollout; substantial implementation exists.** Both lorebook flags are false in `.env.example` and true locally; resource availability requires both flags. Source presence does not attest a deployed profile/provider/attachment flow. See [feature status](../FEATURE_STATUS.md) and **LORE-01** in [roadmap](../ROADMAP.md).

The current implementation ledger below supersedes the original “no types/routes/studio” claims. The remaining research, wire-type examples, proposed endpoints, phases and acceptance criteria are target design from the June baseline. They are not a current API specification; use the BFF routes and DTOs linked in the ledger. Vendor research retains its original dates and was not refreshed in this review.

## Purpose

A lorebook is a dynamic context system for AI roleplay. It stores world,
character, faction, item, rule, secret, scene, relationship, quest, and state
facts as entries, then injects only relevant entries into the model prompt when
the current chat context activates them.

For Magic Worlds, lorebooks should become a first-class library and studio
surface that can be attached to:

- Adventure templates.
- In-progress adventure sessions.
- Characters used in 1:1 chat.
- Worlds.
- Individual character chats.
- Optional global user defaults.

The product should not treat lorebooks as passive notes. The value is retrieval:
which lore activates, where it enters the prompt, how much context budget it
uses, and why it was selected.

## Research Baseline

AI RP products use several names for this concept: lorebook, world info, memory
book, or character book. Across SillyTavern, NovelAI, Chub, and Character Card
V2, the common model is:

- A lorebook contains entries.
- Entries have activation keys or rules.
- Matching keys in recent conversation insert the entry content into context.
- Titles, comments, and organizer fields are usually not shown to the AI.
- Token budget, scan depth, insertion order, and insertion position matter.
- Character-specific, chat-specific, and global lore sources can stack.

Research sources:

- SillyTavern World Info: https://docs.sillytavern.app/usage/core-concepts/worldinfo/
- SillyTavern implementation: https://github.com/SillyTavern/SillyTavern/blob/51ad27fb86d39a3daca3adaa970375c9670c12df/public/scripts/world-info.js
- NovelAI Lorebook: https://docs.novelai.net/en/text/lorebook/
- Chub AI Lorebooks: https://docs.chub.ai/docs/advanced-setups/lorebooks
- Character Card V2 spec: https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md
- AgnAI README: https://github.com/agnaistic/agnai
- NN/g Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Material Design Steppers: https://m1.material.io/components/steppers.html
- Microsoft HAX Guidelines: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/

Reviewed against external sources on June 11, 2026.

## External Validation Review

The mature products do not treat lorebooks as a static wiki. They treat them as
prompt retrieval systems with explicit activation, ordering, budget, and scope
rules. The strongest evidence comes from SillyTavern because both its user docs
and `world-info.js` implementation expose the same concepts: source stacking,
scan buffers, primary and secondary keys, regex matching, recursion, timed
effects, token budgeting, insertion positions, and activation events.

NovelAI validates the same pattern from a writing-tool angle. It exposes
activation keys, always-on entries, hidden entries, entry generation, search
range, key-relative insertion, cascading activation, token budgets, reserved
tokens, insertion order, categories, phrase bias, and advanced conditions.
Chub validates a simpler product surface: keywords, secondary keywords, scan
depth, token budget, recursive scanning, and case-insensitive whole-word
matching. Character Card V2 validates the portable interchange layer: a
`character_book` with `scan_depth`, `token_budget`, `recursive_scanning`,
entries, keys, secondary keys, constant entries, insertion order, position, and
extension preservation. AgnAI's public README gives weaker but useful market
evidence: it lists "Memory/Lore books" as a core feature and separately lists
long-term memory, which supports keeping lorebook retrieval distinct from
summarized memory.

### Feature Adoption Matrix

| Capability | SillyTavern | NovelAI | Chub | Character Card V2 | Magic Worlds recommendation |
| --- | --- | --- | --- | --- | --- |
| Entry content injected into prompt | Core | Core | Core | Core schema | MVP |
| Entry title/comment not inserted | Core | Core | Core | Core schema | MVP |
| Primary activation keys | Core | Core | Core | Core schema | MVP |
| Secondary keys or conditions | Core | Composite keys and advanced conditions | Core | Core schema | MVP after primary keys |
| Case-insensitive matching | Core setting | Core default | Core default | Optional field | MVP |
| Whole-word matching | Core setting | Not emphasized | Core default | Extension-only | MVP default on |
| Regex keys | Core advanced | Core advanced | Not emphasized | Extension-only | Advanced collapsed field |
| Always-on/constant entries | Core | Core | Not emphasized | Core schema | MVP |
| Scan depth/search range | Core | Core | Core | Core schema | MVP |
| Token budget | Core | Core | Core | Core schema | MVP |
| Reserved token budget | Not primary | Core | Not emphasized | Extension-only | Advanced later |
| Insertion order | Core | Core | Core concept | Core schema | MVP |
| Insertion position | Core and advanced | Core and advanced | Not emphasized | Before/after only | MVP simple, advanced later |
| Recursion/cascading activation | Core advanced | Core advanced | Core setting | Core schema | Phase 5 |
| Source stacking | Global, character, persona, chat | Story scoped | Characterbooks | Character book stacks with world book | MVP attachments |
| Hidden/secret entries | UI feature | Core hidden entries | Not emphasized | Extension-only | MVP secret flag, reveal workflow later |
| Import/export | Core ecosystem behavior | JSON, `.lorebook`, PNG embed | Creator/export ecosystem | Portable card schema | MVP native JSON, Phase 5 Character Card V2 |
| AI lore generation | Not the core evidence | Core generator | Not emphasized | Out of scope | MVP staged drafts |
| Semantic/vector retrieval | Optional extension | Not the base pattern | Not emphasized | Out of scope | Later only |
| Timed effects/probability/groups | Core advanced | Advanced conditions/random chance | Not emphasized | Extension-only | Phase 5 |

### What Is Working In Other Projects

- Deterministic keyword activation is the proven base. Every reviewed product
  uses keys before anything more complex. This is the right MVP because users
  can predict and debug it.
- Entry content must stand alone. SillyTavern and NovelAI both warn that entry
  titles or keys are not prompt content. Magic Worlds should validate that an
  entry's subject appears in its content.
- Scan depth and token budget are mandatory guardrails. Without both, lorebooks
  become accidental always-on prompt bloat.
- Scoped attachment matters. SillyTavern supports global, character, persona,
  and chat lore. Character Card V2 expects character lorebooks to stack with
  user world books. Magic Worlds should support character, world, adventure
  template, adventure session, character chat, and global scopes from the start,
  even if some scopes are UI-only in early phases.
- Advanced placement is useful but dangerous. NovelAI and SillyTavern expose
  deep placement controls, but both frame them as advanced. Magic Worlds should
  ship simple insertion positions first and hide depth/outlet/reserved-token
  controls under advanced disclosure.
- AI generation is useful only when reviewable. NovelAI validates lore
  generation as a product feature, but Magic Worlds should combine it with
  staged drafts, source references, activation preview, and validation issues.
- Import/export creates ecosystem value. Character Card V2 is the most important
  compatibility target because character books travel with character cards.
  Native Magic Worlds JSON should preserve richer fields and adapter metadata.

### Where Existing Projects Disagree

- Insertion order semantics differ. SillyTavern describes larger order values as
  closer to the end of context; Character Card V2 says lower insertion order is
  inserted higher; NovelAI orders entries before context construction and gives
  higher insertion order earlier reservation/insertion priority. Magic Worlds
  must define its own semantics and losslessly map external values on import.
- Budget semantics differ. Some systems use a percentage of context, some use
  token counts, and NovelAI has reserved tokens. Magic Worlds should store
  integer token budgets internally and treat percentages as import/export
  adapter concerns.
- Whole-word defaults are not universal. Chub says whole-word matching is the
  default; SillyTavern exposes it as a setting; Character Card V2 has no
  stored whole-word field. Magic Worlds should default to whole-word matching
  for safety and preserve external whole-word behavior in metadata when needed.
- Regex is powerful but easy to misuse. It should exist because SillyTavern and
  NovelAI users expect it, but it should be collapsed, validated, and excluded
  from the first happy path.
- Semantic/vector retrieval is not a replacement for keyword activation.
  SillyTavern's docs explicitly position vector matching as less predictable
  than keyword matching. Magic Worlds should add semantic matches only after
  deterministic traces and budget trimming are already stable.

### Deep Implementation Implications

The SillyTavern implementation shows why this should not be a frontend-only
feature. It builds scan buffers from recent chat plus optional persona,
character, scenario, and creator-note text; tracks scan states for initial,
recursive, and minimum-activation passes; applies case and whole-word matching;
handles regex keys; stores active timed effects in chat metadata; and emits an
activation event after prompt construction. Magic Worlds has the same boundary:
the frontend can edit and preview lorebooks, but the backend owns prompt
assembly for adventure and character-chat WebSockets.

For Magic Worlds, the immediate design target should be a deterministic
keyword engine with an explainable trace:

1. Resolve active lorebooks from scope attachments.
2. Build a scan buffer from recent user/assistant turns, including speaker names
   when that helps name-based activation.
3. Optionally append non-chat matching sources such as character description,
   world description, adventure scenario, and card triggers.
4. Evaluate enabled constant entries.
5. Evaluate primary keys with case, whole-word, and optional regex settings.
6. Evaluate secondary keys and mode/target filters.
7. Sort by source precedence, insertion position, insertion order, then
   priority.
8. Estimate tokens with the same tokenizer used for prompt assembly.
9. Trim or skip entries with stable skipped reasons.
10. Insert prompt content and persist the trace for preview/debug UI.

The trace is not optional. It is what makes the feature debuggable and turns
"AI ignored my lore" into visible causes like no key match, budget overflow,
disabled source, hidden secret, cooldown, probability, or duplicate suppression.

## Product Thesis

The most valuable integration is an activation-tested AI lorebook builder:

1. Generate or extract candidate entries from existing Magic Worlds data.
2. Stage AI entries as drafts, never silently apply them.
3. Validate keys, scope, secrets, token cost, and conflicts.
4. Preview which entries activate from sample adventure/chat text.
5. Attach the book to the correct targets.

This creates value beyond "AI writes lore" because it answers the hard product
question: "Will this lore actually appear when the story needs it, without
wasting context?"

## Current implementation and gaps (2026-10-14)

| Capability | Actual source status | Gap / acceptance |
| --- | --- | --- |
| Domain and authoring | Shared lorebook types, gallery, studio, entry editor, attachments and API CRUD exist | Default-off rollout; qualify save/CAS/read-only behavior in matching deployment |
| Keyword activation | Backend supports primary/secondary keys, logical modes, constant entries, regex/case/whole-word settings, recursion and reveal matching | Secret reveal is deterministic text matching, not a narrative authorization/AI adjudication guarantee |
| Activation preview/trace | Studio panel and `/lorebooks/activation-preview`, validation, match reasons and estimated budget exist | `estimate_tokens` uses whitespace count ×1.35; it is not model-specific tokenizer accounting. Preview is not proof of the final provider prompt |
| Runtime insertion | `lorebook_loader.py` loads scoped attached/global books and constructs prompt fragments/metadata in the backend | Verify ordering, budgets and snapshot/linked behavior for each real conversation graph |
| Resources | Shared/embedded text resources, resource gallery/picker, PDF import and metadata extraction/reconciliation exist | PDF/extraction runtime config and profiles still gate execution; verify retry/credentials/workspace lifecycle |
| Assistant | Shared assistant core supports `lorebook` with BFF handler and CAS target writes | Requested turns may commit the target and apply it at final without a separate accept step; reopened/reloaded targets have a distinct apply-to-form state. Registry can disable the kind independently |
| Session isolation | Workspace-bound API hooks, scoped loader and archived-workspace read-only guards exist | Populated migration and cross-workspace/target retention need environment acceptance |
| Portability | No Character Card V2 adapter or general lorebook JSON import/export UI/route found in current sources | **WIP planned**; PDF/text-resource import is not portable lorebook interchange |
| Advanced retrieval/policy | Deterministic activation exists | Semantic/vector retrieval, timed/group/probability policies and narrative secret adjudication remain **WIP/TBD** |

Source evidence:

- [Shared types](../../src/shared/types/lorebook.types.ts), [LorebookStudio](../../src/features/lorebook/components/LorebookStudio.tsx), [entry editor](../../src/features/lorebook/components/LoreEntryEditor.tsx), [preview](../../src/features/lorebook/components/ActivationPreviewPanel.tsx), [resource extraction](../../src/features/lorebook/hooks/useLorebookExtraction.ts).
- [BFF routes/DTOs](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebooks.py), [extraction routes](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebook_extraction.py), [activation service](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py), [loader](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_loader.py).
- Existing frontend tests in `src/features/lorebook` and backend activation/loader/routes/extraction tests provide controlled contract evidence; [review record](../REVIEW_2026-10-14.md) records fresh checks. No provider/database flow was executed in this review.

The frontend does not assemble the provider prompt by injecting arbitrary lore into WebSocket messages. Backend-owned activation is already implemented. Character and adventure sessions use stored scoped conversation/snapshot contracts, not an assumed live-card-only history cache.

## Lorebook roadmap — WIP

| ID / priority | Remaining work | Closure / TBD |
| --- | --- | --- |
| LORE-R1 / P1 | Release/attachment/activation matrix with flags off/on, linked/snapshot, global/session scope, archive and cross-workspace targets | Dated matching frontend/BFF/schema smoke; no cross-owner scope or silent snapshot changes |
| LORE-R2 / P1 | Accurate budget/trace contract | Decide model-aware token accounting vs labeled estimates; compare trace with actual constructed prompt. Policy **TBD** |
| LORE-R3 / P1 | PDF/extraction/assistant lifecycle | Profile unavailable, credentials reentry, retry, canceled/late result, CAS rejection and resource deletion do not duplicate or overwrite content |
| LORE-R4 / P2 | Portable import/export | Supported formats, extension preservation and loss report **TBD**; explicit source/round-trip fixtures |
| LORE-R5 / P2 | Expanded retrieval/reveal semantics | Product scope **TBD**; do not promise semantic retrieval or secret access control from keyword matching |

Responsible areas are lore frontend/backend and LLM/operations for execution gates. Named owners and dates are **TBD**. The product design below retains the original rationale and target scope.

### Product Fit Decision Record

1. **Backend activation first.** A frontend-only lorebook would be cosmetic
   because prompt assembly is backend-owned.
2. **Use `triggers` as migration input, not the final model.** Card triggers are
   a shallow key list. Lorebook entries need content, keys, scope, placement,
   priority, and validation.
3. **Support linked and snapshot attachments.** Library cards can use linked
   lorebooks. In-progress adventure sessions should default to snapshots so an
   old session does not silently change when the library lorebook is edited.
4. **Ship deterministic keyword retrieval before semantic retrieval.** This is
   the common working base across the reviewed tools and gives clear previews.
5. **Make import/export adapter-driven.** Store a Magic Worlds superset
   internally, then map to Character Card V2 and future SillyTavern/NovelAI
   formats with explicit loss reports.
6. **Treat AI as a drafting tool.** AI may extract, generate, rewrite, and audit,
   but user review and activation preview are required before applying changes.

## Core Data Concepts

### Lorebook

A named collection of entries and activation defaults.

Recommended properties:

- `id`: Stable identifier.
- `name`: User-facing title.
- `description`: User-facing summary, not inserted by default.
- `enabled`: Whether the book can activate.
- `tags`: UI tags for search and organization.
- `source`: `manual`, `ai_generated`, `imported`, or `system`.
- `visibility`: `private`, `shared`, or future marketplace status.
- `settings`: Default activation settings.
- `entries`: Lorebook entries.
- `createdAt`, `updatedAt`.

Recommended settings:

- `scanDepth`: Number of recent messages to scan.
- `tokenBudget`: Maximum tokens this book may inject.
- `maxActivatedEntries`: Optional cap before token trimming.
- `includeSpeakerNames`: Whether role/name prefixes are part of the scan text.
- `matchingSources`: Non-chat sources to scan, such as character description,
  world description, adventure scenario, persona, or existing card triggers.
- `recursiveScanning`: Whether activated entry content can trigger more entries.
- `maxRecursionSteps`: Safety cap for recursive activation.
- `caseSensitive`: Default key matching behavior.
- `matchWholeWords`: Avoids false positives like `king` matching `liking`.
- `insertionStrategy`: How this book stacks with other active books.
- `defaultInsertionPosition`: Prompt section for new entries.
- `overflowPolicy`: `skip_low_priority`, `trim_entries`, or `error_preview_only`.
- `adapterMetadata`: Original import source, format version, field mappings, and
  warnings needed for round-trip export.

### Lorebook Entry

An atomic piece of lore. Entry content must be understandable on its own because
many systems do not insert the title or keys into prompt context.

Recommended properties:

- `id`: Stable identifier.
- `lorebookId`: Parent book.
- `title`: Editor label, not prompt content.
- `content`: Exact prompt text injected when active.
- `enabled`: Entry-level toggle.
- `type`: `character`, `location`, `faction`, `item`, `event`, `rule`,
  `relationship`, `secret`, `quest`, `style`, `mechanic`, or `state`.
- `aliases`: Display aliases for search and key suggestions, not inserted by
  default.
- `keys`: Primary activation keys.
- `secondaryKeys`: Optional filter keys.
- `selectiveLogic`: `and_any`, `and_all`, `not_any`, or `not_all`.
- `caseSensitive`: Entry override.
- `matchWholeWords`: Entry override.
- `keyMatchMode`: `plain`, `regex`, or `mixed`.
- `constant`: Always insert if budget allows.
- `probability`: Percent chance after activation.
- `priority`: Removal priority when budget overflows.
- `insertionOrder`: Sort order for activated entries.
- `insertionPosition`: `before_character`, `after_character`,
  `authors_note_top`, `authors_note_bottom`, `depth`, `system`, `user`,
  `assistant`, or `outlet`.
- `tokenBudget`: Optional entry budget.
- `reservedTokens`: Optional reservation before prompt assembly.
- `recursivePolicy`: `normal`, `non_recursable`, `prevent_further_recursion`,
  or `delay_until_recursion`.
- `inclusionGroups`: Mutually exclusive groups.
- `groupWeight`: Random weighted choice support.
- `modeFilters`: `adventure`, `character_chat`, `continue`, `regenerate`,
  `background`, etc.
- `targetFilters`: Character, world, adventure, persona, or tag filters.
- `timedEffects`: `stickyMessages`, `cooldownMessages`, `delayMessages`.
- `isSecret`: Hide from players unless revealed.
- `spoilerState`: `visible`, `hidden`, or `revealed`.
- `revealCondition`: User-facing rule for when a secret is allowed to appear.
- `sourceRefs`: Structured pointers to source cards, transcript turns, imported
  files, or assistant generations.
- `metadata`: Namespaced future extension object.

### Lorebook Attachment

An attachment says where a lorebook applies.

```ts
export type LorebookTargetKind =
    | 'global'
    | 'character'
    | 'world'
    | 'adventure_template'
    | 'adventure_session'
    | 'character_chat'

export interface LorebookAttachment {
    id: string
    lorebookId: string
    targetKind: LorebookTargetKind
    targetId?: string
    enabled: boolean
    precedence: number
    mode?: 'linked' | 'snapshot'
    createdAt?: string
    updatedAt?: string
}
```

Use `linked` for library-level attachments that should follow later edits. Use
`snapshot` for in-progress adventures where the session needs stable lore even
if the original library book changes later.

### Activation Result

The backend should return an explainable activation trace for previews and
debugging.

```ts
export interface LoreActivationResult {
    entryId: string
    lorebookId: string
    title: string
    reason: 'constant' | 'primary_key' | 'secondary_key' | 'recursive' | 'semantic' | 'sticky'
    matchedKeys: string[]
    scannedSources: Array<'messages' | 'character' | 'world' | 'adventure' | 'persona' | 'triggers'>
    sourceTargetKind: LorebookTargetKind
    sourceTargetId?: string
    sourcePrecedence: number
    insertionPosition: string
    insertionOrder: number
    estimatedTokens: number
    budgetBefore: number
    budgetAfter: number
    included: boolean
    skippedReason?: 'disabled' | 'budget' | 'probability' | 'filter' | 'cooldown' | 'mode' | 'duplicate'
    traceMessage?: string
}
```

### External Compatibility Model

Use a Magic Worlds-native model internally and explicit adapters externally.
Do not make Character Card V2, SillyTavern, or NovelAI formats the database
schema because their order, budget, and placement semantics differ.

Native export should preserve all Magic Worlds fields. Compatibility exports
should include a loss report:

```ts
export interface LorebookImportExportReport {
    format: 'magic_worlds' | 'character_card_v2' | 'sillytavern_world_info' | 'novelai_lorebook'
    direction: 'import' | 'export'
    warnings: Array<{
        severity: 'info' | 'warning' | 'error'
        code: string
        message: string
        entryId?: string
        externalPath?: string
    }>
    unsupportedFields: string[]
    preservedExtensions: Record<string, unknown>
}
```

Character Card V2 mapping:

- `character_book.name` -> `Lorebook.name`.
- `description` -> `Lorebook.description`.
- `scan_depth` -> `settings.scanDepth`.
- `token_budget` -> `settings.tokenBudget`.
- `recursive_scanning` -> `settings.recursiveScanning`.
- `entries[].keys` -> `LorebookEntry.keys`.
- `entries[].content` -> `LorebookEntry.content`.
- `entries[].enabled` -> `LorebookEntry.enabled`.
- `entries[].insertion_order` -> `LorebookEntry.insertionOrder`, with adapter
  metadata because ordering semantics differ across systems.
- `entries[].case_sensitive` -> `LorebookEntry.caseSensitive`.
- `entries[].priority` -> `LorebookEntry.priority`.
- `entries[].comment` or `entries[].name` -> `LorebookEntry.title`.
- `entries[].selective` and `entries[].secondary_keys` ->
  `LorebookEntry.secondaryKeys` plus `selectiveLogic = and_any`.
- `entries[].constant` -> `LorebookEntry.constant`.
- `entries[].position` -> `before_character` or `after_character`.
- `extensions` on the book and entries -> namespaced `metadata`, preserved even
  when Magic Worlds does not understand the fields.

Import rules:

- Never discard unknown extension data.
- Normalize obvious invalid fields, but keep a warning.
- Preserve the original external IDs when present.
- Record order and position conversion decisions.
- Mark imported regex or advanced fields as advanced UI fields.
- If a field cannot be represented, store it in metadata and report it.

## What Makes an Enriched Lorebook

An enriched lorebook is not a wiki dump. It is a prompt retrieval database built
for model behavior.

Good entries are:

- Standalone: the AI can understand the entry without seeing the title.
- Short: usually one to three dense paragraphs.
- Specific: concrete names, limits, relationships, consequences, and cues.
- Stable: stored facts, not recent chat summaries unless the entry is state.
- Triggerable: keys include aliases, titles, nicknames, places, artifacts, and
  phrase variants.
- Scoped: entries define when they apply, especially secrets and rare events.
- Non-conflicting: one source of truth for a fact, with clear precedence.

Example character entry:

```text
Mira Vale is a deserter from the Sun Guard. She distrusts official soldiers,
keeps her left hand gloved to hide a branded oath mark, and speaks in short,
guarded answers until someone proves they protect civilians.
```

Example location entry:

```text
The Glass Market is a night bazaar built under mirrored canopies. Spoken
bargains are binding there; breaking one makes the offender's reflection act
independently for one day.
```

Example rule entry:

```text
Moonsteel harms spirits only while it reflects direct moonlight. Indoors or
under cloud cover, it behaves like ordinary polished steel.
```

Example secret entry:

```text
Secret: Lord Cael did not murder the queen. The assassin was his daughter Elian,
who staged the crime to prevent the queen from opening the sealed star gate.
Reveal this only if the player finds Elian's silver confession ring or confronts
her with the broken gate key.
```

Quality checks the app should surface:

- Missing activation keys.
- Overbroad one-word keys.
- Duplicate keys across entries.
- Entries over budget.
- Secret entries with obvious public keys.
- Entries whose title appears nowhere in content.
- Conflicting facts about the same entity.
- Orphan lorebooks not attached anywhere.

### Deep Quality Heuristics

Use deterministic checks first, then AI review for semantic judgment.

Deterministic checks:

- Empty content.
- Content below a minimum useful length.
- Content above configured token target.
- Entry title missing from content for named entities.
- No keys on a non-constant entry.
- One-character keys.
- Common stop-word keys.
- One-word keys with whole-word matching disabled.
- Duplicate key in the same book.
- Duplicate key across active books with equal precedence.
- Regex key that fails to compile.
- Regex key that matches an empty string.
- Secondary keys set without a primary key.
- Secret entry without a reveal condition.
- Constant entry that is too long.
- Entry has no reachable attachment path.
- Entry target filter excludes every current target.

AI-assisted checks:

- Contradiction with another entry.
- Vague content that does not change model behavior.
- Content that belongs in a character card instead of lore.
- Content that should be split into multiple entries.
- Secret entry that leaks through public wording.
- Broad key that is likely to trigger in unrelated scenes.
- Missing aliases or title variants.
- Entry that should be state/session lore instead of stored world lore.

Activation preview should turn these checks into user-facing evidence. A user
should be able to paste a sample message and see exactly which entries matched,
which entries were skipped, why they were skipped, how many tokens were used,
and where the content would be inserted.

### Entry Design Rubric

Use this rubric for AI generation, review UI, and docs:

| Rating | Content | Keys | Scope | Budget | Risk |
| --- | --- | --- | --- | --- | --- |
| Good | Standalone, concrete, behavior-shaping | Specific names and aliases | Clear target and reveal rules | 50-160 tokens | Low accidental activation |
| Needs review | Understandable but vague or long | Missing aliases or one broad key | Scope implied, not explicit | 160-300 tokens | May over-trigger |
| Bad | Wiki dump, contradiction, or title-only context | Missing, stop words, invalid regex | No clear target | 300+ tokens | Leaks secrets or wastes context |

## Creator Experience

### Product Shape

The best product shape is not a pure linear wizard. Lorebooks are
interdependent: entries reference each other, keys can collide, priorities affect
activation, and one book may be attached to many targets.

Use a short wizard only to bootstrap a book, then land the user in a Lorebook
Studio workbench where they can edit, test, and attach it.

### Lorebook Studio

Recommended layout:

- Left rail: lorebooks, filters, attached targets, import/export.
- Main pane: entries table or grouped list.
- Right pane/drawer: selected entry editor.
- Bottom or side panel: activation preview and issue list.
- Floating AI assistant: draft entries, rewrite entries, suggest keys, audit the
  book, or apply structured changes.

Primary views:

- `Entries`: table/list, bulk actions, filters.
- `Map`: grouped by character, faction, place, item, rule, secret, quest.
- `Test`: activation preview against sample chat/adventure text.
- `Attach`: characters/worlds/adventures/chats where this book is used.
- `Settings`: scan depth, budget, recursion, matching defaults.

### New Lorebook Wizard

Keep it short and skippable.

Step 1: Purpose

- Book name.
- Intended use: adventure, character chat, world, character, global.
- Tone/genre.
- Complexity: simple, standard, advanced.
- Default target to attach to, if launched from a character/world/adventure.

Step 2: Source

- Blank book.
- Existing character cards.
- Existing world cards.
- Adventure template.
- In-progress adventure snapshot.
- Recent chat transcript.
- Imported text/JSON.

Step 3: AI Plan

- User chooses generation strategy:
  - Extract stored facts.
  - Expand thin cards into rich lore.
  - Build a setting bible.
  - Build character/private secrets.
  - Build quest/faction/location structure.
- User chooses entry types to create.
- User sets max entries and target token size.

Step 4: Draft

- AI returns structured drafts with entries, keys, types, scopes, warnings, and
  confidence.
- User can regenerate all, regenerate selected entries, or continue manually.

Step 5: Review

- Show issue checks before saving:
  - Missing keys.
  - Overbroad keys.
  - Duplicate keys.
  - Long entries.
  - Secret entries with public/common triggers.
  - Likely contradictions.
  - No attachment target.

Step 6: Attach and Test

- Attach as linked or snapshot.
- Run activation preview with sample user messages.
- Save and open in Lorebook Studio.

### Entry Editor

Use progressive disclosure.

Default fields:

- Enabled toggle.
- Title.
- Type.
- Content.
- Keys.
- Secret toggle.
- Token estimate.

Secondary fields hidden under `Activation`:

- Secondary keys.
- Selective logic.
- Case sensitivity.
- Match whole words.
- Regex mode.
- Constant entry.

Advanced fields hidden under `Prompt Placement`:

- Insertion order.
- Priority.
- Insertion position.
- Token budget.
- Reserved tokens.
- Recursion policy.
- Probability.
- Inclusion group.
- Timed effects.
- Mode and target filters.

## AI-Assisted Capabilities

The AI should be available as tools, not a mandatory funnel.

### Generate Book From Prompt

Input:

- Short concept.
- Genre/tone.
- Target use.
- Desired entry types.
- Entry count.
- Max tokens per entry.

Output:

- Lorebook metadata.
- Draft entries.
- Suggested attachments.
- Validation issues.

### Extract From Existing Cards

Use existing `Character`, `World`, `Adventure`, and `AdventureSnapshot` data:

- Character names, aliases, descriptions, greetings, roleplay directions.
- World names, types, descriptions, details.
- Adventure scenario, objectives/components, cast, persona, world.
- Existing triggers as candidate keys.

Output should split lore into entries instead of generating one giant summary.

### Extract From Chat

Useful for in-progress adventures:

- Turn key discoveries into state entries.
- Extract changed relationships.
- Capture promises, clues, unresolved quests, named locations, inventory,
  faction reactions, and secrets revealed.
- Mark these as `state` or `session` entries, not stored world facts.

### Suggest Keys

For selected entries:

- Names.
- Aliases.
- Titles.
- Places.
- Acronyms.
- Common misspellings.
- Short phrases.
- Regex only when needed.

The AI should warn about broad keys like `king`, `magic`, `dark`, or `city`,
especially when whole-word matching is off.

### Rewrite For Budget

Tools:

- Compress entry to 50/100/200 tokens.
- Expand entry with sensory detail.
- Convert prose to compact stored fact style.
- Split long entry into multiple typed entries.
- Remove duplicate facts.

### Audit Lorebook

AI and deterministic checks should produce an issue list:

- Entry does not mention its own title/name.
- Title/key mismatch.
- Content too vague.
- Contradiction with another entry.
- Secret can activate too easily.
- Missing reveal condition.
- Entry should be constant or should not be constant.
- Entry probably belongs in another book.

### Activation Simulator

User enters sample text:

```text
I ask Mira about the Glass Market and show her the silver confession ring.
```

The simulator shows:

- Activated entries.
- Matched keys.
- Skipped entries and reasons.
- Token cost.
- Insert order.
- Prompt preview.

This should call the backend activation engine, not a frontend-only imitation.

## AI UX Rules

AI output must be staged as drafts.

Recommended behavior:

- Never overwrite an existing lorebook without a visible diff.
- Batch AI-created entries into a review queue.
- Let users accept all, accept selected, edit selected, or discard all.
- Preserve original manual entries.
- Show why each entry was generated: source card, transcript line, user prompt,
  or related entry.
- Show validation issues before save.
- Keep generation history for the current session.

This matches the app's existing `AssistantChatbot` pattern: the assistant
can stage a saved card snapshot, and the user explicitly applies it to the form.
Lorebook AI should use the same mental model.

## Magic Worlds Integration

### Frontend Files

Likely frontend areas:

- `src/shared/types/ui.types.ts`: add lorebook pages.
- `src/shared/types/lorebook.types.ts`: add lorebook domain types.
- `src/app/router/AppRouter.tsx`: add the lorebook view route.
- `src/ui/components/Sidebar.tsx`: add a library nav item.
- `src/app/providers/DataProvider.tsx`: load and expose lorebooks.
- `src/infrastructure/api/index.ts`: add lorebook CRUD and attachment methods.
- `src/shared/types/aiCard.types.ts`: extend API response types with lorebook
  attachment metadata if the backend returns it on cards.
- `src/features/creation/*`: add attachment sections to character, world, and
  adventure editors.
- `src/features/interaction/components/InteractionLeftPanel.tsx`: show/edit
  session lorebook attachments for active adventures.
- `src/features/characterChat/components/CharacterChatSidebar.tsx`: show
  character/chat lore attachments.

### New Modules

Suggested frontend modules:

- `src/features/lorebook/components/LorebookStudio.tsx`
- `src/features/lorebook/components/LorebookWizard.tsx`
- `src/features/lorebook/components/LoreEntryEditor.tsx`
- `src/features/lorebook/components/LoreEntryTable.tsx`
- `src/features/lorebook/components/LorebookAttachPanel.tsx`
- `src/features/lorebook/components/ActivationPreviewPanel.tsx`
- `src/features/lorebook/components/LorebookIssueList.tsx`
- `src/features/lorebook/lorebookAssistantAdapter.ts` (the lorebook kind of
  the shared `AssistantChatbot`)
- `src/features/lorebook/hooks/useLorebooks.ts`
- `src/features/lorebook/hooks/useLorebookWizard.ts`

### Reuse Existing Patterns

Reuse or adapt:

- `CreatorStudio`: two-column editor with sticky preview.
- `StudioSectionNav`: compact section navigation.
- `TriggersField`: chip editor for activation terms.
- `AttributeManager`: structured editable grouped data.
- `AssistantChatbot`: floating assistant with conversation history,
  streaming, staged snapshots, retry, stop, and explicit apply.
- `AdventureSnapshot`: session-local copy of adventure cards that the chat AI
  reads.

The lorebook creator should feel like another creator surface, but denser and
more operational than a character/world form.

### Navigation

Add:

- `PageType`: `gallery-lorebooks`, `lorebook`.
- Sidebar item: `BookOpen`, label `Lorebooks`.
- Gallery card:
  - title,
  - description,
  - tags,
  - entry count,
  - enabled count,
  - attached targets,
  - last updated.

### Attachment UX

Add a compact `LorebookAttachPanel` to:

- Character Creator.
- World Creator.
- Adventure Creator.
- In-progress Adventure left panel.
- Character Chat sidebar.

The attach panel should answer:

- Which lorebooks are active here?
- Are they linked or snapshotted?
- What will happen when the original lorebook changes?
- Can the user test activation from this screen?

## Suggested Wizard Types

```ts
export type LorebookCreationSource =
    | 'blank'
    | 'prompt'
    | 'characters'
    | 'worlds'
    | 'adventure_template'
    | 'adventure_session'
    | 'character_chat'
    | 'import'

export type LoreEntryDraftStatus = 'draft' | 'accepted' | 'rejected' | 'needs_review'

export interface LorebookWizardState {
    name: string
    description?: string
    targetUse: Array<'adventure' | 'character_chat' | 'world' | 'character' | 'global'>
    source: LorebookCreationSource
    sourceIds: string[]
    aiEnabled: boolean
    generationGoal?: string
    entryTypes: string[]
    maxEntries: number
    maxTokensPerEntry: number
    draftEntries: LorebookEntryDraft[]
}

export interface LorebookEntryDraft {
    clientId: string
    title: string
    type: string
    content: string
    keys: string[]
    secondaryKeys?: string[]
    selectiveLogic?: 'and_any' | 'and_all' | 'not_any' | 'not_all'
    isSecret?: boolean
    revealCondition?: string
    insertionOrder?: number
    priority?: number
    sourceRefs?: Array<{ kind: string; id?: string; label?: string }>
    confidence?: number
    issues?: LorebookIssue[]
    status: LoreEntryDraftStatus
}

export interface LorebookIssue {
    severity: 'info' | 'warning' | 'error'
    code: string
    message: string
    entryClientId?: string
    fixAction?: string
}
```

## Proposed backend contract at the research baseline

### CRUD

- `GET /lorebooks?skip&limit&q`
- `POST /lorebooks`
- `GET /lorebooks/{id}`
- `PUT /lorebooks/{id}`
- `DELETE /lorebooks/{id}`
- `POST /lorebooks/{id}/entries`
- `PUT /lorebooks/{id}/entries/{entry_id}`
- `DELETE /lorebooks/{id}/entries/{entry_id}`

### Attachments

- `GET /lorebook-attachments?target_kind&target_id`
- `PUT /lorebook-attachments`
- `DELETE /lorebook-attachments/{id}`

### Import/Export

- `POST /lorebooks/import`
- `GET /lorebooks/{id}/export?format=magic_worlds|character_book_v2`

### AI Endpoints

Keep deterministic validation separate from AI generation.

- `POST /lorebooks/ai/draft`
- `POST /lorebooks/{id}/entries/ai`
- `POST /lorebooks/ai/extract`
- `POST /lorebooks/ai/rewrite-entry`
- `POST /lorebooks/ai/suggest-keys`
- `POST /lorebooks/ai/audit`

### Deterministic Validation and Preview

- `POST /lorebooks/validate`
- `POST /lorebooks/activation-preview`
- `GET /adventure-sessions/{id}/lore-activation/latest`
- `GET /character-chats/{id}/lore-activation/latest`

Preview request:

```ts
export interface LoreActivationPreviewRequest {
    targetKind: LorebookTargetKind
    targetId?: string
    mode: 'adventure' | 'character_chat' | 'continue' | 'regenerate' | 'background'
    messages: Array<{
        role: 'user' | 'assistant' | 'system'
        name?: string
        content: string
    }>
    includePromptPreview?: boolean
    overrides?: {
        lorebookIds?: string[]
        scanDepth?: number
        tokenBudget?: number
        includeDisabled?: boolean
    }
}

export interface LoreActivationPreviewResponse {
    targetKind: LorebookTargetKind
    targetId?: string
    activeAttachments: LorebookAttachment[]
    results: LoreActivationResult[]
    totalEstimatedTokens: number
    tokenBudget: number
    promptPreview?: string
    issues: LorebookIssue[]
}
```

Backend invariants:

- Preview and live chat generation must call the same activation engine.
- The engine must return stable skipped reasons for every entry considered.
- Token estimates must use the same tokenizer family as prompt assembly.
- Disabled lorebooks and entries must be visible in preview only when requested.
- Secret entries must not be returned to players unless the user has editor
  permission or the entry is revealed.
- Session snapshot attachments must not change when the source lorebook changes.
- Linked attachments must reflect the latest saved lorebook version.
- Import/export must preserve unknown extension data and report lossy mappings.

### Assistant-Style Option

- `POST /assistant/conversations` with `{kind: 'lorebook', lorebook_id?, title?}`
- `POST /assistant/conversations/{id}/messages/stream` with `{kind: 'lorebook', message, current?, expected_revision?, expected_content_hash?}`

The card, lorebook, and app assistants share one assistant system: the same
routes, keyed by `kind`. See `docs/app_assistant/README.md` for the contract.

### AI Draft Output Requirements

The LLM should return structured JSON, not prose, for mutating operations.

Required output:

- `lorebook`: name, description, settings.
- `entries`: draft entries.
- `attachments`: suggested targets.
- `issues`: warnings/errors.
- `summary`: short human-readable explanation.

The backend should validate and normalize JSON before returning it to the
client. The client should assume AI output can be incomplete or invalid and show
repairable draft state rather than crashing or applying partial data silently.

## Prompt Assembly Algorithm

Backend generation should follow this order:

1. Gather active lore sources:
   - Adventure session lore.
   - Chat-specific lore.
   - Character/persona lore.
   - World lore.
   - Adventure template lore.
   - Global user lore.
2. Build scan text from recent messages using each source's `scanDepth`.
3. Optionally include non-chat matching sources such as character description,
   world description, scenario, persona, and card triggers.
4. Activate constant entries first.
5. Match primary keys with case/whole-word/regex rules.
6. Apply secondary key logic and target/mode filters.
7. Apply probability, timed effects, cooldown, and delay.
8. Resolve inclusion groups.
9. Run recursive scans if enabled, capped by `maxRecursionSteps` and budget.
10. Optionally add semantic/vector matches as a later phase.
11. Sort by source precedence, insertion position, insertion order, and priority.
12. Estimate token cost, trim or skip entries by budget.
13. Insert content into prompt sections with provenance markers.
14. Save an activation trace for debug UI.

Recommended prompt wrapper:

```text
<lore source="World: The Shattered Isles" entry="Moonsteel rule">
Moonsteel harms spirits only while it reflects direct moonlight. Indoors or
under cloud cover, it behaves like ordinary polished steel.
</lore>
```

### Activation Engine Test Matrix

Minimum backend tests:

- Primary key activates an enabled entry.
- Case-insensitive matching activates across casing variants.
- Whole-word matching prevents `king` from matching `liking`.
- Multi-word phrase keys match normalized whitespace.
- Regex keys match only when valid and enabled.
- Invalid regex keys return validation errors.
- Secondary `and_any` activates when at least one secondary key is present.
- Secondary `and_all` activates only when every secondary key is present.
- Secondary `not_any` blocks activation when any forbidden key is present.
- Constant entries activate before keyword entries.
- Disabled entries are skipped with `disabled`.
- Mode filters skip entries outside the current generation mode.
- Target filters skip entries outside the active character/world/adventure.
- Duplicate entries are suppressed deterministically.
- Budget overflow skips lower-priority entries with `budget`.
- Source precedence is stable across global, character, world, adventure,
  session, and chat attachments.
- Session snapshot attachments are unaffected by later library edits.
- Linked attachments reflect later library edits.
- Recursive activation is capped when enabled.
- Timed effects are scoped to one chat/session when implemented.
- Preview and live chat generation produce the same activation trace for the
  same inputs.

Minimum import/export tests:

- Character Card V2 import maps core fields correctly.
- Character Card V2 export emits a valid `data.character_book`.
- Unknown `extensions` round-trip without deletion.
- Unsupported fields produce warnings, not silent loss.
- Insertion order conversion is recorded in adapter metadata.
- Secret metadata is preserved even if the export format does not understand it.

## Data Migration Strategy

Existing `triggers` can become the bridge:

- Keep card `triggers` as card-level activation hints.
- Add a generated default lore entry per card only if useful:
  - Character: name, race, description, categories, roleplay direction.
  - World: name, type, description, categories.
  - Adventure: scenario, objectives, attached cast/world.
- Do not delete or replace existing card triggers.
- Long term, let cards attach lorebooks rather than storing all lore directly on
  the card.

## User-Friendly Defaults

Default lorebook settings:

- `scanDepth`: 4 recent messages.
- `tokenBudget`: 800 tokens or a backend-selected safe default.
- `recursiveScanning`: off for new users.
- `caseSensitive`: false.
- `matchWholeWords`: true.
- `defaultInsertionPosition`: after character/adventure context.

Default entry settings:

- Enabled.
- Whole-word matching on.
- Case-insensitive.
- Priority normal.
- Insertion order normal.
- Not constant.
- No recursion.

AI generation defaults:

- 8 to 12 entries for a new book.
- 80 to 160 tokens per entry.
- Always include keys.
- Avoid regex unless asked.
- Mark secrets explicitly.
- Prefer precise phrases over common single words.

## Original implementation phases (not a completion ledger)

### Phase 1: Domain Model and Activation Preview

- Add shared lorebook, entry, attachment, validation issue, import/export report,
  and activation trace types.
- Add backend lorebook persistence and CRUD API.
- Add deterministic keyword activation engine.
- Add `POST /lorebooks/validate`.
- Add `POST /lorebooks/activation-preview`.
- Support scan depth, token budget, whole-word/case matching, constant entries,
  secondary key logic, source precedence, insertion order, and basic prompt
  positions.
- Add backend tests from the activation engine test matrix.

Phase 1 should prove that a sample message activates the same entries that live
chat generation would activate. Without this, a studio UI is only a note editor.

### Phase 2: Manual Studio and Attachments

- Add API client methods.
- Add `DataProvider` state for lorebooks or a dedicated `LorebookProvider`.
- Add authenticated lorebook gallery/editor route.
- Add manual entry create/edit/delete.
- Add attach panel for character, world, adventure template, adventure session,
  and character chat targets.
- Support linked attachments for library targets.
- Support snapshot attachments for in-progress adventure sessions.
- Add activation preview in the lorebook view and attach panels.

### Phase 3: AI Drafting and Validation

- New Lorebook Wizard with blank/manual source and AI prompt source.
- AI draft generation with staged review.
- AI extraction from character, world, adventure template, adventure session,
  and chat transcript sources.
- AI key suggestion, rewrite, split, compress, and audit tools.
- Source references for AI-generated entries.
- Visible diffs before applying AI changes.

### Phase 4: Live Chat Integration

- Inject activated lore into adventure-session generation.
- Inject activated lore into character-chat generation.
- Persist latest activation traces for adventure sessions and character chats.
- Add "active lore this turn" debug drawer to adventure and character chat.
- Add session-safe secret visibility behavior.

### Phase 5: Compatibility and Advanced Lore

- Import/export Character Card V2 character books.
- Native Magic Worlds import/export.
- SillyTavern/NovelAI import research spike.
- Recursive scanning.
- Inclusion groups.
- Timed effects.
- Secret/reveal workflow.
- Reserved tokens and advanced placement.
- Optional semantic/vector matching with deterministic keyword fallback.

## MVP Recommendation

The first release should support:

- Create lorebook.
- Create/edit/delete entries.
- Entry keys using the existing chip-editor pattern.
- Deterministic backend activation.
- Activation preview using the same backend logic as live chat generation.
- Activation trace with matched keys, skipped reasons, token cost, source
  precedence, and prompt position.
- Deterministic validation checks for keys, budgets, duplicates, and secrets.
- Optional simple AI generation from prompt or selected existing cards, staged as
  drafts if included in the MVP scope.
- Review queue for AI drafts if AI generation is included.
- Attach to adventure template, character, world, or character chat.
- Snapshot attachments for in-progress adventure sessions.
- Linked attachments for library cards.

Advanced controls should exist but stay collapsed by default:

- Regex.
- Recursion.
- Timed effects.
- Probability.
- Inclusion groups.
- Outlet/depth placement.

## Implementation Risks

- Prompt construction is backend-owned, so frontend-only implementation would be
  cosmetic unless backend activation is added.
- Too many always-on entries will degrade response quality and consume context.
- Broad keys can cause accidental activation.
- Secret entries can leak if their trigger keys are common.
- Recursive activation needs hard budget and recursion caps.
- In-progress adventures need a clear linked-vs-snapshot rule to avoid
  surprising lore changes mid-story.

## Acceptance Criteria

The lorebook feature should not be considered implemented until these are true:

- A backend activation preview and a live chat generation path call the same
  activation code.
- The activation trace explains included and skipped entries.
- Manual lorebook CRUD works for enabled entries, content, keys, order, priority,
  constant entries, token budget, and attachments.
- Validation catches missing keys, duplicate keys, broad keys, invalid regex,
  over-budget entries, and unrevealed secrets with public triggers.
- Character, world, adventure template, adventure session, character chat, and
  global attachment scopes are represented in the data model.
- In-progress adventure sessions can hold snapshot attachments.
- Library targets can hold linked attachments.
- Existing card `triggers` can be used to seed entry keys without deleting or
  replacing those triggers.
- AI-generated entries are staged, reviewable, and source-attributed before
  being applied.
- Character Card V2 import/export either works or is explicitly out of MVP with
  documented adapter requirements and tests.
- Tests cover the activation engine test matrix for MVP fields.

## Recommendation

Build the lorebook as a first-class library with attachable sources, AI-assisted
drafting, deterministic validation, backend activation, and activation preview.
Start with deterministic keyword retrieval and token budgeting because it is
explainable, validated by other AI RP tools, and matches existing Magic Worlds
card `triggers`. Add semantic retrieval only after activation trace, budgeting,
and source precedence are stable.
