# Decisions and open questions

**Status:** proposed recommendations, 2026-10-15. The user authorized this research/design dossier, not code changes or acceptance of every product decision.

The user explicitly added the requirement to enable or disable general-assistant toolsets. That capability is required; the [seven-group design, defaults, and persistence details](14_toolset_controls.md) remain implementation proposals.

## Recommended decisions

| ID | Recommendation | Reason | Implementation milestone |
| --- | --- | --- | --- |
| D01 | Shared BFF registry, planners, and transactional document command service | One maintained tool/domain implementation | P1 |
| D02 | Preserve the six existing document tool names and argument shapes | No app-only copies or divergent edits | P1 |
| D03 | One visible editing target/destination per first-release turn | Compatible with existing domain safeguards and manageable recovery | P2 |
| D04 | Ask and Edit selected are distinct; focus/source choices do not grant writes | Reading and editing authority remain understandable | P2 |
| D05 | Backend capability intersection controls exposure and dispatch | Client flags and prompt text cannot authorize actions | P2 |
| D06 | Main-page document writes require app and domain assistant family gates | Disabling a family works across surfaces | P2 |
| D07 | Keep ordinary bounded edits direct after explicit target/task authorization | Avoid repeated approvals while preserving scope | P2 |
| D08 | Reuse `mw_read_card`; add four discovery/non-card-detail/preparation tools | Improve usefulness without duplicate reads or document mutations | P3 |
| D09 | Generate guide search content from the existing localized guide source | No second product-documentation corpus | P3 |
| D10 | Add versioned app run/action readback; preserve legacy validators | New capabilities do not corrupt existing history/replay | P2–P3 |
| D11 | Explicit budgets and one mutation; no unrestricted write loop | Predictable effects, latency, and cost | P2–P3 |
| D12 | Keep published profile ownership; verify tool support per contract | Shared tools do not silently change model selection | P2 |
| D13 | Retention/privacy and touched domain/security findings are release gates | Expanded access must use accurate guarantees | P0 onward |
| D14 | Defer novel writes, destructive/admin/media actions, bulk edits, and framework migration | Scope the useful first release and reuse owning feature contracts later | All |
| D15 | Add general-assistant master/per-toolset controls with independent read/edit groups | Meet the user requirement without changing editor availability or duplicating tools | P2–P3 |

All rows remain proposed until accepted during implementation planning. They are internally consistent design defaults so the plan is actionable without pretending that unresolved work is complete.

## Questions to settle before implementation

| ID | Question | Recommended default | Decision owner / deadline |
| --- | --- | --- | --- |
| Q01 | Exact first-release target-selection UX? | One explicit picker/chip; discovery can prefill candidates but not mint authority | Product/frontend, before P2 |
| Q02 | How broadly can replace be granted? | Patch ordinary requested fields; creation uses replace; broad destructive replacement needs explicit scope/review | Product/domain, before P2 |
| Q03 | Which creation types/fields can initially ship? | Enable only after uniqueness, organization, media, and replay gates pass; withhold unsafe default-persona changes | Domain/persistence, before creation exposure |
| Q04 | Exact app input/result/storage versions and forward compatibility? | Separate versioned run/action records; retain text app history and editor contracts | BFF/persistence/frontend, before P2 |
| Q05 | Backend product/card-type availability authority? | One server resolver; intersect with client supported source/types | BFF/product, before P2 |
| Q06 | How does the app profile advertise text versus tool workflows? | Versioned feature/catalog capability, explicit unsupported state, no silent profile switch | Executor/LLM/frontend, before P2 |
| Q07 | Multi-step platform accounting and daily capacity? | One run-level operation reservation/debit with bounded step accounting; no nested editor charges | Billing/product/persistence, before P3 |
| Q08 | Replay/private-content retention durations and deletion semantics? | Finite documented policy, explicit expiry, minimal permitted receipt/accounting retention | Privacy/security/ops, before expanded private reads |
| Q09 | How is guide artifact published and version matched? | Generated EN/ES artifact from current guide builder, deployed with a revision handshake | Frontend/BFF/release, before guide search |
| Q10 | First supported profiles/providers and payer modes? | Small verified platform-profile pilot; BYOK expansion only with custody acceptance | LLM/security/release, before pilot |
| Q11 | Exact source-off history/focus implementation? | Inactive pins and lineage-filtered derived context for later runs; no erasure promise | Frontend/BFF/privacy, before P2 |
| Q12 | Need stable-ID entry editing in the first release? | Keep documented replacement behavior; withhold unsupported “surgical” edits or extend shared lorebook service | Lorebook/product, before that workflow is advertised |
| Q13 | User-facing recovery/checkpoint support? | Always show durable receipt; advertise restore only if a real shared checkpoint exists | Domain/frontend, before restore UX |
| Q14 | Production performance/quality SLOs and rollout owners? | Measure same-profile baseline and acceptance workload before assigning numbers | QA/ops/product, before P4 |
| Q15 | Does evidence justify body or semantic search? | Start with existing query semantics plus detail reads; decide from failure analysis | Retrieval/evaluation, after P3 baseline |
| Q16 | Exact toolset grouping/default/storage UX? | Seven groups plus master; editing off by default; authenticated user/workspace/app scope; see control contract | Product/frontend/BFF, before P2 |

Named owners and dates remain unassigned. This dossier does not require interrupting the current documentation task for those product decisions.

## Conditions that would change the architecture

- A real requirement for multiple targets to commit atomically would require a changeset dependency/transaction design.
- Long-running background work would require durable task ownership, pause/resume, and user-visible job state.
- Repeated retrieval failures on large prose corpora could justify body search or a semantic index.
- A new executor transport could simplify or replace the proposed step projection, but must preserve admission, scope, receipts, and privacy.
- A shared general changeset service from the novel initiative could own proposal/review/checkpoint behavior for later cross-document work.

None justifies copying the existing card/lorebook mutations into another assistant.

## Completion definition for this documentation request

Complete means the current implementation has been reviewed, primary research is cited, a reuse architecture and capability policy are documented, gaps/risks/status are distinguished, and an ordered implementation/evaluation plan is present. It does not mean the main assistant can already call these tools.

Future completion of the software initiative requires phase evidence in [00](00_current_status_and_evidence.md), the [acceptance gates](12_evaluation_and_acceptance.md), and aligned current-contract/product documentation.
