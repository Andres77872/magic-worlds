# Documentation

<a id="documentation-index"></a>

**Documentation review: 2026-10-15.** Start with the [status matrix](STATUS_MATRIX.md), [feature availability](FEATURE_STATUS.md), and [remaining work](ROADMAP.md). These describe reviewed source and dated evidence; deployed configuration and acceptance need their own records.

## Current areas

| Area | Maintained entry point | Status and reading boundary |
|---|---|---|
| Assistants | [Contract](app_assistant/README.md), [main assistant improvement](assistant_improvement/README.md) | Three implemented kinds: card, lorebook, app. Registry, feature and execution gates still apply; novel assistant is planned. Shared card/lorebook tools, retrieval and toolset switches for the main assistant are proposed only (roadmap AIMP-01–05) |
| Billing / membership | [Billing](billing/README.md), [setup](billing/SETUP.md) | Membership/accounting implemented; checkout acceptance open |
| Cards | [Capabilities and enrichment backlog](cards_enrich/README.md) | Items, guided fields and basic advisory quality hints implemented; a quality rubric, context attribution, adventure item state and director contracts remain planned |
| Character images | [Chara Studio](chara_studio/README.md) | Active design. Generation/upload/history exists; editing and reusable pixel references remain unimplemented |
| Fish Audio | [Owner-maintained execution status](fish_audio_support/11_implementation_status.md) | **Executing; excluded from this cleanup.** Read its live ledger for progress and readiness; shared voice docs do not override it |
| Card PNG export | [Current implementation and gaps](html2img/README.md) | Export implemented; private portrait fidelity and deployed browser acceptance remain open |
| LLM profiles / BYOK | [Current status](llm_profiles/16_current_status_and_roadmap.md), [operations](llm_profiles/14_operations_runbook.md) | Profile functionality exists; the current graph transport leaves credential custody unresolved. The Models page is shown to signed-in users (server profiles still need `LLM_PROFILES_ENABLED`), and its shipped BYOK wording overstates custody (F11) |
| Lorebooks / resources | [Current capabilities and backlog](lorebook/README.md) | Substantial gated implementation; portability, trace fidelity and advanced retrieval remain open |
| Moderation | [Accepted requirements and plan](moderation/README.md) | Existing speech text gate is partial. Native multimodal checks and default-on profile controls are planned |
| Novel / Story Studio | [Novel dossier](novel_refactor/README.md), [status](novel_refactor/14_status_and_roadmap.md) | Sole writing plan, incorporating the earlier storytelling brief. Chapter editor exists; reliability findings and expanded scene/revision/assistant work remain open |
| Security | [Finding dispositions](security/README.md) | Active remediation backed by a preserved audit; profile screens do not establish end-to-end custody |
| Voices / calls | [Voice reference](voice_refactor/README.md), [release gates](voice_refactor/00_current_status_and_roadmap.md) | Earlier speech migration has dated completion evidence; current providers, gating and release work are maintained separately |
| Workspaces / Library | [R1 contracts](workspace_r1/README.md), [remaining gaps](workspace_r1/04_gaps_and_priorities.md) | Core implementation exists; UI rollout, integrity and environment acceptance remain open. Workspace transport always applies |

## Transport and supporting references

- [Interactive text streaming](interactive-text-streaming.md): implemented transport, migration history and remaining proxy/recovery acceptance.
- [Chat image delivery](chat-image-websocket-delivery.md): additive image frames and polling/history recovery.
- [Membership administration](membership-management-review.md): maintained membership administration boundaries and MEMBER-01.

## Documentation rules

Implementation and release status are separate. **Implemented** means the source path exists; **done** names a bounded task with evidence; **planned** names missing behavior. **Historical** preserves a dated observation; **superseded** identifies a replaced direction; **stale** is a current claim requiring correction. A disabled rollout does not remove an implementation or close its defects.

Each area has one maintained status authority linked above. Plans describe target behavior, contracts describe implemented behavior, and evidence retains its original revision/date. Carry unresolved findings and accepted requirements into the maintained authority before removing a plan. Do not replay migration commands from a historical document against a newer schema. Removed historical records (archives, dated audits and reviews, superseded plans and research) are not kept in the tree; retrieve them from git history, e.g. `git show 5a29ad5:docs/<path>` (records created after that commit are not in git).

Prefer repository-relative links for frontend sources. Sibling-service links assume the documented local checkout layout. Historical vendor/model/pricing claims need a new primary-source review before reuse.

The in-app `#/docs` Guide and Roadmap use localized frontend content, separately from these Markdown files. Their implementation is in `src/features/docs/components/`; changing this index does not update that copy. Keep product claims aligned when a later application change updates `docsContent.ts`, `roadmapContent.ts`, and the locales.
