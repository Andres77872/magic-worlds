# Best practices for this assistant

**Status:** proposed engineering guidance, 2026-10-15. Research IDs refer to [02](02_research_and_sources.md). Concrete limits and component boundaries below are Magic Worlds design recommendations.

## Keep tools small, clear, and shared

Describe each tool's purpose, when to avoid it, expected inputs, and result. Use enums and bounded objects, and supply known identity/target values in code. Keep only the tools relevant to the active stage visible. Strict schemas help produce valid calls; the host still validates content and authorization. [OpenAI function-calling guidance](https://developers.openai.com/api/docs/guides/function-calling)

In this app, keep the six document tools and add a small retrieval/preparation set. Do not add overlapping aliases such as “improve character,” “rewrite character,” and “edit character” when one existing patch operation expresses all three.

Use one canonical source for tool definitions, with generated projections for the graph/provider boundary. Use the same semantic validators and mutation implementation across surfaces. Structural schema validation and semantic/domain validation are separate responsibilities.

## Design around tasks and relevant results

An assistant needs to find the right record and enough detail to act, rather than enumerate every API resource. Return names, useful excerpts, stable references, continuation information, and clear errors within explicit bounds. [Anthropic tool-design guidance](https://www.anthropic.com/engineering/writing-tools-for-agents)

For this app, separate discovery, detail reads, preparation, and mutation. Search is read-only and cannot create a missing object. Preparing an edit reads a fresh editable snapshot but cannot manufacture permission.

## Retrieve before relying on truncated context

Use a compact overview plus relevant retrieval instead of sending the complete library with every question. Keep sources attributable as context changes. [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

Treat the current digest as useful orientation, not as an exhaustive index or a writable document snapshot. A factual answer should distinguish evidence from inference. A document mutation must use a fresh server snapshot, never a 220-character card summary.

## Make authority a host responsibility

Minimize functionality and privilege, execute in the user's scope, and authorize downstream calls independently of the model. High-impact operations deserve a separate control. [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)

For this app:

- Source controls allow data families; Ask/Edit mode controls whether an editing action may be requested.
- A visible target selection grants a bounded editing context; focus pins alone do not.
- The server binds actor, workspace, product policy, expected revision, and allowed fields.
- The model cannot choose credentials, another workspace, a role, or a transaction policy.
- Ordinary reads and already authorized single-target edits do not need repetitive confirmation prompts.

## Treat retrieved instructions as content

Source text may contain instructions that conflict with the user's task. Delimiting it helps organization but does not make it trustworthy. Combine isolation, deterministic controls, restricted authority, and adversarial tests. [OWASP Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)

Do not promote guide excerpts, card fields named `system_instructions`, resource text, or old assistant output into system/developer authority. The field name is authored character data, not a platform instruction channel.

## Keep orchestration bounded

Use simple workflows until a more autonomous approach demonstrates a benefit. Model-driven control adds cost and latency as well as flexibility. [Anthropic workflow guidance](https://www.anthropic.com/engineering/building-effective-agents)

Start with one selected document, one mutation, and a small read budget. Use deterministic stop conditions. Independent read implementations may batch internal database calls; that does not imply exposing parallel writes or multiple model actions.

Show brief action status, not hidden chain-of-thought. Store structured action metadata and results needed for recovery. Private model reasoning is not an audit requirement.

## Use explicit, authorized handles

A state handle identifies server state but does not itself authorize access. Validate every use, expire abandoned contexts, and return useful expiry errors. Structured result schemas and tool execution errors improve interoperability. [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

Our proposed record references and edit-context IDs bind to actor, workspace, run, source policy, and lifetime. They are not durable credentials or transferable permission tokens.

## Make repeat execution safe

Record the idempotency identity and the business effect atomically, and reject reuse of the same key for different intent. Return the original result when a prior attempt succeeded. [AWS idempotent API design](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)

Apply CAS at commit to prevent an old generated document from overwriting a newer edit. The general lost-update problem is described by [RFC 9110 conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1); the app keeps its existing revision/hash contract.

## Evaluate effects, restraint, and recovery

Grade the final environment state, use repeated trials for nondeterminism, and distinguish new-capability evaluation from regression protection. Calibrate subjective grading. [Anthropic agent evaluations](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

For Magic Worlds, “no unintended edit” is as important as “correct edit.” Assert saved fields, preserved fields, record count, membership, receipts, and credit ledger state. Include prompts that should only answer, disabled-source cases, ambiguous names, and reconnect/cancel races.

## Verify each provider through existing profiles

Function execution is the application's responsibility, and schema/tool behavior differs across providers. [Google function-calling documentation](https://ai.google.dev/gemini-api/docs/function-calling)

Keep the frontend behind the BFF. Require a verified profile/catalog contract for each workflow version. A tool-capable model label alone does not prove support for the actual card schemas, streaming arguments, or retries.

## Be accurate about privacy and success

As a local product requirement, describe actual execution-payload retention and deletion behavior before expanding reads. Success means a committed receipt; a generated phrase or completed text stream is insufficient. Keep content out of ordinary telemetry and retain only what the chosen recovery policy actually requires.
