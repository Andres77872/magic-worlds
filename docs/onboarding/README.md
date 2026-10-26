# Onboarding: audit, research, and minimal plan

**Reviewed:** 2026-10-18. **Status:** proposal; documentation only. Source audit of the current frontend and `magic-worlds-api`, plus primary-source research. Checkout bases: frontend `692e56b`, backend `70c9c27`, both with existing local changes. No deployed configuration, live database, email delivery, or user study was tested.

**Updated direction:** email **must remain optional during development**. Show the recovery/deletion warnings, then guide the user through **persona → first character → first chat**, using the existing card assistant with ready-to-use prompts. Ask about feature interests after the first reply. Reuse existing services and save progress/answers in MySQL.

This revision replaces automatic starter-card provisioning and the pre-chat survey. Requiring email, verification, or a survey answer is outside the current onboarding requirements. Any future change to registration policy needs a separate decision.

## 1. Audit findings

Priorities below concern readiness for this onboarding requirement, not a general security verdict on the application.

| Priority | Observed behavior and evidence | Consequence / proposed action |
|---|---|---|
| P1 | [Signup](../../src/ui/components/LoginModal.tsx#L47) collects username/password and already shows an alpha/deletion notice at line 271. [English copy](../../src/app/i18n/locales/en.ts#L834) says those credentials are all users need. | Keep the existing development disclosure; add the missing recovery consequence and temporary nature of no-email registration before account creation. |
| P1 | The BFF [registration DTO](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py#L54) explicitly rejects `email`; the frontend [type](../../src/shared/types/auth.types.ts#L279) still permits it. | Preserve username/password signup and optional Profile email attachment. Align the client type; do not add a required email field or verification gate. |
| P1 | [Profile email management](../../src/features/profile/components/EmailSection.tsx#L14) already supports adding, activating, resending, and removing emails. [Recovery](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py#L2273) returns a neutral response. | Link to Profile after registration. Distinguish no email, pending activation, activated, and unavailable status. A populated `user.email` alone does not establish recovery readiness. |
| P1 | [Warning copy](../../src/app/i18n/locales/en.ts#L949) calls credits informational; Spanish has the same claim. Backend [membership admission](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L3208) actually enforces balances and operation limits. | Replace that statement wherever reused. Explain the actual allowance and exhaustion behavior. |
| P1 | [Product gates](../../src/shared/featureFlags.ts#L122) cover adventures, novels, voices, and other areas. Character/world/item creation, media, Library, and model settings are not all covered. [Membership flags](../../src/app/providers/FeatureFlagProvider.tsx#L9) are account-specific; root bypasses them. | Disabling current flags does not establish “Chatroom only.” Define and enforce the preview boundary in frontend and BFF, then test with a normal account. |
| P1 | [New chat](../../src/features/characterChat/components/NewCharacterChatDialog.tsx#L43) requires an AI character and a persona; it has empty states when either is unavailable. | Guide creation of both with the card assistant, then carry the selected pair directly into chat. Reuse existing cards when available. |
| P1 | [Card assistant adapter](../../src/features/creation/common/components/assistant/cardAssistantAdapter.ts#L5) sends `current: null` for an unsaved card, even though the editor holds a role. Existing [starter prompts](../../src/features/creation/common/components/assistant/suggestions.ts#L10) are generic character prompts. | Opening the persona editor alone does not carry its role into assistant creation. Add a validated creation-role context and enforce the intended role before saving; prompts alone are insufficient. |
| P2 | [Creator templates](../../src/features/creation/character/templates.ts#L1) provide empty fields with ghost examples, not populated cards. [Assistant suggestions](../../src/features/creation/common/components/assistant/suggestions.ts#L10) send immediately; [AssistantComposer](../../src/features/creation/common/components/assistant/AssistantComposer.tsx#L9) supports a controlled draft, but its [chatbot wrapper](../../src/features/creation/common/components/assistant/AssistantChatbot.tsx#L192) does not expose that draft. | Add a small onboarding adapter for role-specific, editable prompt templates. Do not treat a ghost example as saved content or trigger generation merely by opening a step. |
| P2 | [AppWarningModal](../../src/ui/components/AppWarningModal.tsx#L10) saves acknowledgement in browser-wide localStorage, independently of the account. [Age/Terms](../../src/features/legal/attestation/AttestationProvider.tsx) already have a separate server-backed flow. | Browser dismissal is not an account onboarding record. Avoid stacking another blocking modal, and preserve the separate age/Terms checks. |
| P2 | No onboarding survey route/table was found. Existing [preferences](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py#L2598) contain language/narration settings; [attestations](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/db.sql#L372) accept only age and Terms. | Add a small onboarding store. Do not repurpose legal acceptance as a feature vote. |

The existing [feature availability document](../FEATURE_STATUS.md) still describes environment flags, while current source uses membership grants. Use the current [membership flag dossier](../feature_flag_on_membership/README.md) and source when implementing; documentation is not evidence of deployed access.

## 2. Minimal journey and proposed copy

### Before registration

Show these notices beside signup. Keep the existing unticked age/Terms controls; no extra confirmation modal or email task is needed.

| Message | English | Spanish |
|---|---|---|
| Development | **Development preview.** The project owner may delete accounts and data at their discretion, without notice, during development. Keep a copy of anything you want to retain. | **Versión en desarrollo.** Durante el desarrollo, el responsable del proyecto puede eliminar cuentas y datos a su discreción, sin previo aviso. Conserva una copia de lo que quieras guardar. |
| Recovery | Email is optional during development. Without a verified email, you cannot recover this account if you forget your password. You can add and verify one later in Profile. | El correo es opcional durante el desarrollo. Sin un correo verificado, no podrás recuperar esta cuenta si olvidas tu contraseña. Puedes añadir y verificar uno después en Perfil. |
| Signup action | Create account | Crear cuenta |

Email must not gate signup, setup, credits, assistant creation, or chat. Retain the existing optional Profile email workflow; an optional signup email field would need coordinated API work because today's registration DTO rejects it. Make the warning specific to password recovery: Google users may retain provider sign-in/recovery. Use a quiet Profile reminder, not repeated blocking requests. Pending activation is not “Recovery enabled.”

### After authentication

After required attestations and workspace readiness, show a short welcome, then the same compact guide for both creation steps:

> Welcome to the development preview. Chatroom is open for testing with a limited free allowance. Let's use the card assistant to create who you play and someone to chat with.

Spanish: “Te damos la bienvenida a la versión en desarrollo. Chatroom está abierto para pruebas con un cupo gratuito limitado. Vamos a usar el asistente de tarjetas para crear a quien interpretarás y a alguien con quien conversar.”

**Chatroom means 1:1 text chat plus its guided card setup**; the card assistant is a required supporting capability, distinct from the app assistant. Profile/email recovery, Library access to these cards, usage, help, and legal pages remain reachable. Other product areas remain interest-only unless explicitly enabled.

Display the server's balance, allowance period, card-assistant cost, and chat-operation limit. Source [seeds](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py#L20) describe Free as **50 credits daily**, with **20 included chat interactions daily** at cost **1**. These are defaults, not verified live values or a promise of 50 replies. Read `/user/me`, refresh before spending, and handle server refusals. Do not invent a reset countdown; the deployed database timezone was not audited.

### First interaction: two assistant steps, then chat

Use a small progress label: **Your persona → Your character → Chat**. Explain persona as “who you play” and character as “who the AI plays.” Offer one ready-to-use paired scenario and at most two alternatives, with a default selected. No biography questionnaire, image generation, voice setup, model selection, or full advanced editor before chat.

| Step | Guided action | Completion |
|---|---|---|
| Your persona | Open the **card assistant** with the persona prompt already prepared. Allow editing, then an explicit **Create persona** action showing its cost. Offer **Use an existing persona** when eligible cards exist. | Verify the returned saved card has `role: persona`. Show a brief summary and **Use this persona**. Reuse its ID; do not create it again on confirmation. |
| Your character | Open a **new card context** with the matching character prompt. Reuse the chosen theme and persona's confirmed fictional name; no repeated questions. | Verify a separate saved card with `role: character`. Show its summary/greeting and **Use this character**. Never reuse the persona's bound assistant conversation for this step. |
| Chat | Start a session with those two saved IDs through the existing chat flow. Preselect the pair rather than repeating the picker. Offer one editable first-message suggestion. | The user explicitly sends a message and receives a completed, persisted reply. A generated greeting alone does not complete onboarding. |

**Template prompts — proposed, complete default examples:**

Persona:

> Create and save one concise fictional player persona: Alex Vale, an adult human cartographer visiting a cozy-fantasy town to find a missing star map. Set role to persona. Include name, race, a short background, and a simple motivation. Leave the greeting empty. Use the card creation tool; do not create other cards, images, music, or voices. Write the card text in English.

Character:

> Create and save one AI character: Mira, an adult human keeper of a candlelit map shop in the same cozy-fantasy town. Set role to character. Include name, race, a short description, character-specific portrayal notes, and a brief greeting inviting Alex Vale to discuss a missing star map. Use the card creation tool; do not create other cards, images, music, or voices. Write the card text in English.

Suggested first message: “Mira, I found a torn corner of the star map. Can you help me work out where it leads?” Prefill it only; never auto-send it. Theme variants replace the same small fictional setup, not the workflow. Keep canonical prompt instructions in English, following existing suggestions; insert the UI output language explicitly and localize labels. Spanish labels: **Tu persona**, **Tu personaje**, **Crear persona**, **Crear personaje**, **Empezar chat**. No real identity information is needed.

These prompts are not implemented presets. Reuse `useAssistant`, the card adapter, composer, persistence, and chat start; add only the guided wrapper and missing template/role inputs. The backend should accept a small validated creation-role context for unbound character-card requests, retain it for retries, and enforce it on generated output before persistence. Do not invent a saved `current` snapshot to bypass the existing DTO. Existing bound-card revision and role-preservation behavior must remain intact.

The assistant already saves cards through its tools and hydrates the editor via [applyAssistantCard](../../src/features/creation/character/components/CharacterCreator.tsx#L511). Explain that **Create** saves to the Library; **Use** confirms the saved card for setup. Inline edits must respect draft/publish semantics, so chat must use the accepted usable card version. Do not silently change the user's global default persona.

Persist progress after each accepted card. Return/reload resumes the same workspace, conversation, and saved targets; reuse the existing request ID for a retry. If a result was saved before navigation failed, recover it before generating again. Offer **Continue later**, existing-card selection, and the minimal manual creator when the assistant is unavailable. Continuing later keeps progress; it does not start a chat without the required cards. Derive the next step from valid owned cards, not a stale step label.

### Feature interests after the first reply

Show an unobtrusive card after activation; it must not interrupt the conversation. Also expose it in Profile so users can answer earlier, return later, or edit. Ask:

> **What would you like to test? (optional)** Choose up to three features and mark one as your first choice. Your answers help us decide what to focus on. Other features are previews of possible testing areas; selecting them does not unlock access. We save your choices with your account for development planning.

Spanish: “**¿Qué te gustaría probar? (opcional)** Elige hasta tres funciones y marca una como tu primera opción. Tus respuestas nos ayudan a decidir en qué enfocarnos. Las demás funciones muestran posibles áreas de prueba; seleccionarlas no habilita el acceso. Guardamos tus elecciones con tu cuenta para planificar el desarrollo.”

- Start with nothing selected. With one selection, make it the first choice; with multiple selections, let users change that choice explicitly.
- Offer **Not sure yet** and **Skip for now**. Record these separately; neither means disinterest in every feature.
- Actions: **Save interests** / **Skip for now**. Acknowledge the development notice during entry, separately from survey outcome and age/Terms acceptance.
- Save before confirming success. On failure: “We couldn't save your choices. Retry or continue without saving.” Preserve the draft; chat remains usable.
- Returning users resume setup from server state. Answered/skipped surveys are not repeatedly prompted. Material notice updates must not restart setup or repeat the survey.
- Shorten the existing general warning presentation and remove duplicate prompts while preserving its safety disclosures and legal links. Keep a visible development label and accessible explanation afterward.

The choice cap and two-step assistant guide are product hypotheses to test, not established optimal numbers.

## 3. Feature catalogue

Present every major product area in the optional survey, including disabled areas. Use balanced descriptions and **Available now**, **Setup only**, or **Interest only** text; identify the available part of a mixed family. Card creation/assistance for setup is available support; lorebook assistance can remain interest-only. Avoid release promises, voting totals, or larger promotional cards. Stable IDs are independent of rollout flags.

| Proposed ID | User-facing label / short explanation | Existing source area |
|---|---|---|
| `chat_1to1` | Character chat — talk with one AI character | `features/characterChat` |
| `chat_group` | Group chat — talk with multiple characters | `characterChat`, `groupChats` gate |
| `characters` | Characters and personas — create the people in your stories | `features/creation/character` |
| `worlds` | Worlds — create settings for your stories | `features/creation/world` |
| `items` | Items — create objects for your stories | `features/creation/item` |
| `adventures` | Adventures — play a story guided by an AI game master | `features/creation/adventure`, `interaction` |
| `story_studio` | Story Studio — write and develop longer stories | `features/novel` |
| `lorebooks` | Lorebooks — organize reusable background knowledge | `features/lorebook` |
| `knowledge_import` | Resource imports — bring documents and web knowledge into lorebooks | `features/lorebook` resources |
| `images` | Images — generate and manage character or scene art | `features/gallery/media`, creation media |
| `music` | Theme songs — generate music for your creations | theme-song API, creation media, playlist |
| `narration` | Narration — listen to story and chat text | `features/interaction`, shared voice controls |
| `voice_calls` | Voice calls — speak with AI characters | `features/call` |
| `voice_studio` | Voice Studio — choose and configure character voices | `features/voices` |
| `library_workspaces` | Library and workspaces — organize creations and projects | `features/library`, `workspaces` |
| `community` | Community sharing — discover and share creations | `features/gallery` community/sharing |
| `editing_assistants` | Creation assistants — get help editing cards and lorebooks | creation engine, lorebook assistant |
| `app_assistant` | App assistant — get help with the app | `features/appAssistant` |
| `model_profiles` | Model profiles — configure text and image AI models | `features/llmProfiles`, `imageProfiles` |

This is a **family-level inventory**, not a claim that every subfeature is release-ready. Selecting a family cannot establish which subfeature is wanted. Administration, billing, notifications, account settings, and background tasks support the product rather than becoming roadmap votes. Existing feature dossiers remain the implementation-status authorities.

Show the complete compact list without requiring a tour or opening disabled pages. Randomize options once per account/survey version and keep that order stable through back/retry; keep non-feature answers at the end. Save offered IDs, order, and availability context. “Offered” means included in the displayed list, not proof someone read every row. Interest selection must neither change membership grants nor invoke unavailable features.

## 4. Small backend and database design

**Proposal:** one new `user_onboarding` table in `magic-worlds-api`, using existing raw SQL/transaction patterns. No onboarding SaaS, new state library, event pipeline, or initial dashboard is needed.

| Fields | Purpose |
|---|---|
| `user_id`, `project_hash`, `user_group_hash` | Unique account/scope key; FK to the local shadow user. No workspace key: changing workspace must not repeat onboarding or create another vote. |
| `notice_version`, `notice_acknowledged_at`, `no_email_warning_acknowledged_at` | Latest preview/recovery notice acknowledgement, with server timestamps. Do not infer it from old localStorage dismissal. |
| `setup_step`, `setup_workspace_id`, `persona_card_id`, `character_card_id`, stage conversation/request references | Resume the two assistant steps without duplicate generation. Card references must be owned, accessible, usable, and have the expected roles. Setup references belong to the captured workspace; votes remain account-scoped. |
| `survey_version`, `catalog_version`, `locale`, `survey_first_placement`, `offered_keys_json`, `display_order_json`, `availability_snapshot_json` | Interpret the question/options and availability; distinguish first exposure after a reply from optional Profile entry. |
| `outcome`, `choice_keys_json`, `primary_key` | `pending`, `answered`, `not_sure`, or `skipped`; at most three unique allowlisted choices; first choice must be selected. Non-answer outcomes have no choices. |
| `setup_started_at`, `survey_first_seen_at`, `responded_at`, `updated_at`, `revision` | Separate setup entry from actual survey exposure; server timestamps and concurrent-update protection. Derive activation from existing completed chat records. |

Keep the latest vote per account; edits replace it. Notice changes must not reset setup or answers. Derive identity/scope from the authenticated session; validate supplied card/conversation references server-side. Assistant content stays in existing assistant/card storage, not the onboarding row. Do not copy email, passwords, chat text, IPs, or device fingerprints into it.

Suggested endpoints, all **new/proposed**:

- `GET /onboarding/config`: public preview status, notice version, and `email_optional: true` for this development release; no account information. Ship matching localized notices and detect unsupported versions. This plan adds no email-required mode.
- `GET /user/onboarding`: current account state plus versioned product catalogue and effective availability. An absent row means pending; reads do not create acknowledgement or completion.
- `PUT /user/onboarding`: record notice acknowledgement, setup progress, survey display, answer, or skip using validated transitions. Set `survey_first_seen_at` only on survey rendering. Use atomic writes/revision checks; identical retries succeed, stale conflicting edits return 409. Reject invalid references, duplicate/excess choices, and stale catalogue versions. Interest-only features remain valid votes.

Use existing authenticated `apiService` calls and contexts. Ignore late results after account/workspace changes; clear drafts on sign-out and deduplicate StrictMode effects. Existing users can reuse eligible cards and skip completed creation steps. Capture the setup workspace; after switching, offer explicit resume there rather than copying/recreating cards automatically. Exclude root/test accounts from owner totals.

**Retention proposal:** keep identified answers during the preview, then purge them within 90 days after it ends, or on account deletion if sooner. Retain only a completion stub when removing answers so users are not asked again; any retained totals must not identify accounts. Connect deletion to existing account cleanup and publish the actual survey purpose/retention alongside the privacy information. This is a proposed operating policy, not an existing implementation or a determination of applicable law.

## 5. Preview access and credits

- Preserve optional email throughout this release. There is no required add-email/verify-email onboarding step and no email condition for the Free allowance. Revisit any future registration policy separately.
- Permit 1:1 chat, persona/character creation/read/edit, their `kind: card` assistant turns, and supporting account/Library/help/legal/usage access. Retain ownership/quota checks and restrict setup assistant requests to character cards with the intended role. The card assistant needs its own enabled registry entry and published profile; enabling `appAssistant` does not enable it. Enforce the preview boundary in the BFF as well as navigation.
- Use two assistant generations as the default path, with further edits optional. [Feature contracts](../../../../PycharmProjects/magic-worlds-api/src/services/llm_features.py#L47) bill `card_assistant` through `ai_card_generation`, while character chat uses `chat_interaction`. At current seed costs, two one-turn creations plus one chat interaction use **3 credits**; actual costs/limits come from the server. Show each cost before the user starts, and ensure the allowance can support setup plus a reply. Generation is not implicitly free; failures/refunds follow existing accounting. No automatic sends, regenerations, or credit grants on page load/retry.
- Use existing published card-assistant/chat profiles. Hide optional media and advanced editor panels during setup; do not depend on community access or install pre-generated cards as the default onboarding path.
- Prefer the existing limited **daily Free allowance** for this iteration. A one-time signup grant would be a separate decision requiring an idempotent ledger grant; it must never be minted by opening onboarding or submitting votes. Show real operation limits as well as credits; refresh stale balances and explain quota/exhaustion refusals. Do not promise recharge timing or purchases unless supported in that deployment.
- The warning communicates the owner's development reset policy; it does not execute a reset. Actual account/data removal needs coordinated identity, content, workspace, media, and accounting handling. This report authorizes no deletion.

## 6. Research and best practices

Sources were checked on 2026-10-18. The recommendations combine established usability guidance, survey experiments, accessibility guidance, and the current architecture. No study identified here establishes an optimal conversion rate or universal flow for this product.

| Evidence | Application here / limit |
|---|---|
| [Apple: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) recommends a short, optional, interactive introduction. | Build the user's actual persona and character as the learning task, allow reuse/continue later, then start chat. Keep feature research optional and outside the critical path. |
| [Nielsen Norman Group: Onboarding tutorials vs. contextual help](https://www.nngroup.com/articles/onboarding-tutorials/) describes interruption and recall problems with introductory tours. | Explain persona/character beside their creation action, use prepared prompts, and reveal advanced fields only on request. Moving the survey after first value is our application of this guidance, not a measured conversion result. |
| [GOV.UK: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) emphasizes asking only useful questions, explaining purpose, and identifying optional information. | Ask about testing interests, explain how they affect planning, permit uncertainty, and avoid demographic/profile questions unrelated to that decision. |
| [Pew: Writing survey questions](https://www.pewresearch.org/writing-survey-questions/) documents wording and response-order effects. | Use plain, balanced labels; rotate and record option order. Changing wording/catalogue requires versioning, and results from different versions should not be silently combined. |
| [Pew: Forced-choice vs. select-all experiment](https://www.pewresearch.org/methods/2019/05/09/when-online-survey-respondents-only-select-some-that-apply/) found differences in endorsement and accuracy for reported experiences. | A short top-three question trades measurement detail for less effort. It measures relative stated priority, not exhaustive interest; unchecked does not mean unwanted. The experiment does not prove that three choices is best for onboarding. |
| [W3C: Grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/) and [form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) describe accessible groups and submission feedback. | Use labels and fieldset/legend semantics, keyboard-operable selections, visible focus, announced selection counts/errors, and clear saved/failed feedback. Do not communicate availability only through color. |
| [OWASP: Forgot password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) recommends neutral responses and secure out-of-band recovery. | Keep the existing public recovery response neutral. Explain missing verified email inside the owner's signed-in experience; do not add a public account/email-existence checker. |
| [ICO: Data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/) explains collecting only information needed for a stated purpose. | Store structured interests and minimal context; no third-party tracking or sensitive free text is necessary. Use this as a design principle, not an assumption about jurisdiction. |
| [NN/G: Choosing research methods](https://www.nngroup.com/articles/which-ux-research-methods/) distinguishes reported attitudes from observed behavior. | Votes guide what to investigate; successful chats and return use show behavior. Unavailable features cannot accumulate comparable usage evidence. |
| [GOV.UK: Plan user research](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service) recommends small iterative qualitative rounds, usually 4–8 participants. | Test comprehension and the first-chat journey with a small round before expanding. This is usability research, not a statistically representative demand estimate. |

## 7. Owner reporting and implementation order

Start with a private aggregate query/export, restricted to the owner/root. Report unique accounts **offered**, **answered**, **not sure**, and **skipped**; show counts/denominators, then first-choice and any-choice counts per feature. Never count edits as additional voters. Separate new/existing accounts, survey versions/placement, locales, and availability contexts. These self-selected preview users do not represent the whole market.

Track the funnel **setup opened → persona accepted/reused → character accepted/reused → first user message → completed reply**. Derive activation from chat records, excluding automatic greetings; report time, failure/retry rates, setup credit use, and drop-off per step. Report survey exposure separately: a survey shown after activation describes activated users, not all signups. Use later qualitative rounds to investigate drop-offs; votes, effort, and dependencies guide focus without promising releases.

| Order | Small deliverable | Acceptance |
|---|---|---|
| 1 | Align optional-email/recovery/deletion copy in EN/ES; verify allowance and guided-setup access. | A no-email user can register, create both cards, and chat. The card assistant has a usable published profile and quota. |
| 2 | Add the table, schema/bootstrap migration, strict GET/PUT contracts, and private aggregate query. | Correct account/scope ownership, duplicate-safe saves, revision conflicts, valid selections, deletion/retention integration; votes never change credits or grants. |
| 3 | Add the compact two-step guide, role-aware template prompts, and resume links to existing assistant/card flows; carry the pair into chat. Put the feature survey after the first reply and in Profile. | Both roles are correct, no duplicate cards/spend on replay, no picker repetition, and a fresh ordinary account reaches its first reply without email or survey completion. |
| 4 | Run a 4–8 person usability round, then a small ordinary-account preview cohort. | Participants can explain recovery, deletion risk, current access, and allowance; report abandonment and activation with denominators before changing the flow. |

Reuse `PageHeader`, `Callout`, `Field`, `Button`, `Card`, and appropriate selection primitives from the repo. Follow the [component](../../.agents/skills/ui-components/SKILL.md) and [design-system](../../.agents/skills/ui-design-system/SKILL.md) skills; preserve checkbox/radio semantics rather than styling a clickable card without an accessible control. Test keyboard/screen reader behavior, mobile reflow, EN/ES expansion, focus, and reduced motion. Add stories only with the [Storybook conventions](../../.agents/skills/ui-storybook/SKILL.md).

Implementation checks: optional-email states and Google sign-in; failed auto-login; attestation changes; role-correct unbound generation; assistant disabled/no profile; saved result without navigation acknowledgement; retry/reload/back without extra cards or spend; existing/deleted cards; correct workspace/ownership; published versus draft edits; zero/stale credits; no automatic first message; survey failure without chat interruption. Run focused tests and `pnpm build`, plus `pnpm typecheck:stories` if stories change. This documentation-only revision does not claim runtime acceptance.

**Remaining choices:** confirm the allowance amount and default paired scenario. Defaults: existing daily accounting and the map-shop prompts above. Optional email, guided assistant creation of both cards, and first-chat activation are requirements, not open decisions.
