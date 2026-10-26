# Documentation

<a id="documentation-index"></a>

**Documentation review: 2026-10-15. Completed-plan cleanup: 2026-10-26.** Start with the [status matrix](STATUS_MATRIX.md), [feature availability](FEATURE_STATUS.md), and [remaining work](ROADMAP.md). These describe reviewed source and dated evidence; deployed configuration and acceptance need their own records.

## Current areas

| Area | Maintained entry point | Status and reading boundary |
|---|---|---|
| Assistants | [Contract](app_assistant/README.md), [main assistant improvement](assistant_improvement/README.md) | Four implemented kinds: card, lorebook, app and novel (novel added 2026-10-18). Registry, plan-grant and execution gates still apply. Shared card/lorebook tools, retrieval and toolset switches for the main assistant are proposed only (roadmap AIMP-01–05) |
| Billing / membership | [Billing](billing/README.md), [setup](billing/SETUP.md) | Membership/accounting implemented; checkout acceptance open |
| Membership feature flags | [Requirements and implementation dossier](feature_flag_on_membership/README.md), [critical feature map](feature_flag_on_membership/02_feature_flag_map.md) | Implemented locally; acceptance and deployment limits in status 13. Optional-off temporary plan grants, backend/frontend enforcement, Redis 900-second cache and all-member invalidation. Frontend env flags are removed; graduation deletes permission checks |
| Cards | [Capabilities and enrichment backlog](cards_enrich/README.md) | Items, guided fields and basic advisory quality hints implemented; a quality rubric, context attribution, adventure item state and director contracts remain planned |
| Character chatroom UI/UX | BFF [`mw_json_segments_v1` contract](../../../PycharmProjects/magic-worlds-api/docs/api_usage/adventure_sessions.md), [narrative prose rendering](../src/ui/docs/foundations/NarrativeProse.mdx) | Implemented for adventure, one-to-one and group roleplay (BFF `ca80cdc`, SPA `4bd411d8`); the completed plan was removed 2026-10-26. Strict JSON validation and production acceptance remain open in [CHAT-01](ROADMAP.md) |
| Character images | [Chara Studio](chara_studio/README.md) | Active design. Generation/upload/history exists; editing and reusable pixel references remain unimplemented |
| Fish Audio | BFF [Fish Audio guide](../../../PycharmProjects/magic-worlds-api/docs/fish_audio.md), [release gate V-14](voice_refactor/00_current_status_and_roadmap.md) | M0–M7 implemented (2026-10-15); the execution dossier was removed 2026-10-26. R1–R4 release acceptance and vendor questions remain open in V-14 |
| Card PNG export | [Current implementation and gaps](html2img/README.md) | Export implemented; private portrait fidelity and deployed browser acceptance remain open |
| LLM profiles / BYOK | [Current status](llm_profiles/16_current_status_and_roadmap.md), [operations](llm_profiles/14_operations_runbook.md) | Profile functionality exists. Since 2026-10-18/19 BYOK keys travel outside the graph and the executor drops them before snapshots; end-to-end custody acceptance remains open (F04). The Models page is shown to signed-in users (server profiles still need `LLM_PROFILES_ENABLED`); its BYOK copy is limited to verified tab-memory behavior (F11 fixed) |
| Lorebooks / resources | [Current capabilities and backlog](lorebook/README.md), [October 19 audit and update plan](lorebook_update/README.md) | Substantial gated implementation; the newer audit records open activation, resource-contract and editing defects with research, impact and proposed remediation |
| Moderation | [Accepted requirements and plan](moderation/README.md) | Existing speech text gate is partial. Native multimodal checks and default-on profile controls are planned |
| Onboarding | [Audit, research, and minimal plan](onboarding/README.md) | 2026-10-18 proposal only: optional email, development/recovery warnings, guided persona/character creation through card-assistant prompts, first chat, then optional feature interests; MySQL progress and owner reporting |
| Novel / Story Studio | [Novel dossier](novel_refactor/README.md), [status](novel_refactor/14_status_and_roadmap.md) | Sole writing plan, incorporating the earlier storytelling brief. Chapter editor exists; reliability findings and expanded scene/revision/assistant work remain open |
| Security | [Finding dispositions](security/README.md) | Active remediation backed by a preserved audit; profile screens do not establish end-to-end custody |
| Voices / calls | [Voice reference](voice_refactor/README.md), [release gates](voice_refactor/00_current_status_and_roadmap.md) | Earlier speech migration has dated completion evidence; current providers, gating and release work are maintained separately |
| Workspaces / Library | [R1 contracts](workspace_r1/README.md), [remaining gaps](workspace_r1/04_gaps_and_priorities.md) | Core implementation exists and the Library UI is always on (workspaces graduated 2026-10-18); integrity and environment acceptance remain open. Workspace transport always applies |

## Transport and supporting references

- [Interactive text streaming](interactive-text-streaming.md): implemented transport, migration history and remaining proxy/recovery acceptance.
- [Chat image delivery](chat-image-websocket-delivery.md): additive image frames and polling/history recovery.
- [Membership administration](membership-management-review.md): maintained membership administration boundaries and MEMBER-01.

## Documentation rules

Implementation and release status are separate. **Implemented** means the source path exists; **done** names a bounded task with evidence; **planned** names missing behavior. **Historical** preserves a dated observation; **superseded** identifies a replaced direction; **stale** is a current claim requiring correction. A disabled rollout does not remove an implementation or close its defects.

Each area has one maintained status authority linked above. Plans describe target behavior, contracts describe implemented behavior, and evidence retains its original revision/date. Carry unresolved findings and accepted requirements into the maintained authority before removing a plan. Do not replay migration commands from a historical document against a newer schema. Removed historical records (archives, dated audits and reviews, superseded plans and research) are not kept in the tree; retrieve them from git history, e.g. `git show 5a29ad5:docs/<path>` (records created after that commit are not in git). The 2026-10-26 cleanup removed the Fish Audio dossier, `llm_profiles/03`, novel ADRs 16–19/21/22 and `workspace_r1/11`, all retrievable with `git show 2d13abe2:docs/<path>`. It also removed completed plans that were never committed, so git cannot restore them: the chatroom JSON-segment plan, membership feature-flag docs 01/03–06/08/11/14, `llm_profiles/17` and the 2026-10-26 landing guest review.

Prefer repository-relative links for frontend sources. Sibling-service links assume the documented local checkout layout. Historical vendor/model/pricing claims need a new primary-source review before reuse.

The in-app `#/docs` Guide and Roadmap use localized frontend content, separately from these Markdown files. Their implementation is in `src/features/docs/components/`; changing this index does not update that copy. Keep product claims aligned when a later application change updates `docsContent.ts`, `roadmapContent.ts`, and the locales.
