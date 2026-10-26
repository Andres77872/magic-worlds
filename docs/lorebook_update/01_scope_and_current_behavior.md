# Scope and current behavior

## Review baseline

| Repository | Reviewed HEAD | Role |
|---|---|---|
| magic-worlds | 07d67b9a35d9b02c588b97cecbde36c08e78f0e6 | React frontend |
| magic-worlds-api | bac565069bee35fc4aa4df297d00b25bad1f9e4b | FastAPI BFF, persistence, activation, and generation context |

Review date: 2026-10-19, America/Mexico_City. The audit started with no tracked-file diffs in either repository and preserved existing untracked material. This directory is new documentation, not a remediation patch.

## Questions examined

- Can an author create, edit, save, attach, and reuse lore without losing content?
- Do controls for matching, history, priority, budget, placement, and secrecy have their stated effect?
- Do local previews, backend previews, session displays, and actual generation resolve the same information?
- Are embedded and shared resources portable into frozen snapshots?
- Are permissions, workspace boundaries, and asynchronous operations preserved?
- Can large books, multilingual text, or user regex cause disproportionate work?
- What changes when an entry is copied into Story Studio?
- Which improvements are supported by primary-source research, and which remain product hypotheses?

The review did not cover the rest of the product as a general security or UI audit. Full browser accessibility, database deployment, provider behavior, production load, and external-format conformance were not exercised.

## Current workflow map

~~~mermaid
flowchart TD
    A[Studio: draft, entries, settings] --> B[BFF lorebook CRUD]
    C[Embedded or shared resources] --> D[Source save and extraction execution]
    D --> E[Summaries and generated snippets]
    B --> F[Linked or snapshot attachments]
    E --> F
    F --> G[Backend target resolver]
    G --> H[Activation engine]
    U[Latest user input] --> H
    H --> I[One lorebook system-prompt fragment]
    I --> J[Roleplay, adventure, or call generation]
    A --> K[Local or backend preview]
    F --> L[Session attachment panel and inline matcher]
    A --> M[Copied Story Studio reference]
    M --> N[Scene reference context]
~~~

This diagram describes the inspected implementation. The preview, inline matcher, and Story Studio branches do not currently establish equivalence to the generation branch.

## Domain and transport

Books contain metadata, settings, manual entries, and attachments. Entries carry primary and secondary keys, matching flags, constant mode, a secret marker and reveal text, ordering, priority, placement, and an optional entry cap.

Resources are either embedded in metadata.resources or hydrated from shared library links in metadata.sharedResources. Source text, extraction metadata, hashes, and completion status have different ownership and validation requirements. Generated summaries and snippets become activation candidates after extraction completes.

All frontend calls use the apiService layer. Workspace-aware hooks bind reads and writes to the document/session workspace, and the BFF performs owner/application/workspace checks. Current temporary feature availability follows membership permissions; older Vite-flag descriptions are not authoritative.

Evidence: [domain types](../../src/shared/types/lorebook.types.ts), [wire serializers](../../src/infrastructure/api/lorebookWire.ts), [BFF routes](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebooks.py), [resource preparation](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_resources.py).

## Workflow coverage

| Workflow | Inspected behavior | Audit boundary |
|---|---|---|
| Studio authoring | Manual local draft, save, immediate entry deletion, shared-resource operations, assistant application | Source review; selected component tests |
| Resource ingestion | Text/Markdown, URL conversion path, PDF-to-Markdown, source save, extraction and recovery | Contracts reviewed; no external conversion or model call made |
| Attachments | Linked follows saved source; snapshot intends a frozen document | Serializer/validator probes; no live DB insert |
| Adventure generation | Session, template, world, character/persona, and global targets | Resolver and loader inspected |
| Character and group chat | Chat, cast character, and global targets | Persona is not added to lore targets here |
| Calls | Character-chat session, character, and global targets | Persona is not added to lore targets here |
| Activation test | Local draft engine or backend override preview | Not a full multi-target provider-context trace |
| Transcript/composer markers | Primary-key decoration over directly attached session entries | Does not prove entry activation or budget admission |
| Story Studio | Entry text copied into a scene-reference snapshot | Original conditional activation settings do not survive |

Resolver evidence: [adventure target assembly](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L572), [character targets](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L664), [call targets](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L808).

## Important current semantics

These are observations, not the proposed contract:

1. Live lore activation receives one message: the newest user input.
2. scanDepth controls recursive passes, not the recent-message window.
3. The first eligible book supplies one shared budget.
4. Any recursive book enables recursive evaluation across all candidate books.
5. Candidate admission happens before final prompt placement sorting.
6. Persisted manual entries are queried by insertion order, then priority, then creation time. A caller-supplied preview array can have a different order.
7. All placement variants are concatenated into one appended system fragment.
8. Constant mode exits matching before the reveal check.
9. Whole-word boundaries are ASCII-based.
10. Tokens are estimated from whitespace-separated words.
11. Runtime attachment resolution is broader than the session UI's direct-link lookup.
12. Story Studio uses copied reference semantics, not the live activation engine.

Evidence: [activation engine](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L459), [loader](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_loader.py#L180), [entry query ordering](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L15593).

## Existing strengths to preserve

- Owner/application/workspace scoping and validation of attachment targets.
- Transactional aggregate persistence, with scoped parent locks.
- Server-owned extraction hashes and execution receipts that support recovery.
- Guards against late results reaching another account or workspace.
- Archived-workspace read-only behavior.
- Assistant and Story Studio operations with content/revision checks.
- Controlled tests for activation options, resource freshness, and transport contracts.

These are source and controlled-test observations. They do not close the findings or establish live deployment readiness.

## Evidence classes

| Class | Meaning |
|---|---|
| R — reproduced | A local probe exercised the relevant behavior without a live service/provider |
| S — source-supported | The inspected control flow establishes the issue; the complete user journey was not reproduced |
| G — semantics/product gap | A capability or policy is absent or unclear; adoption requires a product decision |
| I — inferred risk | A plausible consequence requiring further model, environment, or load validation |

Use these classes in the [findings register](02_findings_register.md). Keep observed behavior separate from the proposed changes in [document 06](06_proposed_behavior_and_contracts.md).
