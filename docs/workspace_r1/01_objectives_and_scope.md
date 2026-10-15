# Objectives and scope

> **Lifecycle: active R1 contract. Documentation reconciliation: 2026-10-15.** The foundation is implemented; rollout and specific integrity acceptance remain open. [02](02_current_status_and_findings.md) owns source/status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining work. Normative requirements below remain acceptance/regression contracts, not claims that every guarantee has runtime evidence. Dated implementation/validation records are in git history.

**Status:** Selected R1 scope; implemented in source, WIP rollout. See [current status](02_current_status_and_findings.md).\
**Refreshed:** 2026-10-12.

## Objective

Give the user a clear way to separate bodies of work, find related cards together, and reuse cards deliberately without mixing experimental and mature content.

The user wants to use this app for roleplay, novels, short stories, testing, and card creation. A collection such as a novel's cast should make its characters easy to find later in a roleplay picker. This feature concerns structure and card management; it does not require rebuilding the novel editor or automatically importing collections into novels.

## Terms and responsibilities

| Concept | Responsibility | Identity behavior |
|---|---|---|
| Account | Authentication, billing, personal credentials and global preferences | Existing authenticated user |
| Workspace | Separates a body of content and related activity | A card has one home workspace |
| Collection | Groups related cards within one workspace | Many collections may refer to the same card |
| Card | Existing character/persona, world, item, or adventure content | Existing globally unique card identity |
| Copy to workspace | Reuses content independently | New destination card ID and retained source lineage |
| Add to collection | Organizes existing content | Same card ID; no content copy |
| Story/session snapshot | Preserves selected content for an activity | Existing snapshot semantics |
| Export | Produces a portable file | Local workspace identifiers do not become portable authority |

A preferred workspace use may choose a default landing page. It must not lock a workspace into one feature or require different card schemas for writing and roleplay.

## R1 scope

| Library and organization | Required activity integration |
|---|---|
| Create, rename, switch, archive, and restore personal workspaces | Assign stories and all roleplay session kinds to a workspace |
| Flat collections with mixed supported card types | Isolate lorebooks, source resources, and assistant history |
| Unified library root with all card types and a local Only uncollected filter | Workspace-local default persona and global lorebook activation |
| Bulk add/remove collection membership | Workspace-origin labels and navigation for background jobs |
| Copy one or several cards to another workspace | Collection filters in Codex, cast, world, persona, and media pickers |
| Capture destinations for manual creation, AI generation, and imports | Restore the previous workspace and its library filters |

The approved library UX uses one sidebar entry, compact folder-style collections and cards together, persistent search, all supported card types, and a New menu leading to the existing creators/assistant. Existing card and gallery visual designs are retained. All cards is the root dataset; Only uncollected and type/persona are local filters, not extra sidebar entries. Collection folders are opened from the content browser, not a collection-chip navigation bar; see document 08.

R1 includes both columns: cards, lorebooks/resources, stories, adventure/character/group sessions, voice history through those sessions, and unified card/lorebook/app assistants all have a workspace. A library-only variant is not the selected release. Account/application billing, quotas, credentials, LLM/image profiles, voice presets, notification inbox, and playlist playback keep their existing boundaries; content notices/playback carry origin labels.

## Deferred capabilities

Human collaboration, invitations, shared ownership, real-time coauthoring, automatic cross-workspace synchronization, nested collections, rules-based collections, whole-workspace export bundles, permanent workspace deletion, and moving complete dependency graphs are separate extensions.

Existing public cards and share links remain supported. They are distribution mechanisms, not membership in a personal workspace.

## Product invariants

1. Organizing a card does not rewrite its content or saved versions.
2. A collection action does not silently alter AI activation or a novel's selected context.
3. A copy is independent: edits in Sandbox do not update Novel A.
4. The selected destination is visible and remains stable for delayed operations.
5. Each private operation preserves account and application ownership checks.
6. Existing story and conversation snapshots remain usable after organization.
7. Collections can be removed without deleting their cards.
8. No personal workspace receives its own credit balance or copied BYOK secret.
9. A protected, renameable default workspace guarantees an active fallback; other workspaces can be archived/restored.
10. Archived content is readable/exportable, admitted work can finish there, and new work is rejected. An active voice call must end before archive or a committed workspace switch.
11. Source-resource copies use new editable identities; historical snapshots/provenance remain historical.
12. Existing read-only floating previews close on committed switches. They are not new editable windows.

## Success criteria

A user can create Sandbox and Novel A, put related cards into a cast collection, find that cast through an existing picker, copy selected cards into Sandbox, and edit the copies without affecting Novel A. A request started in one workspace finishes there even if the user switches before completion.

For actionable acceptance, see [10 — acceptance guarantees](10_risks_and_decisions.md#acceptance-guarantees-a01-a27) and the remaining gates in [04](04_gaps_and_priorities.md).

## Selected implementation contracts

[Document 15](15_execution_contracts.md) fixes selectors, DTOs, errors, initial bounds, operation storage, default-persona authority, and lifecycle behavior. [Document 16](16_scope_inventory.md) maps those rules to the current project. No product/engineering alternative in earlier drafts should be treated as an unresolved prerequisite.
