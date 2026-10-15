# Security findings and current disposition

**Source/documentation review: 2026-10-15. Status: active remediation.** The [October 11 audit](secret-resolution-audit-2026-10-11.md) is preserved as dated evidence. Its investigation was completed; its findings were not all remediated. This register, not the audit's status preface, is the current disposition.

## Current execution boundary

The cleanup inspected working-tree sources on October 15: frontend HEAD `5a29ad5`, BFF `2c2973d`, API LLM `d86273d`, and magic-agents `91fa8d6`. Concurrent local edits exist. HEADs are reference points, not proof of the exact installed artifact or deployed configuration. No application suites, database queries, provider calls or exploit probes were run by this cleanup.

The BFF's current `_render_clients` inserts a supplied BYOK key into outbound `agt` client configuration. It posts the original completion body. The executor inline path passes that graph into native snapshot capture, which preserves the authored graph. Existing BFF transport tests assert the literal key in the outbound graph; absence from BFF logs does not establish absence from executor persistence.

Sources: [BFF rendering/dispatch](../../../../PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py), [transport tests](../../../../PycharmProjects/magic-worlds-api/tests/services/test_llm_execution_transport.py), [inline admission](../../../../PycharmProjects/api.magic_llm/src/routes/completions.py), [native execution](../../../../PycharmProjects/api.magic_llm/src/util/agt_flow.py), [snapshot capture](../../../../PycharmProjects/api.magic_llm/src/util/execution_snapshot.py).

The separate protected execution helper does not cover a request merely because profile management exists. It is also unreachable over HTTP: API LLM's [`src/routes/__init__.py`](../../../../PycharmProjects/api.magic_llm/src/routes/__init__.py) does not include the [`llm_execution_recovery`](../../../../PycharmProjects/api.magic_llm/src/routes/llm_execution_recovery.py) router, and no route imports [`services/profile_admission.py`](../../../../PycharmProjects/api.magic_llm/src/services/profile_admission.py). `PrivateOutputGuard` (in [`services/llm_execution.py`](../../../../PycharmProjects/api.magic_llm/src/services/llm_execution.py)) covers only that path, not the inline path the BFF uses (relevant to F03/F10). The BFF also strips `client_binding` from the outbound graph, so API LLM `d86273d`'s symbolic helper-role output privacy never triggers for BFF graphs; helper filtering on that path relies on BFF `2c2973d`. No deployed database was scanned and no live exploit/provider request was attempted in this cleanup. The original audit's database counts, credential observations and canaries retain their original scope.

## Finding register

| ID | Current disposition | Evidence boundary | Required closure |
|---|---|---|---|
| F01 | **Open; source mechanism present** | Shared parser and conditional templates still use ordinary Jinja environments | Restricted data-only rendering plus current canaries across parser/conditional/nested paths |
| F02 | **Open** | Python hook execution remains present; the audit records broader Python host-authority concerns | Trusted-code policy or real external isolation, with ingress and runtime negative evidence |
| F03 | **Open** | Authenticated inline admission is distinct from authority to use executor secrets | Principal/project/node-purpose/destination policy across inline, saved, public, nested and restored execution |
| F04 | **Open; actual BFF path source-confirmed** | BYOK materializes in outbound graph; native snapshot capture retains authored graph | Keep key outside graph/admission hashes/state; complete fake-key end-to-end persistence/output checks |
| F05 | **Open; source mechanism present** | Current `NodeClientLLM` eagerly resolves client configuration and initializes the provider | Private lazy capability binding, approved fields/destinations, rotation/lifetime and unused-branch evidence |
| F06 | **Open** | Audit and current Fetch implementation identify authored env resolution and success-response data paths | Approved credentialed integrations, destination/redirect controls and success/error/state/output checks |
| F07 | **Open; no closure evidence** | MCP connection/process custody findings remain in the bounded audit | Approved server/command authority, scoped credential slots and response/persistence checks |
| F08 | **Open** | JEV still resolves requested configuration with fallback; Redis/Memory custody needs independent disposition | Host-owned purpose-specific integrations, no unrelated secret selection and tenant-safe retained data |
| F09 | **Open** | Protecting a graph alone does not protect strings later stored as ordinary node data | Coverage of snapshots, checkpoints, messages, tool/hook data and every durable boundary |
| F10 | **Open; client diagnostic mechanism present** | Current client initialization stores/logs `str(e)`; broader tracing findings retain audit scope | Value-aware negative tests and bounded safe diagnostics across current paths |
| F11 | **Open — in-product BYOK copy still overstates custody** | Docs now describe the actual transport and unresolved guarantee, but the Models/BYOK copy ([`llmProfiles.ts`](../../src/app/i18n/locales/llmProfiles.ts) `key.explanation` and `byok.body`, EN and ES) still says the key is not saved on our servers while F04 is open. That copy shipped in `6bcdf11` (2026-10-10), before the audit | Copy limited to verified tab-memory properties plus a regression test; reconcile remaining upstream guarantees with engineering regression/rollout evidence |

Source anchors: [template environment](../../../../PycharmProjects/magic-agents/magic_agents/util/template_parser.py), [conditional evaluator](../../../../PycharmProjects/magic-agents/magic_agents/execution/condition_evaluator_jinja2.py), [hook](../../../../PycharmProjects/magic-agents/magic_agents/node_system/NodeHook.py), [client](../../../../PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py), [Fetch](../../../../PycharmProjects/magic-agents/magic_agents/node_system/NodeFetch.py), [JEV](../../../../PycharmProjects/magic-agents/magic_agents/execution/condition_evaluator_jev.py).

## Content retention is a separate contract

The app assistant's client digest is injected into its graph by [AppAssistantHandler.build_payload](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/app.py). [Admission](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py) serializes that payload into `tb_llm_execution_plan.frozen_payload` for replay/retry. Its absence from conversation/message/turn records does **not** mean absence from server persistence. This is source-confirmed intentional content retention, separate from F04's prohibited credential retention; it does not establish an additional compromise.

The [assistant contract](../app_assistant/README.md) describes the feature boundary. Operational acceptance still needs a retention/access/deletion policy for execution payloads, downstream snapshots and backups. Treat prompts, library digests and histories as private content even when secret fields are excluded. Do not promise a context is ephemeral because only its dedicated message column is empty.

## Ownership and disposition

Responsible components are identified; named owners and release environments remain **TBD**, not assigned by this cleanup. Runtime/template/node owners must handle F01/F02/F05–F08; BFF and executor admission/transport owners must jointly close F03/F04; persistence/observability owners must cover F09/F10; documentation and frontend copy owners coordinate F11 with the implementation evidence. Cross-repository closure cannot be inferred from one repository's passing tests.

**Owner follow-up — Redis credential exposure.** While debugging the LLM-profile rollout with an agent-session database watcher run from the BFF checkout, the `netloc` of a Redis URL read from the local `.env` (password included) was printed into the agent session. Rotation was recommended; completion is not recorded. Confirm the rotation or record acceptance of the exposure. When inspecting a URL, print only scheme, host, port and path.

## Closure and evidence

Each finding needs an owner, affected runtime/revisions, implementing change, meaningful negative regression, retained sanitized evidence, and environment-specific acceptance. A helper's existence, passing unrelated tests, frontend-only volatile storage, or an old canary cannot close another path.

The current source analysis establishes mechanisms, not production reachability or proof of compromise. Preserve the audit rather than editing its old test counts into new acceptance. Track releases in [SEC-01](../ROADMAP.md) and custody integration in [LLM-R3](../llm_profiles/16_current_status_and_roadmap.md). Native content moderation has a separate [accepted scope](../moderation/README.md); a content allow verdict does not authorize secret use or destinations.
