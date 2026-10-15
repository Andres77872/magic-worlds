# Secret resolution and credential custody audit

**Status reconciliation 2026-10-14: historical bounded audit; remediation WIP.** Findings below retain their original date, source heads, canary/database evidence and limitations. They were not all rerun by this documentation review, and no live database was scanned again. A finding is closed only with current path-specific evidence; see **SEC-01** in [roadmap](../ROADMAP.md).

Current execution custody is governed by [Current execution boundary](README.md#current-execution-boundary) in the security register, which supersedes this audit on that point: the BFF uses the inline path, not protected profile execution or private `client_binding` custody. Deployment exposure and finding-by-finding closure remain **TBD**.

Date: 2026-10-11. Scope: the current local working trees of Magic Worlds, its BFF, the agents API, the graph runtime, and the provider library.

**This is a research report, not an implemented fix. No application source, database record, deployment setting, or existing security document was changed for this audit.** Only this report was created. Real secret values are deliberately excluded.

## Executive assessment

Keeping `{{ env.SOMESECRET }}` in a snapshot is necessary for platform credentials, but it does not prevent disclosure by itself. The executor currently lets a graph obtain environment values through several other paths, choose destinations that receive them, and route resulting strings into user output or durable state.

The most serious confirmed findings are:

1. **Parser and conditional templates can access the Python environment through unsandboxed Jinja.** A fake canary was extracted without using an `env.*` placeholder.
2. **Python hooks can read the environment and emit the value directly as public assistant text.** Python execution nodes/tools also run with host privileges; the default subprocess provides cancellation, not a security sandbox.
3. **Authenticated inline execution does not apply a secret capability policy.** It accepts caller-authored graphs; authentication, graph ownership, and graph syntax validation do not authorize access to executor secrets.
4. **Client and Fetch configuration can disclose secrets to arbitrary destinations.** Client configuration resolves placeholders in provider body options as well as authentication. Fetch resolves them in URL, headers, query parameters, and body, and successful response echoes are not scrubbed.
5. **BYOK transport inserts a literal key into the graph submitted to the executor.** The executor snapshots that authored graph unchanged. A fake key survives snapshot serialization; the BFF's later dictionary wipe cannot remove the executor's copy.
6. **One saved agent revision already contains a non-placeholder `api_key` string.** It is not a known short sentinel, is at least 12 characters long, and is the selected stable revision of a private agent. Its validity and ownership remain unverified; it does not match the current configured executor secrets checked in this audit.

There is **no evidence from this review that an attacker has exploited these paths**. There is also no basis to call credential custody safe: the code paths are reproducible with fake values, and a credential-shaped literal is present in saved history.

The current native database scan found **63 snapshots and 10,020 native records**. No exact matches for the configured executor secrets checked were found. All 74 credential-shaped string fields identified in snapshots contained an environment placeholder. This bounded observation does not cover old/rotated credentials, arbitrary BYOK keys, backups, logs, other databases, or secrets with names outside the scan rules.

## Method, scope, and evidence

The review traced ingress and admission, graph construction, every supported node family, template/code execution, provider request construction, public output, native persistence/recovery, saved agent versioning, debug SSE, Langfuse redaction, and frontend BYOK custody.

Validation used inline Python with bytecode writing disabled, fake environment variables, fake provider constructors, an in-memory admission repository, and a mocked HTTP transport. No validation request was sent to a real provider, MCP server, Redis server, or external destination. Database research used explicit read-only transactions followed by rollback. No real credential was printed, copied into this report, or validated against a provider.

The canary checks establish behavior of actual helpers and node implementations. They are not a full HTTP exploit against the running service: authentication and SQL were deliberately replaced with controlled test doubles where required. Python node execution was validated at its compiler boundary; a sandboxed local attempt to exercise its threaded path was interrupted, and subprocess security was assessed from source, not by executing arbitrary child code.

Reviewed repository heads, with existing working-tree changes also included in the review:

| Repository | HEAD |
|---|---|
| `magic-worlds` | `51a2539026c291a9cca9955b1b8253bddac35bff` |
| `magic-worlds-api` | `9b391ac38b3178eb8ac26e1b0fe481d3c21e47f5` |
| `api.magic_llm` | `b73a03a4e24454aeb3f27e3340bdddf63d595705` |
| `magic-agents` | `2fe4007768282242b46a0b1ffcad1c3bcdc996d0` |
| `magic-llm` | `ba2d95ec35c225146fc6dbb951a803913f5baba2` |

### Relevant trust boundaries

| Caller/surface | Current restriction | Security implication |
|---|---|---|
| Magic Worlds feature calls through the BFF | Server-owned graphs and curated provider targets; personal provider options reject placeholders and reserved routing/auth fields | Ordinary prompt text is not automatically graph source. The generic executor findings do not prove that every BFF user can author a dangerous node. |
| Inline `agt` on `/v1/chat/completions` and its route alias | Requires an identity accepted by executor completion authentication | No root/admin or secret-use capability check appears in this branch. An accepted executor identity is sufficient to submit graph source. |
| Saved agent authoring and previews | Owner checks for drafts/revisions; authenticated authoring | Owner status controls the agent record, not authority to use environment secrets. |
| Public stable agents | Stable execution can be authorized for non-owners, including the public path | A dangerous published definition can run with executor privileges. This does not let an anonymous caller replace that definition. |
| Debug and history | Conversation/owner checks; ordinary history excludes `native.*` events | These are useful access controls, but do not prevent secret-bearing node outputs or ordinary debug events from being recorded. |
| Database, backups, tracing, host process | Operator/infrastructure access | Internal visibility is not encryption or a guarantee of non-persistence. |

An ordinary Magic Worlds JWT is **not assumed** to be accepted directly by the executor: project validation and delegated authentication have their own boundaries. Production network exposure, reverse-proxy restrictions, and actual principal permissions were not verified.

The BFF graph inventory contained 24 JSON files, with only `user_input`, `chat`, `client`, `llm`, `end`, `node_tool`, `parser`, and `text` node occurrences. No explicit environment placeholders were found in these authored files. Runtime transport inserts provider authentication afterward. No Fetch, MCP, Python, hook, or Memory node was found in that inventory; separately stored/generated/custom graphs still need their own policy.

## Required contract

The desired invariant should be stronger than “do not expand the snapshot”:

> Persist secret references. Authorize a reference for a particular principal, execution, node purpose, authentication field, and destination. Materialize its value only immediately before that permitted operation. Keep the value outside ordinary graph data, templates, outputs, telemetry, and persistence.

For platform credentials, a durable definition can retain `{{ env.SOMESECRET }}` **only in a declared credential slot**, with a server-controlled mapping/allowlist. Knowing an environment variable name must not grant access to it. A valid placeholder inside a prompt, parser template, tool schema, ordinary HTTP body field, or output node must not be resolved.

For BYOK, inventing a global environment variable per key would create cross-user custody and concurrency problems. Keep the personal key in an execution-owned private context. Persist a non-secret binding/requirement; after restart require the owner to re-supply the key, or adopt an explicitly designed vault policy. The existing documentation promises no server-side durable BYOK storage, so a vault would be a policy change, not a transparent fix.

“Only when used” means actual LLM request, tool invocation, MCP connection, JEV evaluation, embedding operation, or cache connection. Graph validation, client-node construction, registration of a tool, traversal of an unused branch, and loading a saved run must not materialize a credential.

## Node-by-node resolution policy

This covers all 21 runtime node type names. “Allowed” below describes the recommended boundary, not a claim that it is implemented.

| Node/type | Needs secret resolution? | Current behavior/risk | Required allowed boundary |
|---|---|---|---|
| `client` / NodeClientLLM | Yes, provider authentication | Resolves the entire `api_info` object or JSON string and base `extra_data` during construction; creates a credential-bearing client before use | Private provider credential slots only; approved target, engine and purpose; lazy execution-owned factory immediately before authorized use |
| `llm` / NodeLLM | Uses an authenticated capability, not secret text | Receives a live MagicLLM object; sends ordinary graph inputs as prompts/body options | Never expose a key on content handles; keep authentication outside messages, tool schemas, tool arguments, reasoning and results |
| `fetch` / NodeFetch | Sometimes, for a specific authenticated integration | Static URL/header/params/body templates can resolve any named env variable; runtime input fields remain literal; tool mode resolves at invocation | Explicit approved integration + destination + private auth/header slot; no generic environment access in URL/query/body/method |
| `mcp` / NodeMcp | Sometimes, HTTP authentication or a narrowly scoped child-process credential | Global graph-build helper resolves `command`, `args`, `env`, `cwd`, `url`, `headers`; remote replies become tool data | Lazy per-connection resolution; fixed approved server/command; only approved HTTP auth fields or explicitly granted child env names; args/cwd/command remain secret-free |
| `conditional` with JEV | Yes, JEV service authentication | Resolves key/base URL at evaluation; can fall back to server `JEV_API_KEY`; accepts graph-selected HTTP(S) base | Host-owned JEV connection and purpose-scoped key; no author-selected key name or arbitrary destination; missing requested credentials fail closed |
| `conditional` with LLM evaluator | Uses provider capability | Condition state/questions reach a provider; should not contain auth material | Same client policy as `llm`; do not resolve credentials in condition expressions or state |
| `conditional` with Jinja | No | Uses ordinary Jinja Environment, including strict variant; can access Python internals | Sandboxed, data-only condition inputs; no secret resolver, object capabilities, imports, or environment access |
| `chat` / NodeChat | Usually no; optional attachment Redis connection does | Attachment cache resolves all Redis config fields and arbitrary `url_env` on cache use | Host-owned Redis integration; private auth/URL binding; approved host/TLS; no author-selected infrastructure secret |
| `memory` / NodeMemory | Through host-owned vector DB/embedding services | Executor discovers Memory nodes and constructs embedding clients with imported `OPENAI_API_KEY` before node execution | Lazy private embedding/vector capabilities; restrict provider/collection/tenant; prevent secret strings entering memories/vector metadata |
| `parser` / NodeParser | No | Unsandboxed shared Jinja environment can bypass placeholder rules | Sandboxed data-only rendering; no client, hook, runtime, Python module, or custody object in context |
| `python_exec` | No general secret access | Graph code and LLM-supplied Python can read the host environment/files; subprocess inherits normal privileges | Reject for untrusted graphs, or execute in a real external sandbox without service secrets/files/network privileges; broker narrowly authorized operations |
| `hook` in Python mode | No general secret access | Unrestricted Python `exec`; can read env and call `emit.user`; top-level code executes during compilation | Trusted reviewed code only, or real isolation; do not give untrusted hook code custody objects/live clients |
| `hook` in messages mode | No | Routes participant messages/data; separate from Python hook execution | Data-only messages; secret-free coordinator/checkpoint state |
| `node_tool` / NodeTool | No | Schema-only tool declaration sent to LLM and potentially caller | No credentials in schema descriptions/defaults/examples/results; do not resolve env in schema text |
| `text` / NodeText | No | Emits authored text unchanged; fake env placeholder remained literal | Preserve/reject secret syntax as data; no resolution |
| `constant` / NodeConstant | No | Emits authored value as graph data | Never become a secret-loading node; no resolution |
| `send_message` / NodeSendMessage | No | Emits configured message and input extras; can relay a secret-bearing upstream result | No resolution; guard all public content/extras before emission, not just named auth fields |
| `user_input` / NodeUserInput | No | User content/images/extras enter the graph | Input is data, never template source or an env selector |
| `codex` / NodeCodex | No | Prepends authored entries to prompt content; does not execute the Codex app | Never resolve secrets in entries/triggers; prompt annotations are not an access-control boundary |
| `skills` / NodeSkills | No | Skill content can become LLM prompt material | No secrets in bundles, props, instructions, examples or skill metadata |
| `inner` / NodeInner | No direct resolution | Builds child graphs, including eager construction of child clients | Recursively enforce policy before building; attenuate child capabilities; fully scoped node paths |
| `loop` / NodeLoop | No direct resolution | Repeats/propagates data and nested execution | Child capability scope and lifetime; never place secrets into iteration data/results |
| `end` / NodeEND | No | Terminal routing | Never resolve; no secret-bearing terminal output |
| `void` / NodeVoid | No | Sink/control routing | Never resolve; no secret-bearing diagnostic/state |

This is a **field-level** policy. Giving an entire Client or Fetch node permission to “resolve env” is too broad. A header named `Authorization` is also insufficient without an authorized destination and principal.

## Prioritized findings

Severity reflects potential impact and the identified code boundary. P0 means urgent when less-trusted identities can author/execute these graphs; P1 means a substantial credential custody or disclosure gap. Deployment reachability still matters.

### F01 — P0: Unsandboxed parser and conditional templates bypass placeholder restrictions

**Confirmed with fake canaries.** [Shared template environment](/home/andres/PycharmProjects/magic-agents/magic_agents/util/template_parser.py:5) is a normal `jinja2.Environment`. [NodeParser](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeParser.py:41) renders authored template source against inputs. Both [conditional Jinja evaluators](/home/andres/PycharmProjects/magic-agents/magic_agents/execution/condition_evaluator_jinja2.py:39) use the same unrestricted environment class; StrictUndefined changes missing-variable handling, not access to Python internals.

A benign test accessed only `CODEX_AUDIT_FAKE_ONLY` through a Jinja object's Python globals. It extracted the canary even though no resolver was called. The parser result could be passed to SendMessage's extras. Adding a terminal End node made that SendMessage public under the executor's topology rules. Parser output can also become an LLM prompt, a Fetch body, a debug payload, or durable node data.

**Implication:** Do not add a global `env` object to templates or recursively resolve all graph strings. Even removing explicit env placeholders cannot fix this escape. Replace content/condition rendering with a sandbox and JSON-only context; do not pass live clients or runtime objects. Test filters, globals, attribute access, method calls and resource limits. Generic user input inserted as template data is a different boundary from author-controlled template source.

Jinja's official documentation describes restrictions on private/internal attributes, and cautions that sandboxing still requires minimal context and resource limits. [Jinja sandbox documentation](https://jinja.palletsprojects.com/en/stable/sandbox/).

### F02 — P0: Python hooks and execution nodes have host authority

**Confirmed hook disclosure; Python compiler and subprocess privilege confirmed separately.** [NodeHook compiles with `exec(template, namespace)`](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeHook.py:302) without removing normal Python builtins. Imports and top-level statements execute at compilation. A canary hook imported `os`, read only the fake variable, and returned `context.emit.user(value)`. The actual EmitInterface created a public `delta.content` containing it. [_find_public_output_nodes](/home/andres/PycharmProjects/api.magic_llm/src/util/agt_flow.py:437) explicitly recognizes hook user emissions as public, including lifecycle hooks.

[Python CodeRunner](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/python_code_runner.py:9) explicitly warns it is not a security boundary. Its subprocess compiles with full builtins; the child inherits environment and ordinary filesystem/network permissions. `in_process` uses full builtins. `restricted_builtins` is documented as escapable. The separate [general Python tool executor](/home/andres/PycharmProjects/magic-llm/magic_llm/util/python_executor.py:106) launches the host interpreter without a sanitized environment.

**Implication:** This remains exploitable if keys move from environment variables into Python objects in the same privileged process. Untrusted Python can inspect those objects or read files such as service configuration. Disallow these modes for ordinary authors and model-controlled code, or isolate them in a worker/container with no platform/BYOK credentials, restricted mounts, network policy and OS identity. Timeouts, max output length, and a terminable subprocess do not provide confidentiality. Scope any integration access through an external broker.

### F03 — P0/P1: Authentication and ownership are not secret-use authorization

**Confirmed admission path; production identity exposure unverified.** [Completion ingress](/home/andres/PycharmProjects/api.magic_llm/src/routes/completions.py:1324) routes any accepted authenticated inline `agt` to [_handle_inline_agent_completion](/home/andres/PycharmProjects/api.magic_llm/src/routes/completions.py:980). [Admission](/home/andres/PycharmProjects/api.magic_llm/src/services/interaction_admission.py:67) accepts a preview source when a principal is present. [Document validation](/home/andres/PycharmProjects/api.magic_llm/src/services/agent_versioning_core.py:56) bounds/validates the JSON envelope; it does not restrict credential names, dangerous code or destinations. The coordination capability check governs coordination settings, not secret custody.

With an in-memory repository and an ordinary synthetic authenticated principal, this admission path accepted a parser template capable of reading the fake environment value. No root/admin role was required by the exercised branch.

There is promising policy code in [authorize_execution](/home/andres/PycharmProjects/api.magic_llm/src/services/llm_execution.py:318): service identity, approved targets, graph hash, bindings and some dependency restrictions. **It is not the currently used protection for this inline branch.** `admit_profile_execution` has no call sites in the reviewed `src/` tree; its intended `authorize_source` argument is absent from the current `prepare_interaction` signature. The separate profile recovery router is not mounted in the reviewed route registry, and current ClientNodeModel does not support its `client_binding` factory contract. These files cannot be cited as deployed coverage.

Even that policy's dependency denylist does not exclude parser, Python hooks or `python_exec`. Simply wiring it back in would not establish a safe generic authoring boundary.

**Implication:** Enforce principal/project/node-purpose/secret/destination capabilities at actual ingress and dispatch, with identical rules for inline, saved, preview, public, nested and restored runs. Default untrusted graphs to no secret use and no privileged code. A saved agent's owner must not automatically gain executor infrastructure credentials. Validate the complete definition before constructing any secret-bearing node.

### F04 — P1: BYOK is converted into durable graph content

**Confirmed with fake transport and snapshot serialization; no literal BYOK key was identified in the 63 current snapshots.** The BFF [reads the personal key](/home/andres/PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py:112), and [_render_clients](/home/andres/PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py:143) inserts it into `node.data.api_info.api_key`. Platform mode instead inserts an env placeholder. The executor [captures the authored graph exactly](/home/andres/PycharmProjects/api.magic_llm/src/util/execution_snapshot.py:84), including literals.

The BFF clears its outbound dictionaries after serialization. This reduces local references but cannot erase serialized request bytes, the receiver's parsed graph, or its snapshot. `SecretStr`, `exclude=True`, and a safe durable envelope do not help once the extracted string is copied into ordinary graph JSON.

The current inline admission also fingerprints the complete received request. A literal BYOK key therefore participates in a durable hash, contrary to the documented policy that forbids key-derived fingerprints; rotating/re-supplying a key can change admission identity independently of the intended operation.

**Implication:** Keep credentials in a separate transient executor ingress envelope and execution-owned context. Persist the original symbolic graph and secret-free plan. Remove credentials **before** admission fingerprints, content hashes, snapshots, event serialization or telemetry. Bind key use to owner, project, execution, target and frozen revision. Recovery must require re-entry if the transient key is gone, with no platform fallback.

### F05 — P1: Client resolution is eager and expands non-authentication fields

**Confirmed with fake clients.** [NodeClientLLM constructor](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py:57) calls `_initialize_client`. [_build_magic_llm_args](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py:59) recursively resolves all of `api_info` and `_base_extra_data`. Nested API configuration such as `metadata.ordinary_field` can therefore contain a resolved environment secret. Provider adapters merge remaining kwargs into the provider request body.

A fake client accepted a key from the synthetic env variable together with `https://audit.invalid/v1` and resolved the same value in ordinary metadata. No destination or env-name permission was checked at this node boundary. A canary rotated after construction did not replace the already cached key when the same client was processed.

Graph build instantiates all nodes, including statically nested Inner graphs. This extends eager credential materialization to unused branches and child graphs. An invocation can create another configured client, but that does not undo initial eager construction.

**Implication:** Separate authentication from provider body configuration. Allow only explicitly declared secret slots, with engine-specific typed mapping for OpenAI/Anthropic/Google/Azure/Amazon/etc. URL, engine, model, routing and provider options must remain secret-free and host-authorized. Lazy materialization must not change execution admission semantics; define rotation behavior and per-execution caching explicitly. Close/release clients on success, failure, cancellation and timeout.

### F06 — P1: Fetch allows secret-bearing bodies/destinations and returns success echoes

**Confirmed request construction and mocked success response.** [FetchRenderer](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/fetch_request.py:474) resolves any authored `env.NAME` expression. [_build_step_request](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeFetch.py:615) applies it to static URL, headers, JSON/body and params. A static JSON field named `ordinary_field` received the fake secret. An arbitrary author-controlled destination would receive it on dispatch.

Fetch's use of SandboxedEnvironment successfully blocked the Jinja escape used in F01. Runtime fields arriving on input handles are sent literally and are not recursively treated as template source. These are useful controls, but they do not authorize the explicit env lookup or the destination.

[FetchSecrets](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/fetch_request.py:147) tracks values and several encodings for diagnostic scrubbing, ignoring values shorter than four characters. HTTP error handling scrubs tracked values. **Successful responses are returned without that scrub** by [step transport](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/fetch_request.py:683), [admitted transport](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/fetch_request.py:748), and [tool success handling](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeFetch.py:455). A mocked endpoint echo survived as ordinary response data.

The ordinary transport path does not explicitly disable redirects. The bounded admitted path does. Current invocation-mode coordination explicitly delegates Fetch to the ordinary path; budget/admission code does not automatically supply an egress allowlist.

**Implication:** Treat credentialed Fetch as an approved integration, not a general “fetch any URL with env data” node. Pin origin, path/method policy and auth fields; disallow credential substitution in content/query/URL. A runtime-controlled URL or tool argument must not retarget an authenticated request. Validate redirect and DNS behavior at actual dispatch. Guard success, error, tool result, state and output boundaries; redaction cannot undo sending a secret to a hostile endpoint.

OWASP recommends destination allowlisting where possible and accounts for DNS/private-network and redirect bypasses. [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### F07 — P1: MCP connection fields grant broad credential and process authority

**Eager resolution confirmed; transport/process implications established from source.** [resolve_connection_placeholders](/home/andres/PycharmProjects/magic-agents/magic_agents/util/env_resolver.py:50) expands MCP `command`, `args`, `env`, `cwd`, `url` and `headers` during graph build. The source graph copy retains references, but the runtime configuration contains resolved values before connection/use.

MCP HTTP URL validation accepts arbitrary absolute HTTP(S) hosts, rather than a secret-bound approved server. Stdio accepts a graph-authored command and arguments. A named env value can be injected into that subprocess's explicitly supplied environment. Tools/server instructions/results are returned to the model; there is no equivalent universal FetchSecrets response guard. `server_key` includes the raw URL or command and is used in logs/diagnostics, so putting a secret into a URL or command can also disclose it there. The bounded HTTP adapter disables proxies/redirects, which still does not authorize the initial destination.

**Implication:** Broker approved MCP server definitions. Resolve only when connecting, with narrowly granted headers or child env slots. Never substitute secrets into command, arguments, cwd or server identifiers. Restrict installed executables/filesystem/network access for stdio, and do not infer safety from a tool-name allowlist. Reject credential echoes in tool results/instructions before provider context, logging and persistence.

### F08 — P1: JEV, Redis and Memory dependencies need explicit custody policy too

JEV resolves [api_key/base_url at evaluation](/home/andres/PycharmProjects/magic-agents/magic_agents/execution/condition_evaluator_jev.py:104), which is closer to the desired timing. However, a missing/empty requested key falls back to `JEV_API_KEY`, and an author can select an arbitrary HTTP(S) service base. The URL validator excludes userinfo/query/fragment but permits private hosts and HTTP. The bearer can be sent to the selected initial endpoint. Redirect/proxy restrictions and generic errors are useful but incomplete.

The [attachment Redis cache](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/chat_attachments.py:58) resolves its configuration only when connecting, and reports exception classes without Redis exception text. However, arbitrary `url_env` and config placeholders plus a graph-selected host/URL allow infrastructure authentication to be routed elsewhere. Redis cache keys/content must also remain tenant-scoped and secret-free.

Memory itself consumes injected dependencies rather than retrieving env directly. The executor [constructs an embedding client for discovered Memory nodes](/home/andres/PycharmProjects/api.magic_llm/src/util/agt_flow.py:2357) using the module-imported OpenAI key before Memory execution. This is another eager/global custody path and a separate privilege from the main LLM profile. Vector DB credentials, collection scope, embedding destination, and secret-bearing memory content need distinct controls.

**Implication:** Give each integration a named host-owned capability; prohibit choosing unrelated environment names or redirecting auth to another service. No fallback to platform secrets when an explicitly requested credential is unavailable. Resolve at actual operation, with private dependency objects and scoped cleanup. Moving only LLM credentials leaves these surfaces open.

### F09 — P1: Snapshots are not the only durable leak surface

**Confirmed scalar persistence behavior.** The [native codec](/home/andres/PycharmProjects/magic-agents/magic_agents/execution/recorder.py:129) intentionally stores clients/tools as authored resource references, not `repr`/`__dict__` dumps. This avoids a major accidental client-object leak. But ordinary strings, dicts, bytes and model values are serialized without a credential policy. A fake resolved string survived this codec.

Native node input/output/error records, canonical LLM checkpoints, tool results, hook contexts, coordination messages, visible output and initial input can consequently persist a credential once a node converts it into data. Protecting `graph_definition` alone cannot prevent that. Conversation history, interaction outcomes and vector/Redis storage can retain later copies too.

**Implication:** Reject credential-bearing data before every durable boundary. Use typed private capabilities outside JSON containers, and prohibit feeding them into generic nodes/templates. Keep credentials out of native checkpoint messages and all request digests. Preserve the resource-reference codec, but do not mistake it for taint tracking. Truncation, hashing, internal event visibility and database encryption do not satisfy “the application never persists the key.”

### F10 — P1: Diagnostics and tracing are value-blind in important paths

**Confirmed canary diagnostic and redaction gaps.** [Client initialization errors](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/NodeClientLLM.py:114) retain/log `str(e)` and can emit it in debug data. Resolving the canary into an invalid `engine` inside `api_info` caused a real constructor error containing that fake value. General provider HTTP paths can log raw error response bodies and URL text; a hostile/misconfigured endpoint can echo auth into an error.

[Node._safe_value](/home/andres/PycharmProjects/magic-agents/magic_agents/node_system/Node.py:531) makes values serializable; it does not remove secrets. DebugSSEHook emits inputs, outputs and exception messages. [Langfuse redaction](/home/andres/PycharmProjects/api.magic_llm/src/hooks/langfuse_utils.py:29) removes sensitive keys/substrings, but retains ordinary string fields such as `content` containing the fake value. It is not value-aware credential protection.

OpenAI-compatible `MAGIC_LLM_DEBUG_PAYLOAD_FULL` can log messages/tools for ordinary conversations. The protected summary branch depends on `chat.complete_context_required`; the current native transport does not automatically apply that stronger privacy contract to every graph. Partial/summary logs can still include tool-result previews and base URLs.

**Implication:** Map errors to fixed codes and safe metadata before debug/log/tracing serialization. Do not include raw provider exceptions, URLs with secrets, auth headers, bodies or template/code fragments containing credentials. Guard trace exports as well as application logs. Value/stream guards are defense in depth; they cannot reliably stop a malicious Python/template author from transforming/encoding the value.

### F11 — P1: Existing security documentation overstates implemented guarantees

[The current security document](/home/andres/WebstormProjects/magic-worlds/docs/llm_profiles/05_security_and_secrets.md:5) promises no personal-key persistence, a separate executor envelope, removal before snapshots/fingerprints, and isolated execution clients. Some DTOs and dormant service code express those intentions, but the active native transport and runtime violate them.

Frontend credential memory is appropriately separate from local/session storage, scoped by account/project/target, cleared on identity changes, and protected by HTTPS checks. BFF profiles reject env placeholders and sensitive transport overrides. These controls remain valuable; they do not make the end-to-end non-persistence claim true.

**Implication:** After implementing and validating the actual end-to-end custody path, update guarantees, recovery semantics and deployment requirements together. Do not publish “never stored on our servers” as a verified property until downstream native storage and observability are covered. No existing documentation was edited during this audit.

## Where data is saved and what was observed

### Native execution snapshots

The active default schema is `magic_messages` (`DB_NAME_MESSAGES`). The snapshot is stored in:

```text
magic_messages.tb_execution_event
  event_type = 'native.snapshot'
  event_payload.encoding = 'native-canonical-json/v1'
  event_payload.canonical_json = JSON string containing the snapshot
    graph_definition = authored graph
    initial_input = admitted execution input
```

`magic_messages.tb_run.native_snapshot_event_id` points to that event. [_append](/home/andres/PycharmProjects/api.magic_llm/src/db/native_execution.py:287) writes canonical JSON with `native_visibility='internal'`. This is an application-readable serialized payload; no application-layer encryption occurs in that path. Whether disk/database/backups are encrypted was not examined.

Ordinary [execution history queries](/home/andres/PycharmProjects/api.magic_llm/src/db/execution.py:539) explicitly exclude `native.*`, and the core repository checks trusted ownership/context. There is no confirmed ordinary user endpoint exposing snapshot contents wholesale. Database operators/backups and the authorized restore path still have access. If a secret becomes ordinary output, these native filters no longer protect it.

The inline wrapper's `persist=False` disables ordinary conversation persistence, **not** required native execution recording. Treating that flag as “nothing will be saved” is incorrect.

### Read-only database results

Native scan: 2026-10-11 13:25:03 UTC. Additional saved-revision classification was performed in the same review, without printing the value.

| Surface | Observed rows | Result |
|---|---:|---|
| `native.snapshot` | 63 | 74 credential-shaped string fields contained env placeholders; no non-placeholder credential field found by these rules |
| `native.checkpoint` | 63 | No checked configured-secret exact match |
| `native.event` | 4,656 | No checked configured-secret exact match |
| `native.output` | 506 | No checked configured-secret exact match |
| `native.receipt` | 4,662 | No checked configured-secret exact match |
| `native.claim` | 70 | No checked configured-secret exact match |
| `magic_manage.tb_agent_revision.payload_json` | 88 | 56 env-placeholder credential fields; one non-placeholder `api_key`; no checked configured-secret exact match |
| `magic_manage.tb_agent_draft.payload_json` | 11 | Seven env-placeholder credential fields; no non-placeholder credential field identified |
| `magic_manage.tb_agent_command_receipt.outcome_json` | 0 | No rows |
| `magic_manage.tb_agent_flow` | 92 | Identity/metadata table in current schema; no graph payload column to scan |

Native total: **10,020**, with zero malformed native payloads encountered. An earlier snapshot-only size query in this review found 1,287,530 stored payload bytes and timestamps from 2026-10-04 08:40:48.102000 through 2026-10-11 12:11:37.316000, as returned by SQL; timezone interpretation of those SQL timestamps was not independently verified.

The literal candidate is in **`magic_manage.tb_agent_revision`, revision `rev-ddc763ed-1acf-41fa-acfd-338054167a15`**, a seed revision selected as stable for a private agent. Its `api_key` value:

- Is at least 12 characters long.
- Has no obvious `fake`, `dummy`, `test`, `canary`, or `placeholder` marker.
- Does not equal the common public sentinel strings checked.
- Does not equal a current configured executor-secret value checked.
- Was not printed, tested with a provider, classified as valid, or removed.

This is a **confirmed stored literal in a credential field**, not proof of a valid credential or public disclosure. A private published agent can still leave that value accessible to authorized history/restore operations, operators and backups. Its owner needs to identify whether it is a real key and, if so, its exposure and rotation requirements.

### Scan limitations

Known-value scanning read the executor `.env` in memory and checked sufficiently long values under recognized secret-name patterns. It did not enumerate every runtime environment value, previously rotated key, provider key supplied by a user, or every encoding/transformation. Credential-field classification covered named auth fields recursively and JSON strings under `api_info`, `config`, and `credentials`; it is not a universal classifier for secrets embedded in prompts, patch values, arbitrary metadata or nonstandard fields.

Saved revision payloads include seeds/patches; these counts describe stored payloads, not a complete materialized-history scan of every revision. Other messages/events, provider catalogs, infrastructure logs, Langfuse storage, Redis, vector stores, disk snapshots, database binlogs and backups were not comprehensively scanned. No conclusion about historic non-exposure can be drawn from the current native scan.

## Why resolving “only at execution time” is not sufficient

```text
Safe intention:
  stored reference -> authorized private credential slot -> approved operation

Current possible disclosure paths:
  template/Python reads env -> graph string -> public hook output
  env placeholder -> client metadata -> provider body
  env placeholder -> Fetch body/header -> author-selected endpoint
  endpoint echoes credential -> tool result -> prompt/checkpoint/output
  BYOK literal -> submitted graph -> native snapshot
```

Every path above can occur during execution. Timing must be paired with **purpose, destination, identity and information-flow restrictions**. Do not create a general-purpose “resolve secrets” node, output the resolved key on a handle, or give content templates a credential lookup function. Output redaction cannot prevent the original external disclosure, nor reliably detect deliberate splitting/base64/transformation by privileged code.

## Fix implications and suggested sequence

These are recommended implementation steps for a later authorized change, not actions taken here.

1. **Define and enforce graph trust first.** Restrict less-trusted inline/authored graphs from Python execution, Python hooks and unsafe template contexts. Preserve production stable-source authorization; do not let raw inline ingress bypass policy. Audit saved/public agent definitions for dangerous capabilities before granting platform secret use.
2. **Separate the credential channel from graph JSON.** Make executor admission accept a transient credential context plus a secret-free graph/plan. Use typed private bindings; freeze owner/project/purpose/target/revision. No key-derived fingerprint, graph digest, cache index or secret in nested JSON.
3. **Make authentication lazy and narrowly typed.** Refactor eager Client/MCP/Memory construction to materialize only at the real operation. Parse/validate definitions without contacting services or resolving secrets. Do not recursively resolve arbitrary provider options or template content.
4. **Constrain all credentialed destinations.** Pin provider, Fetch integration, MCP server, JEV service, Redis and vector/embedding targets. Apply DNS/private-network/redirect/proxy policy at dispatch, and prohibit dynamic retargeting while retaining auth. HTTPS alone does not authorize a destination.
5. **Protect data and observability boundaries.** Guard provider echoes, successful Fetch/MCP results, tool arguments/results, public content/extras/reasoning, hooks, debug SSE, logs, tracing, conversation history, native codec/checkpoints and coordination state before they leave private execution custody. Keep private capabilities out of renderer/hook contexts.
6. **Design loss/restore/rotation explicitly.** Persist only references. Re-authorize references against current policy on restore, including tenant, source trust and destination. A missing BYOK key must require owner re-entry; never fall back to platform. Distinguish reauthentication from reissuing a possibly billed request.
7. **Investigate existing durable data before cleanup.** Classify the identified revision privately, scan materialized definitions and historic credentials without publishing values, and inspect relevant backups/telemetry. Rotate only credentials confirmed exposed or assessed compromised. No rotation/cleanup was done here.
8. **Reconcile documentation with passing evidence.** The non-persistence promise must include every downstream service and infrastructure path. Publish the verified guarantee and remaining deployment limitations.

### Integrity and migration constraints

Snapshots retain exact authored content and hashes; saved agent history is versioned with checksums, seed/patch ancestry, result hashes, and stable pointers. Deleting a key from one JSON cell without updating integrity relationships can corrupt replay or invalidate recovery. Do not mutate historical snapshots ad hoc or replace secrets with `***` and assume the old run remains replayable.

A migration must decide whether affected runs become non-recoverable, whether safe reference-based revisions replace current stable definitions, how integrity is recomputed in a supported migration, and how copies in checkpoints/events/outcomes/backups are handled. Preserve only non-secret audit evidence. Sensitive records may need quarantine/access restriction while owners classify them.

BYOK recovery should retain a secret-free requirement and accept newly supplied credentials without changing the original logical intent. Platform restore should re-resolve an authorized reference at use; revocation must take effect. The credential itself must not be recoverable from a handle stored in Redis/DB unless the product explicitly adopts durable vault custody.

Rotation is not just rereading `os.environ`: external vault rotation, environment refresh in a running process, existing authenticated sessions and client lifetimes all need defined behavior. For short executions, a request-scoped private client may legitimately reuse one authorized credential; it still must be created at use, released afterward, and never stored as graph data.

OWASP recommends least privilege, bounded secret lifetimes, rotation/revocation, access auditing and protection against logging secrets. Those lifecycle controls support the custody contract above; encrypting a persisted key does not make it “not persisted.” [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).

## Validation completed

| Check | Outcome |
|---|---|
| Platform outbound rendering preserves env reference | Confirmed with fake transport configuration |
| BYOK outbound rendering contains literal key | Confirmed with fake key |
| Snapshot keeps authored env reference without mutating source | Confirmed |
| Snapshot retains a literal key when supplied in graph | Confirmed with fake key |
| Client constructor resolves before `process` | Confirmed with fake client |
| Existing client can retain pre-rotation value | Confirmed with changed fake env value |
| Client accepts resolved secret in ordinary metadata and arbitrary base URL | Confirmed at constructor boundary; no provider dispatch |
| MCP helper eagerly resolves connection copy | Confirmed; authored source remained unchanged |
| Parser/Jinja condition escape reads fake env | Confirmed for parser, default and strict conditions |
| Parser result reaches SendMessage extras | Confirmed at node boundary; terminal public classification checked separately |
| Ordinary authenticated inline admission accepts malicious parser source | Confirmed with in-memory admission repository; real auth/SQL not exercised |
| Hook emits fake env value as public `delta.content` | Confirmed with actual hook compiler and EmitInterface |
| Python compiler can read env with full builtins | Confirmed; default subprocess privilege assessed from source |
| Fetch static JSON body resolves fake env value | Confirmed at request construction |
| Fetch sandbox blocks the Jinja internal-attribute escape | Confirmed |
| Mocked successful Fetch response retains secret echo | Confirmed |
| Text node leaves env placeholder literal | Confirmed |
| Native scalar codec retains resolved string | Confirmed |
| Client error can contain resolved fake value | Confirmed without network |
| Generic debug copy and Langfuse `content` redaction retain fake value | Confirmed |
| Current native records and agent payloads inspected read-only | Completed; counts and limitations above |

No source tests were added. Broad application tests/builds were not rerun for a documentation-only audit; their prior success would not establish these security properties.

## Regression and deployment acceptance criteria

Before claiming the issue fixed, validate at least these boundaries with fake credentials and controlled sinks:

| Area | Required negative/positive cases |
|---|---|
| Reference authorization | Unknown env name, wrong tenant/project, unrelated service secret, wrong node purpose, nested graph, saved/public revision and revoked reference all fail before resolution/dispatch |
| Timing | Unused branch, unused Inner graph, LLM tool registration, disconnected node, validation failure and saved-run inspection perform zero secret reads; actual authorized operation resolves when needed |
| Content nodes | Plain/env-looking text in prompts, Text, Constant, Parser, conditional, Codex, Skills, tool descriptions, SendMessage and UserInput cannot read env or obtain private objects |
| Template sandbox | Attribute/global/builtin escapes, dangerous custom filters, object introspection, mutation and resource-exhaustion cases are blocked; normal data-only templates still work |
| Python/hook policy | Ordinary author cannot enable Python, use a messages hook as Python, choose `in_process`, or invoke a general Python tool with service secrets; isolated execution cannot read host env/files/network or custody objects |
| Destinations | Dynamic Fetch/MCP/provider/JEV/Redis target changes, HTTP downgrade, redirects, DNS rebinding/private IPs, proxies and auth in URL/query are rejected according to declared integration policy |
| Echo/output | Success/error responses echo fake key in text, JSON key/value, headers, tool result, instructions, exceptions, extras and reasoning; no value reaches provider context, SSE/WS, telemetry or durable storage |
| Streaming | Key split across chunks, JSON escapes, nested escapes, cancellation after a prefix, multiple channels and tool arguments; no partial sensitive value is released by the protected boundary |
| Durability | Search fake value and relevant encodings in snapshots, checkpoints, native/ordinary events, messages, outcomes, drafts/revisions, Redis/vector stores, trace exports and test logs; credentials do not influence durable intent hashes |
| BYOK lifecycle | Success, rejection, timeout, cancellation, retry, concurrent users, account/project switch and restart; key isolated per authorized execution, no stale/shared client, restart requires re-entry |
| Recovery/integrity | Secret-free graph hash stable across reauthentication; revocation honored; unsupported legacy secret-bearing runs fail closed; billing/idempotency do not silently replay external side effects |
| Documentation | Actual active routes, dependency models and provider adapters satisfy the documented custody promise; unused helper code/test fixtures do not count as coverage |

These criteria require an instrumented test environment and deployment inspection. Fake checks in this audit demonstrate the gaps; they do not verify a fix.

## Research references

Implementation evidence is linked beside each finding. External references informed the proposed controls and do not prove that this application implements them:

- [Jinja sandbox documentation](https://jinja.palletsprojects.com/en/stable/sandbox/) — untrusted template restrictions, context minimization and remaining resource limits.
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — destination validation, redirects and DNS/network considerations.
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) — custody, least privilege, secret lifecycle, auditing and logging.

**Conclusion:** The fix must remove secrets from graph data and prevent untrusted nodes from obtaining them. Preserving placeholders in snapshots addresses one persistence path; it does not close template/code execution, arbitrary destination, echo, telemetry or history disclosure paths.
