# Research and sources

**Research date:** 2026-10-15. Primary sources were opened, not inferred solely from search snippets. This is an engineering synthesis for Magic Worlds; it is not a vendor certification, a framework migration, or evidence that our current providers support the proposal.

## Findings from primary sources

| ID | Source and publication context | Relevant guidance | Application and boundary |
| --- | --- | --- | --- |
| R01 | [OpenAI — Function calling](https://developers.openai.com/api/docs/guides/function-calling), including best practices and strict mode; living documentation reviewed on the research date | Clear function contracts, constrained schemas, a small initial tool set, and host-supplied values reduce avoidable errors. Strict mode has schema requirements. | Keep one canonical definition, bind known target/scope in application code, and validate again in the BFF. Provider strictness does not establish authorization or semantic correctness. |
| R02 | [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents), 2025-09-11 | Prefer useful task-shaped tools over exposing every endpoint. Return relevant, bounded information; use pagination and actionable errors; improve definitions through evaluations. | Add search, detail reads, and target preparation. Keep the existing document tools; avoid a second set of overlapping app-specific write functions. |
| R03 | [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), 2025-09-29 | Context is finite. Lightweight references and just-in-time retrieval can replace indiscriminate loading; overlapping tools and excess context complicate decisions. | Retain a small guide/index, fetch relevant records, carry provenance, and budget tool results. This does not require embeddings or a new framework. |
| R04 | [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), originally 2024-12-19; page now notes that its tooling landscape has changed | Start with simple composable patterns, distinguish workflows from autonomous agents, and increase complexity when the task warrants it. | Use one bounded controller and one document action first. The recommendation is a local design choice, not a claim that 2024 framework examples are current product defaults. |
| R05 | [OWASP — LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | Excessive functionality, permissions, and autonomy create risk. Enforce authorization downstream, run in the user's scope, and gate high-impact actions. | Source selection limits reads; selected-target authority limits writes. No shell, arbitrary network, publishing, or deletion tools in the initial catalog. |
| R06 | [OWASP — LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | Untrusted content can influence behavior. Separating content, deterministic validation, least privilege, and adversarial tests mitigate risk; prompts alone cannot guarantee prevention. | Card descriptions and resource text cannot enable tools, select identity, authorize writes, or supply runtime configuration. JSON quoting is syntax isolation, not a complete injection defense. |
| R07 | [MCP — Tools specification, dated 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) | Tools have structured contracts/results; errors should be recoverable. Behavioral annotations require trust. Stateful handles still require authorization on each use. | Borrow typed result/error and opaque-handle design. No MCP adoption is required; metadata such as read-only or idempotent is descriptive, never an ACL. |
| R08 | [OpenAI — Safety in building agents](https://developers.openai.com/api/docs/guides/agent-builder-safety), living documentation | Keep untrusted data from privileged instruction channels, constrain node-to-node data, and combine boundaries with evaluations. | Apply the general data-flow principles. The fetched page announces Agent Builder's deprecation and contains product/model-specific advice; this dossier does not recommend adopting that product, its approval defaults, or its named models. |
| R09 | [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09 | Evaluate the harness and final environment state, distinguish capability from regression suites, use multiple trials, and combine deterministic checks with calibrated qualitative review. | Grade actual saved documents and ledger state, not whether the assistant said “done.” Add paired should-act/should-not-act cases and held-out tasks. |
| R10 | [AWS Builders' Library — Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), primary distributed-systems design reference | Caller identifiers express intent; recording identity and side effects atomically avoids duplicate work. Reusing an ID for different intent needs explicit handling. | Derive stable run/step/action identities, return original receipts, and reject changed arguments under an admitted key. Do not promise exactly-once provider execution. |
| R11 | [RFC 9110 §13.1.1 — If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1), June 2022 standard | Conditional state changes prevent overwriting a representation changed by another writer. | Preserve the application's revision/content-hash CAS. This is analogous concurrency control; the current assistant API does not implement HTTP ETags, and no status-code migration is implied. |
| R12 | [Google — Function calling with the Gemini API](https://ai.google.dev/gemini-api/docs/function-calling), fetched page last updated 2026-09-23 UTC | The application executes function calls and feeds results back. Supported schemas and function-call modes are provider-specific. | Verify tools/streaming/schema/continuation behavior through the existing executor/profile catalog. A schema working on one provider is insufficient evidence for another. |

## Research synthesis

The evidence supports a small, explicit, application-controlled action space, useful retrieval, bounded execution, and measured reliability. It does not establish a universal ideal tool count, a guarantee of injection immunity, a reason to replace the current runtime, or a requirement for agents to delegate to other agents.

For Magic Worlds, the proposed architecture is a shared registry plus a target-bound document action service and a bounded app controller. That composition is our inference from the source review and references, not an implementation prescribed by any single source.

## Alternatives evaluated

| Approach | Assessment for this app |
| --- | --- |
| Copy card/lorebook tools into the app graph | Small apparent patch; duplicates definitions and leaves target/persistence/profile assumptions unresolved |
| Have the model call internal HTTP CRUD endpoints | Bypasses the shared assistant action contract unless rebuilt carefully; duplicates permission, CAS, and receipt work |
| Create hidden editor conversations for each app action | Reuses the old lifecycle but fragments history, target authority, retry ownership, and billing |
| Reuse shared tool/domain services through a bounded controller | Recommended: separates surface from capability while keeping document semantics together |
| Expose all endpoints through generic tools | Poor fit for scope control, discoverability, and predictable mutations |
| Introduce an autonomous multi-agent framework | No demonstrated requirement in the first release; added persistence, cost, and debugging complexity |
| Introduce semantic search immediately | Potential later value, but metadata search and detail reads should first establish a baseline |

## Practices deliberately not imported wholesale

Vendor SDK auto-execution, persistent hosted sessions, tool search, parallel tool batches, and specific model recommendations are not assumed to exist in the current OpenAI-compatible graph transport. The BFF still controls execution. General security guidance does not mandate a confirmation dialog for each ordinary read or already authorized edit; proposed approval policy is described in [05](05_source_availability_and_permissions.md) and [09](09_user_experience_and_workflows.md).

No private prompts, real user records, keys, or proprietary source bodies were sent to research services. Queries concerned public tool-use architecture and engineering practices.

## Research limitations and refresh triggers

No comparative provider benchmark, latency test, retrieval-quality study, user interview, or live injection exercise was performed. The research establishes candidate practices, not measured superiority for this dataset.

Recheck living documentation when selecting providers or changing schemas. Re-evaluate the plan when tool families grow, repeated retrieval misses justify body/semantic search, multi-document edits become a real requirement, or the executor transport changes. Keep exact reviewed provider/profile/graph/catalog revisions with future acceptance evidence.
