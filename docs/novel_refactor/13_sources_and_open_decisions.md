# Sources, evidence limits, and open decisions

**Documentation baseline:** 2026-10-14. **UI/UX source check:** 2026-10-15. **Status:** Dated vendor/model bibliography, selected current UI/UX guidance, and a TBD decision register; no implementation approval is implied. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

The original dossier records external references with research cutoff **2026-10-14**. The 2026-10-14 documentation update preserved that bibliography without repeating external verification. The **2026-10-15 UI/UX addendum** rechecked the official guidance in SRC43/46/47/48/60 and added SRC61–SRC64 below; it did not refresh vendor capabilities, editor-package compatibility, or model research. Specific claims link to their sources where they appear. Product pages are vendor descriptions; the original research review used abstracts and selected sections rather than a systematic literature review or reproduced experiments. Recheck availability, licenses, API compatibility, and pricing when selecting a dependency.

**Resolved scope:** Collaboration is excluded. The target is a single-author AI editor; shared editing, invitations, team roles, reviewer access, and collaborative synchronization are not deferred features or open decisions. CoAuthor below is a human–AI writing research project, not a multi-user product requirement.

Source IDs retain their original numbering after scope exclusions. These tables are the dossier's complete product and research reference set.

## Product and workflow references

| ID | Source | Research use |
|---|---|---|
| SRC01 | [Novelcrafter features](https://www.novelcrafter.com/features) | Connected planning/writing/chat/review capabilities |
| SRC02 | [Novelcrafter Write interface](https://www.novelcrafter.com/help/docs/write/the-write-interface) | Manuscript views, preferences and scene metadata |
| SRC03 | [Novelcrafter organization](https://www.novelcrafter.com/help/docs/plan/organizing-scenes-chapters-acts) | Insert/move/split/merge and non-drag organization |
| SRC04 | [Novelcrafter revision history](https://www.novelcrafter.com/help/docs/organization/revision-history) | Restorable manuscript and related content |
| SRC05 | [Novelcrafter archive/restore](https://www.novelcrafter.com/help/docs/organization/archiving-restoring-scenes) | Scene lifecycle |
| SRC06 | [Novelcrafter progressions](https://www.novelcrafter.com/help/docs/codex/progressions-additions) | Location-scoped story memory |
| SRC07 | [Novelcrafter character arcs](https://www.novelcrafter.com/courses/codex-cookbook/tracking-character-arcs) | Example of temporal character state |
| SRC08 | [Novelcrafter prompt preview](https://www.novelcrafter.com/help/docs/prompts/prompt-preview) | Prompt transparency |
| SRC09 | [Sudowrite Chat](https://feedback.sudowrite.com/en/help/articles/1016913-chat) | Story-aware asking, edit mode and multi-step plans |
| SRC10 | [Sudowrite Quick Edit](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/quick-tools/2asL35fds36oHAFJN7bYzz) | Original/proposed revision review |
| SRC11 | [Sudowrite Story Bible](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC) | Structured planning context |
| SRC12 | [NovelAI editor](https://docs.novelai.net/en/text/editor/) | Explicit inline generation location |
| SRC13 | [NovelAI advanced context](https://docs.novelai.net/en/text/editor/advancedsettings/) | Context inspection and allocation |
| SRC14 | [LivingWriter](https://livingwriter.com/) | Manuscript assistant, boards and connected workflow |
| SRC15 | [Campfire manuscript tutorial](https://campfirewriting.com/learn/manuscript-tutorial) | Chapter organization and separated notes |
| SRC16 | [Campfire manuscript update](https://campfirewriting.com/learn/update37) | Revision history and writing targets |
| SRC17 | [Scrivener overview](https://www.literatureandlatte.com/scrivener/overview) | Structured drafting, snapshots and backups |
| SRC18 | [Reedsy Studio](https://reedsy.com/studio/) | Author review, manuscript preview and file-based production; multi-user workflows excluded |
| SRC19 | [Reedsy formatting/export](https://reedsy.com/studio/format-a-book/) | Production outputs |
| SRC20 | [Plottr timeline](https://docs.plottr.com/article/54-timeline-overview) | Linked planning views |
| SRC21 | [Plottr scene cards](https://docs.plottr.com/article/57-timeline-scene-cards) | Scene/plotline planning unit |
| SRC22 | [novelWriter features](https://novelwriter.io/features.html) | Portable structure/outline workflow |
| SRC23 | [novelWriter chapters/scenes](https://novelwriter.io/docs/usage/chapters_and_scenes.html) | Organization versus compiled manuscript |

## Editor, standards, and reliability references

| ID | Source | Research use |
|---|---|---|
| SRC24 | [TipTap persistence](https://tiptap.dev/docs/editor/core-concepts/persistence) | Structured editor persistence |
| SRC25 | [TipTap Markdown](https://tiptap.dev/docs/editor/markdown) | Beta status and representation limits |
| SRC26 | [TipTap React performance](https://tiptap.dev/docs/guides/performance) | Isolation and selective subscriptions |
| SRC27 | [TipTap UniqueID](https://tiptap.dev/docs/editor/extensions/functionality/uniqueid) | Stable block identity mechanism |
| SRC28 | [TipTap AI Toolkit](https://tiptap.dev/docs/ai/ai-toolkit/client/overview) | Document tool/review integration candidate |
| SRC29 | [TipTap suggestion API](https://tiptap.dev/docs/ai/ai-toolkit/client/api-reference/suggestions) | Suggestion acceptance/feedback mechanisms |
| SRC30 | [TipTap Tracked Changes](https://tiptap.dev/docs/tracked-changes/getting-started/overview) | Paid add-on candidate for single-author AI change review |
| SRC31 | [TipTap output formats](https://tiptap.dev/docs/guides/output-json-html) | Structured JSON persistence and derived representations |
| SRC33 | [BlockNote AI](https://www.blocknotejs.org/docs/features/ai) | Alternative editor and interaction reference |
| SRC34 | [BlockNote AI reference](https://www.blocknotejs.org/docs/features/ai/reference) | Review/command API |
| SRC35 | [steven-tey/novel](https://github.com/steven-tey/novel) | Similar open-source editor reference |
| SRC37 | [RFC 9110 If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match) | Lost-update prevention |
| SRC38 | [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) | Checkpointing and unload limitations |
| SRC39 | [Unicode segmentation](https://www.unicode.org/reports/tr29/) | Language-sensitive boundaries |
| SRC40 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility criteria and target-size distinctions |
| SRC41 | [W3C toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | Keyboard focus behavior |
| SRC42 | [W3C combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) | Active-option semantics |
| SRC43 | [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Save/error announcements |
| SRC44 | [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Informational text contrast |
| SRC45 | [W3C focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | Keyboard focus verification |
| SRC46 | [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Zoom and narrow layouts |
| SRC47 | [W3C text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | User override tolerance |
| SRC48 | [W3C dragging](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives |
| SRC49 | [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html) | Retrieval and tool authorization boundaries |
| SRC50 | [OWASP excessive agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | Bounded assistant capabilities |

## Primary research

| ID | Source | Scope and limitation |
|---|---|---|
| SRC51 | [Re3, EMNLP 2022](https://aclanthology.org/2022.emnlp-main.296/) | Incremental plan/state/revision framework; historical models and task scale |
| SRC52 | [DOC, ACL 2023](https://aclanthology.org/2023.acl-long.190/) | Outline control; studied stories do not establish full-novel UX |
| SRC53 | [CHIRON, EMNLP Findings 2024](https://aclanthology.org/2024.findings-emnlp.499/) | Character representations and evidence validation |
| SRC54 | [Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/) | Context-position sensitivity in studied retrieval tasks/models |
| SRC55 | [WriteHERE, EMNLP 2025](https://aclanthology.org/2025.emnlp-main.1254/) | Adaptive long-form work; automatic metrics need author validation |
| SRC56 | [StoryWriter, 2025 preprint](https://arxiv.org/abs/2506.16445) | Event/chapter planning and compressed history |
| SRC57 | [Interaction-required suggestions, In2Writing 2025](https://aclanthology.org/2025.in2writing-1.6/) | Revision interaction case study, not universal causal proof |
| SRC58 | [CoAuthor dataset/project](https://coauthor.stanford.edu/) | Short English human/AI writing sessions, not complete novels |
| SRC59 | [CraftAlign, August 2026 preprint](https://arxiv.org/abs/2608.01377) | Emerging feature-grounded critique; not a universal literary standard |
| SRC60 | [Microsoft Human-AI Interaction, CHI 2019](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) | General interaction principles validated in their studied design setting |

## UI/UX guidance addendum — 2026-10-15

These primary sources informed [06 — UI/UX](06_ui_ux_and_accessibility.md) and its acceptance tasks. WCAG success criteria define the standard; Understanding documents explain them, and APG supplies implementation patterns. Neither reading guidance nor using a pattern certifies the application. Existing SRC43 (status), SRC46 (reflow), SRC47 (text spacing), SRC48 (drag alternatives), and SRC60 (human–AI interaction) were also rechecked for this addendum.

| ID | Source | Application to the plan |
|---|---|---|
| SRC61 | [W3C Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Review footers, notifications, panel overlays, and keyboard focus; AA minimum and stronger product visibility goal kept distinct |
| SRC62 | [W3C Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Minimum size/spacing exceptions versus the preferred larger touch target |
| SRC63 | [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Initial focus, contained navigation, unavailable background, close and return behavior for modal drawers/recovery |
| SRC64 | [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | Inspector tab/panel semantics, keyboard entry/navigation, and activation behavior |

The [HTML demo](novel-studio-demo.html) is local prototype evidence, not an external source or production implementation. Observations and limitations are recorded in [01](01_current_state_and_evidence.md#standalone-ui-prototype-evidence--2026-10-15), the UX-01–UX-12 work register is in [06](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work), delivery responsibilities are in [11](11_refactor_and_migration_plan.md#uiux-delivery-workstream), and checks are in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix).

## Local evidence inventory

Source paths and observed results are recorded in [01](01_current_state_and_evidence.md) and [10](10_issues_gaps_and_risks.md). Additional integration references:

- [Workspace R1](../workspace_r1/README.md): ownership, account/workspace switch and archive contracts.
- [LLM profiles](../llm_profiles/README.md): published-profile resolution, role caps, credentials, payer and frozen execution.
- [App assistant research](../app_assistant/README.md): unified conversations and app-guide boundary.
- [Main-assistant improvement](../assistant_improvement/README.md#scope-and-authority): proposed shared document-tool/effect contracts and run/action foundations. The main assistant owns general discovery/card/lorebook editing; this dossier owns manuscript writes and multi-document changesets. The [2026-10-16 reuse review](07_target_architecture.md#reuse-and-overlap-decisions) separates current infrastructure from that proposed extraction; cross-links do not create duplicate delivery registers.
- Frontend [story DTOs](../../src/shared/types/story.types.ts), [assistant DTOs](../../src/shared/types/assistant.types.ts), and [LLM DTOs](../../src/shared/types/llm.types.ts).
- Availability: [featureFlags](../../src/shared/featureFlags.ts), [example environment](../../.env.example), [AppRouter](../../src/app/router/AppRouter.tsx), [Sidebar](../../src/ui/components/Sidebar.tsx), and `apiService.assertNovelsEnabled()`. The reviewed local `.env` enables novels; production availability remains unverified.
- BFF `src/models/{story,assistant,llm_profiles}.py`, `src/routes/{stories,assistant}.py`, `src/services/{story_generation,story_execution,llm_profile_resolution,llm_profile_execution}.py`, assistant registry/core, and StoryModel persistence.
- Deep migration/cleanup evidence, 2026-10-15: BFF `src/database/mysql/{db.sql,bootstrap.py,fish_calls_migration.py,workspace_models.py,models.py}`, `scripts/migrations/20261015_fish_calls.py`, `src/services/llm_features.py`; frontend `DataProvider.mergeFreshChapters`, `useWordGoal`, `codexMention`, and existing story/assistant feature contracts. [15](15_database_migration_and_legacy_cleanup.md#revalidated-implementation-constraints) records the source-to-requirement mapping; fresh focused test commands/results and the nested-checkout discovery limitation are in [01](01_current_state_and_evidence.md#deep-migration-and-cleanup-revalidation--2026-10-15). No live database or new external/vendor evidence was collected.

## Recommendation ledger

| Recommendation | Status | What could change it |
|---|---|---|
| Retain TipTap and existing app boundaries | Recommended | A fixture-backed alternative proves substantially better domain fidelity/UX |
| Versioned structured scene documents | Recommended | Markdown-plus-sidecar spike proves required identity/annotation fidelity at lower total cost |
| Independent metadata/structure/document revisions | Recommended | Measured transaction needs justify a different revision vector |
| One proposal/review/commit flow | Recommended | No identified reason to maintain divergent inline/chat mutation semantics |
| Novel-bound assistant using unified infrastructure | Recommended | Adapter/target-vector spike exposes a fundamental contract mismatch |
| Extend shared Codex/gallery, assistant/execution and task infrastructure | Source-backed reuse decision, 2026-10-16 | A concrete domain contract cannot fit a shared extension; keep new manuscript revisions/changesets separate from card-only history/receipts |
| Scoped retrieval plus verified memory | Recommended | Evaluation shows another context strategy is more reliable for a task |
| Single-author document authority with revision-checked save/recovery | Recommended | Fixture-backed evidence supports a different personal persistence contract |
| Quiet Write/Plan/Review views and one shared contextual inspector | Recommended; demonstrated in a standalone prototype | Author studies, real app-shell layout, keyboard/mobile input, and measured reading behavior |
| Reachable explicit review actions, truthful persistent save/recovery feedback, and preserved interaction state | Planned UX-01–UX-08/11; product validation outstanding | Retained browser/assistive-technology tests and exact document/request contracts; demo assertions alone are insufficient |
| Paid toolkit/add-on adoption | Unselected | Licensing, custom-node, undo, backend and cost spike |
| Model/provider ranking | Unselected | Frozen per-task/language evaluation on representative manuscripts |

## Open decisions

Remaining implementation/product choices are **TBD** unless marked resolved below, with areas and prerequisites in [14](14_status_and_roadmap.md). The current data-preservation rule and lean validation policy are resolved by the user. Whole-database resets are disabled. A named owner, deadline, future schema extension or licensed add-on must not be inferred from this proposal.

1. **Resolved for D2:** canonical version-1 scene JSON with stable block/reference IDs, implemented in [ADR 16](16_document_and_structure_decision.md). The full Markdown/import/export loss contract remains D5; no discarded pre-refactor format bridge is required.
2. **Resolved for current scene writes:** revision-bound canonical plain-text UTF-16 offsets and Unicode boundary checks. Broader imported-format acceptance remains open.
3. **Settled in practice (D4 slices 15–16, recorded by the 2026-10-18 audit):** outline changes are server-side structure transforms; prose changesets apply validated final documents per scene, each revision-checked and undone in one step. Inline AI still accepts through its own path (CL-04).
4. **Settled in practice for text formats (D5 slices 5, 10, 11):** Markdown, plain text, Word, EPUB, ODT and RTF import into a new novel with a reviewed preview, a loss report and the original kept; unsupported nodes (footnotes, images, tables) are reported as lost. Import into an existing novel is not offered.
5. **Root Trash/erase resolved in [ADR 19](19_novel_erasure_and_retention.md):** retain until an explicit, reviewed one-novel erase; content-free replay barrier and terminal prompt redaction. Broader retention/storage limits for non-erased revisions, unit Trash, local drafts, backups/provider copies and context snapshots remain open.
6. Shared-device/logout local checkpoint policy and optional local encryption requirements.
7. **Offline writer/review layers implemented locally in [ADR 20](20_offline_and_reconciliation.md):** open-scene pause, checked reconnect, exact replay, reviewed merges, persistent device entry, durable exact-source review choices, opt-in verified cold app loading and monotonic retained workspace/root/unit lifecycle and terminal erasure observations. Broader lifecycle edge acceptance, retention/storage/shared-device policy and full author/browser/device acceptance remain open; no full offline guarantee is claimed.
8. Inheritance across the author's own series/workspaces and update-review behavior.
9. Budget/latency envelope for plans, critique, memory recomputation and external research. **Open; blocks A28.** The audit's recommendation: start with author-supplied research notes (no fetch service, nothing in `api.magic_llm`).
10. Supported narrative-time/POV knowledge rules, including unreliable narrators and alternate branches. **Open; blocks N05, NE-023 and the D4 temporal gate fixtures.** The branch storage model (parallel head inside the novel or linked copy) is part of this decision; the audit recommends a linked copy that reuses N04.
11. Which reading presets, publication formats and optional media features ship in each phase. **Formats and presets settled in practice** (D5); **media (read-aloud, dictation, cover generation) still open.**
12. License/hosting constraints for editor add-ons and conversion tools. So far avoided: Word export was written without new dependencies, and only `pillow` was added to the BFF. EPUBCheck needs an approved download.
13. Initial quality thresholds and author-study recruitment, including English/Spanish and assistive-technology users. **Open; blocks the D3 author-evaluation gate and UX-12.**
14. Exact phase storage types/constraints, schema marker/seeds and scoped upgrade/fixture commands. The [15 storage blueprint](15_database_migration_and_legacy_cleanup.md#required-storage-changes-by-phase) defines target responsibilities; update code through reviewed scoped changes that retain existing data. Whole-database resets are disabled.
15. **Current user directive, 2026-10-16:** preserve recovered non-novel content and current novels. Earlier project-reset approval is superseded and is not ongoing authorization. Non-novel recovery is verified; future schema extensions use reviewed scoped changes and a verified private backup. Tests use freshly allocated synthetic databases. See [15](15_database_migration_and_legacy_cleanup.md#development-data-policy).
16. **Resolved by user, 2026-10-16:** use three lean DEV checks and relevant existing product checks. Production support/observation windows, preserved-data rollback/backup rehearsals and a dedicated migration suite are not required. CL-01 through CL-10 remain a code-removal inventory.

The UI/UX update makes the following implementation decisions explicit without selecting them prematurely: final container-width transitions and reading presets; the long-review action region and narrow comparison presentation; modal versus docked inspector behavior and focus recovery on resize; persistence of unsent composer drafts (done: device drafts resume); the complete command/shortcut registry (open: Ctrl/⌘+Enter in the prose inserts a line break instead of opening the beat composer); and task-study thresholds after the pilot. Resolve these within UX-01–UX-12, not by copying the prototype's numeric cutoffs or simplified state handling.

These decisions are implementation-planning work. They do not block completion of the requested research. This dossier does not imply that the user approved a package purchase, model/provider migration, public publishing, or a production rollout.
