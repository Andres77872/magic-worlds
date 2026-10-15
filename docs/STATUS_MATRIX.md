# Documentation and delivery status matrix

**Reviewed 2026-10-15, America/Mexico_City.** Source inspection and dated evidence were reconciled without provider calls, database changes or deployment. Fish documentation is actively executing and was excluded from cleanup. Individual delivery owners and dates remain unassigned unless an area explicitly records them.

| Area | Implementation state | Release / remaining work | Documentation disposition | Authority |
|---|---|---|---|---|
| App assistant | Shared three-kind implementation present | App/lorebook gates, registry, isolation, stream/CAS and retained knowledge-context acceptance | Active reference | [Contract](app_assistant/README.md) |
| Billing | Membership, PAYG, grants, administration and purchase routes present; Patreon reconciliation and link proxy present, no link UI | Purchase gates and sandbox/reconciliation acceptance | Active implementation/backlog and setup | [Billing](billing/README.md) (implementation/backlog), [setup](billing/SETUP.md) (gates/release) |
| Card enrichment | Four card families (versions/drafts for character, world and item only), items, guided fields, advisory hints and context tools present | Quality rubric beyond the existing hints, context attribution, adventure item state, director policy | Active capability/backlog summary | [Cards](cards_enrich/README.md) |
| Chara Studio | Existing portrait generation/upload/history | Dedicated editing, associations, variants and chat references are planned | Active proposal and dated research | [CHARA backlog](chara_studio/08_roadmap_and_gaps.md) |
| Fish Audio | Owner-maintained execution in progress | Consult its live ledger | **Excluded: no cleanup writes** | [Execution status](fish_audio_support/11_implementation_status.md) |
| Card PNG export | Authenticated Playwright export present | Private artwork loading, real Chromium/runtime and visual acceptance | Active implementation reference | [Export gaps](html2img/README.md) |
| LLM profiles | Profile/selection/admission foundation present | Current outbound graph can carry BYOK into retained executor state; the user-facing BYOK custody copy needs correction; operational acceptance open. The api.magic_llm protected helper is not routed | Active status and runbook | [LLM status](llm_profiles/16_current_status_and_roadmap.md) |
| Lorebooks | Studio, activation, resources, extraction and assistant present | Default rollout, actual prompt/trace budgets, lifecycle and interchange acceptance | Active contract/backlog | [Lorebooks](lorebook/README.md) |
| Moderation | Existing pre-speech text gate (legacy api.magic_llm classifier). Optional mode can pass unclassified text; the code default (required mode, classifier off) fails closed | Native text/image/audio integration and default-on profile controls unimplemented; enforcement findings open | Active requirements and remediation plan | [Moderation](moderation/README.md) |
| Novel / Story Studio | Chapter-based editor, Codex and inline generation present | D1 partial baseline (pre-existing autosave/flush/retry/guards; no NE fix merged as of 2026-10-15); D2–D6 planned; NE-001–023 unclosed | Sole active writing roadmap; earlier storytelling requirements consolidated; prototype explicitly illustrative | [Novel status](novel_refactor/14_status_and_roadmap.md) |
| Security | Dated investigation complete | F01–F11 require path-specific remediation/disposition; current custody path remains open; F11 still open: product BYOK copy promises no server storage | Frozen audit plus maintained finding register | [Security](security/README.md) |
| Voice refactor | Earlier migration has source and recorded test-deployment completion | Moderation, operations, single-process or sticky-routed call delivery topology, catalog quality, latency, devices, applicable policy/privacy confirmations and current-revision acceptance | Active reference and release gates | [Voice status](voice_refactor/00_current_status_and_roadmap.md) |
| Workspace R1 | Scope, Library, collections, copying and lifecycle foundation present; committed on master (BFF `f37eefd`, SPA `c7307c6`) and included in the 2026-10-14 test deployment (deployed commits unverified; its schema has since advanced past R1) | Rollout plus W-03/W-04 integrity concerns (including the source-confirmed W-04d default-persona path) and representative-volume acceptance | Active contracts and gap ledger | [Workspace gaps](workspace_r1/04_gaps_and_priorities.md) |

## Dependencies and completed boundaries

The earlier storytelling brief is consolidated into the [novel plan](novel_refactor/README.md); it is no longer a separate project or status row. All 136 novel capabilities and D1–D6 remain in scope.

- Security/custody acceptance applies across profile-backed generation, assistants and writing. Existing controls and tests do not close a different execution path.
- Native moderation replaces the older moderation-profile target. Current speech behavior remains the implemented baseline until that plan is delivered.
- Novel data-integrity/recovery work precedes wider assistant mutation and scene migration.
- Media ownership/retention and workspace integrity affect future image editing and exported artwork.
- Billing purchase availability is independent of credit usage, grants and quota enforcement.
- The chat planner-tool stream regression (LLM-R6) is fixed in BFF `2c2973d`, with recorded October 14 test-deployment smoke; production smoke belongs to REL-01. This does not close every chat/provider or production acceptance gate.
- The earlier speech migration and resolved June issues are completed bounded work. They do not make current feature release acceptance complete.

Current source expects the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (owned by the active Fish/voice execution; not asserted here); workspace capability compatibility deliberately remains `2026_10_workspace_r1`. Those are different contracts. The actual running database revision is not asserted by this matrix. Use [feature status](FEATURE_STATUS.md) and [roadmap](ROADMAP.md) for the corresponding availability and remaining work.
