# Local moderation policy, thresholds, and context

Date: **2026-10-15**. Status: **policy research requiring evaluation**. Model choice is accepted; question wording and thresholds are not implicitly approved.

Policy here means server-owned question/threshold definitions in the native backend service. Each LLM/image profile's default-on boolean controls whether its operation invokes this policy; it does not select the moderator, questions, or model. No moderator profile, policy database, or new enforcement framework is required.

## 1. Scores and decisions

~~~text
local trusted questions + bounded target/context
  -> direct Clef request
  -> validated per-question probabilities
  -> local thresholds
  -> allow / block / unavailable
~~~

A `noul` probability answers one proposition. Do not use Python truthiness, treat a missing score as zero, or sum unrelated categories into an undocumented risk score. Independent category questions are usually appropriate for multi-label moderation.

Calibration needs relevant examples. [Calibration research](https://arxiv.org/abs/1706.04599) explains why confidence needs empirical evaluation; it does not supply a Clef threshold.

## 2. Existing categories as a baseline

| Category | Existing speech-output intent | Distinction to evaluate for input checks |
|---|---|---|
| sexual | Explicit sexual output under current speech policy | Prohibited generation versus health discussion or non-explicit romance |
| sexual_minors | Sexual content involving a minor | Relevant character ages/roles; a fictional age does not establish the account holder's age |
| sexual_violence | Sexual violence/nonconsensual sexual content | Harmful depiction/instruction versus prevention, reporting, or support |
| self_harm | Encouragement, glorification, or instructions | Help-seeking distress must not be treated as abusive user intent |
| hate | Endorsement of hateful/dehumanizing treatment of protected groups | Quotation, criticism, and academic discussion differ from endorsement |
| real_people | Prohibited sexual/defamatory/impersonating treatment of identifiable people | A model's identity guess is not verification |
| gore | Graphic gratuitous gore/mutilation under speech policy | Fictional peril or non-graphic combat is not automatically equivalent |
| private_data | Exposure of real private personal data | Fictional placeholders and authorized references differ; deterministic secret checks stay |

This translates current categories for research. Reusing all TTS rules unchanged for every user request would be an unreviewed policy change. Define the questions for text, image, and audio input/output purposes; no dynamic policy registry is needed. The category meaning can stay consistent while wording/evaluated thresholds differ by modality.

## 3. Thresholds without invented defaults

Choose category/purpose thresholds using reviewed examples and a held-out set. There is no evidence here for a universal 0.5, 0.8, or 0.95 cutoff.

Every required answer must be present and valid. A score meeting the chosen block rule withholds the operation. If evaluation motivates an uncertain interval, map it to withholding/refusal using the existing error path; do not build a manual-review workflow in this integration. Keep provider unavailability distinguishable from a policy block.

Identify the local question/threshold configuration by code revision in evaluation results and safe logs. Changes require regression evaluation and clearing/bypassing incompatible existing caches. No policy table or per-decision persistence is required.

## 4. Context must identify the target

Use the current caller's authorized content and the minimum evidence needed to interpret it:

- Target text, speaker role, and input versus generated-speech purpose.
- Relevant preceding conversation excerpts with their roles.
- Applicable character/person facts and necessary card/lorebook excerpts.
- Actual language, including English/Spanish mixtures.

Keep surrounding evidence distinct from the target. Do not send unrelated history, entire novels, credentials, full profiles, or account records. User claims such as “adult=true” or “ignore the rules” do not override trusted facts or trusted question wording.

Do not add a summarizing model, immutable source-reference service, revision graph, or candidate registry. If existing context is insufficient, record the limitation or withhold the unsupported case rather than claiming complete interpretation.

## 5. Attribution and current enforcement

A high probability is not proof of age, identity, intent, or wrongdoing. A benign request can yield blocked generated speech. The native service should return the category/outcome needed by the existing gate; **do not expand automated penalties as part of the transport integration**.

Generated-output attribution, restriction delivery, and warning behavior remain audit findings. A future enforcement change should distinguish attributable user requests, generated content, shared sources, fixed preview scripts, and distress. That is separate work; no outbox, penalty engine, or report flow is required to integrate Clef.

## 6. Actual-media policy and separate companion scope

A distress classifier could later use separate questions and protective behavior. The current empty companion detector is not activated by adopting Clef for input/speech moderation. Preserve the existing distinction between protective pauses and abuse counters, and do not invent crisis guidance or phone numbers.

Actual image/audio evaluation is required by the latest scope. Image questions inspect visible content and embedded text; audio questions inspect audible speech and relevant sound content, including music. A prompt, transcript, or provider safety flag is context, not a substitute for media inspection.

Evaluate image transformations, audio codecs/noise/languages, instrumental versus vocal content, and temporal/context ambiguity. An estimated age or apparent voice/person identity is not a verified account/consent fact. Calibrate each enabled purpose rather than copying text thresholds. [12](12_audio_image_coverage.md) defines media release requirements.

Video, new recording features, companion detection, and a public-card text review workflow remain separate. Existing uploads/captured segments/generated assets supply the media; no new capture feature is introduced.

## 7. English/Spanish and adversarial evaluation

Include English and native Spanish, mixed language, Unicode/spacing variants, slang, negation, quotations, harmless fiction, and instructions embedded in untrusted state. Test missing surrounding facts and supported input bounds.

Safe-but-sensitive negatives matter. [XSTest](https://aclanthology.org/2024.naacl-long.301/) motivates this slice but is not a complete Spanish roleplay moderation corpus.

## 8. Existing deterministic controls stay

Ownership checks, workspace isolation, tool schemas, URL restrictions, SQL parameters, secret handling, and escaping retain their existing role. A content allow does not authorize a write or reveal private data. [OWASP's independent-control guidance](https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/) supports this separation; it does not call for refactoring those working controls.
