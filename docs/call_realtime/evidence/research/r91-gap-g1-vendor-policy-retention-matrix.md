# r91 — Gap G1: content policy, data retention and voice-clone consent for 18+ fictional roleplay audio

- **Date of research:** 2026-10-20
- **Closes gap:** G1, which was left open by r03, r04, r05, r07, r08, r09 and r10. Those reports relied on pages that returned 403 or on secondary trackers (aihaven, justainews).
- **Method:**
  - I fetched every policy page in this report directly, on 2026-10-20, using `curl` and HTML-to-text extraction, plus WebFetch for policies.google.com.
  - No WebSearch was used because the shared quota was exhausted.
  - `openai.com/policies/usage-policies/` still returns 403 to direct fetchers. Its content comes from the Internet Archive snapshot of **2026-10-19 19:01 UTC**, which is the latest one.
  - OpenAI help-center pages and openai.com/index pages also return 403, so ChatGPT "adult mode" status could not be confirmed from a primary source (see §6).
  - Developer docs (`developers.openai.com/*.md`, `platform.claude.com/*.md`, `docs.x.ai/*.md`, `docs.cartesia.ai`, `docs.inworld.ai`, `developers.deepgram.com`, `assemblyai.com/docs`, `elevenlabs.io/docs`) were read as their Markdown exports.
- **Not legal advice.** "Allowed" below means *the vendor's published text does not prohibit it*. Every vendor keeps a discretionary catch-all and enforces at the account level. For any lane that carries explicit (T2) content, get a written confirmation or carve-out from the vendor.
- **Copyright:** policy text is paraphrased. Exact category names are kept where the wording is decisive.

## Legend

| Mark | Meaning |
|---|---|
| **A** | Allowed: the text does not prohibit consensual, verified-adult fiction of this kind |
| **A\*** | Allowed by omission, but a catch-all, a prior-approval clause or a runtime filter creates real risk. Get written confirmation |
| **?** | Ambiguous: the wording can be read either way, or the key policy page could not be retrieved |
| **P** | Prohibited by the text, or blocked de facto by a mandatory runtime filter |

Content tiers used in this report (proposed for Magic Worlds in §8):

| Tier | Content |
|---|---|
| **T0** | General |
| **T1** | Romance or suggestive, non-graphic ("fade to black") |
| **T2** | Explicit sexual content between consenting adult fictional characters |
| **V1** | Action or peril violence |
| **V2** | Graphic or gory violence |

---

## 1. Executive summary

1. **Policy is the deciding filter for the 18+ lane, ahead of latency or price.** Of the big LLM and S2S vendors, only **xAI** (its AUP is now published under the "SpaceXSI" brand, effective 2026-08-14) has no ban on consensual adult sexual content. Open-weight models hosted on Groq (AUP effective 2025-10-15) also have none: Groq bans only sexually explicit content *that is illegal*.
   - **OpenAI:** the Model Spec of 2026-08-18 still tells models not to produce erotica, *including audio*. This is a "System"-level rule that developers cannot override, and "grown-up mode" is still described as being explored.
   - **Anthropic:** its Usage Policy (effective 2026-11-12) bans depicting sex acts and erotic chats. *Fact-check note:* that effective date is three weeks in the future as of 2026-10-20, so the previous version governs until then. The previous text was not re-read.
   - **Google:** its Prohibited Use Policy (2024-12-17) bans sexually explicit content made for gratification.
   - **MiniMax:** its terms (2026-03-30) ban obscene, pornographic *and violent* content.
2. **Fish Audio, one of the two TTS vendors Magic Worlds uses today, prohibits explicit content in both its current documents.**
   - The **Customer Agreement updated 2026-08-10** makes the customer warrant that Customer Materials are not *obscene, pornographic or unlawful*. Customer Materials explicitly include Inputs and Outputs.
   - The consumer Terms (effective 2024-08-18) ban user submissions with *sexually explicit content or pornography* and *extreme violence*.
   - **So T2 text must never be sent to Fish** without a written carve-out.
3. **ElevenLabs is the only major TTS vendor whose current use policy (2026-10-09) does not ban explicit adult audio in its text.**
   - Section 6 bans: *visual* depictions of explicit sexual acts; erotic material involving incest, bestiality or necrophilia; non-consensual intimate content; and gratuitous gore.
   - It also bans creating *harmful emotional dependency* and reserves the right to require prior approval for higher-risk uses.
   - Shared Voice Library voices can have **Live Moderation** turned on, which blocks prohibited text.
   - **Zero Retention Mode** (Enterprise only) can be withdrawn from accounts that an automated system flags for extra moderation.
   - Result: **A\***. Get written confirmation for the 18+ use case.
4. **STT is not neutral either.**
   - **AssemblyAI's AI AUP (effective 2026-01-22, §2.11) bans any Use that depicts or requests sex acts or *engages in erotic chats*.** Transcribing an explicit roleplay call is a prohibited use. AssemblyAI is out for T2.
   - Groq (current Whisper vendor), Soniox (ToS 2026-06-29), Deepgram (Terms 2026-08-06) and ElevenLabs Scribe v2 RT have no explicit ban.
   - Their retention defaults differ sharply:
     - **Deepgram retains and trains by default** unless `mip_opt_out=true`.
     - **Groq and Soniox retain nothing** by default.
5. **Only two S2S vendors are policy-compatible with T2, and both have caveats.**
   - **GPT-Live:** built-in moderation either ends the session (close reason `content`) or cuts the rest of the current assistant speech and emits an `error`.
   - **Qwen Omni** (Alibaba Model Studio; current model `qwen3.8-omni-flash-realtime`): the "Green Net" filter rejects input or output with `400 DataInspectionFailed`. The error-code doc lists it as `DataInspectionFailed/data_inspection_failed`.
   - **Gemini Live:** bound by Google's prohibition.
   - **Grok Voice** is the only big S2S whose AUP permits T2. However, **xAI Custom Voices work only in the United States, excluding Illinois**, so LatAm, Spain and EU users cannot get cloned character voices there.
   - **Eleven Realtime** (ElevenLabs' own S2S model) falls under the ElevenLabs use policy (A\*). Its backup LLMs and its Model Options run under third-party terms, and ZRM works only on the Max variant.
6. **No-training and zero-retention options are common, but the defaults vary.**
   - **Self-serve ZDR:** Groq (Data Controls), xAI (team-wide, Console, "where available": teams on a negotiated Enterprise agreement or in some environments may not see the toggle), Fish (setting toggle under the Customer Agreement, only for services Fish designates ZDR-eligible), Deepgram (`mip_opt_out` per request).
   - **ZDR on Enterprise plans:** ElevenLabs, Cartesia, Inworld.
   - **ZDR by approval:** OpenAI, Anthropic.
   - **No ZDR on the Gemini Developer API:** the paid tier logs prompts and responses for **55 days** for abuse monitoring, and the unpaid tier trains on data and allows human review.
   - **Voice cloning artifacts are not ZDR-eligible** at OpenAI, ElevenLabs, Cartesia or Inworld.
   - **Exception added by fact-check: Google Gemini voice replication** offers a stateless mode. With `store=False`, the API returns an encrypted, client-held `voicekey_...` (7-day TTL) instead of storing the voice profile. Stored `voice_...` profiles have a 1-year TTL.
   - **OpenAI also added "ZDR with Private Safety Processing" and "Private Retention with PSP"** (formerly "Eyes Off"). Neither applies to `/v1/live/sessions` or `/v1/realtime`.
7. **Voice-clone consent is uneven, and Magic Worlds must act as the verifier.**
   - **Verified consent recordings:** only OpenAI (exact consent phrase, Spanish included; 20 voices per org; sales-gated) and Google Gemini 3.8 Flash TTS (exact phrase, speaker-verification match, 200 voices per project) require one.
   - **ElevenLabs** requires verified consent for every v4 clone, limits PVC to your own voice with verification, and blocks "no-go" public-figure voices.
   - **Fish, Cartesia, Inworld, xAI, Qwen and Ultravox** rely on customer warranties or a checkbox. Soniox says outright that it does not verify consent. Soniox now also sells **TTS v2 and voice cloning** under the same ToS (2026-06-29), so this applies to its synthesis too.
   - **OpenAI prompt-to-voice** forbids imitating a named person, public figure *or fictional character*, and forbids children's voices.
8. **Disclosure and provenance duties already apply.**
   - **Anthropic:** consumer chatbots must disclose AI at the start of each session or in the product UI.
   - **Inworld:** automated systems must disclose that people are talking to AI, *unless it is obvious from the context* (AUP).
   - **ElevenAgents:** tell users before access that they are talking to AI, that ElevenLabs and the LLM provider process the call, and that it is recorded if recording is on. Where applicable law requires consent, keep evidence of it for the legal period or **5 years**, whichever is longer.
   - **ElevenLabs STT terms:** a real-time capture notice is required, with the same 5-year record-keeping.
   - **OpenAI TTS:** you must tell end users the voice is AI-generated.
   - **Watermarks:** ElevenLabs watermarks all generated audio. xAI and ElevenLabs forbid stripping provenance signals. MiniMax requires visible "deep synthesis" marks plus non-intrusive identifiers.

---

## 2. Master matrix: verdicts

Columns:

- **(a)** consensual verified-adult explicit sexual fiction (T2), in generated text or synthesized audio, or for STT in transcribed audio.
- **(a-v)** graphic fictional violence (V2).
- **(b)** runtime moderation that truncates audio or ends sessions.
- **(c)** retention defaults and no-training/ZDR options.
- **(d)** voice-clone consent.
- **(e)** disclosure and watermark duties.

Dates are the policy version dates. "fetched" means the page shows no date and was read on 2026-10-20.

### 2.1 STT

| Vendor (policy version) | (a) T2 | (a-v) V2 | (b) Runtime moderation | (c) Retention / training / ZDR | (d) Clone consent | (e) Disclosure / watermark |
|---|---|---|---|---|---|---|
| **Groq** (Whisper; AUP eff. 2025-10-15; Your Data doc, fetched) | **A\***: bans only sexually explicit content *that is illegal*; vague "offensive" catch-all | **?**: "violence" is listed as a prohibited purpose | None documented | Inference not retained by default. Reliability and abuse logs up to 30 days. **ZDR is self-serve for all customers** (Data Controls). Data stored in US GCP | n/a | No deceptive or misleading use |
| **Soniox** (ToS 2026-06-29; Security & privacy doc, fetched) | **A**: no sexual-content clause; generic "harmful/abusive" | **A** | None documented | **Content not stored** unless you use the Async API (auto-deleted after 30 days). **Never used for training.** Content-free metadata kept. (The security page fetched is the STT one; TTS v2 retention was not checked) | Customer must hold all rights and consents; **Soniox does not verify**. The same ToS covers Soniox **TTS v2 and voice cloning** | Disclose synthetic or AI interactions where law requires |
| **AssemblyAI** (AI AUP eff. 2026-01-22; retention doc, fetched) | **P**: §2.11 bans uses that depict or request sex acts, relate to sexual fetishes or fantasies, or *engage in erotic chats* | **?**: bans *unlawful* violence | May monitor use for AUP compliance | Streaming and Sync STT: **ZDR only if opted out of model training** (self-serve Data Controls). Otherwise some files are used for training after PII redaction | Digital replicas must meet consent law | n/a |
| **Deepgram** (Terms 2026-08-06; Your Data doc, fetched) | **?**: no sexual clause, but a sole-discretion "harmful or objectionable" catch-all | **?**: "promotes violence" | None documented | **Default: audio and transcripts are retained and used to train** (MIP). **`mip_opt_out=true` per request means not retained (ZDR)**. Usage metadata kept 90 days | n/a | No impersonation |
| **ElevenLabs Scribe v2 RT** (Use policy 2026-10-09; STT terms 2026-10-09) | **A\***: §6 bans visual explicit acts, incest/bestiality/necrophilia erotica and NCII; it does not cover transcribing adult speech | **A\***: bans gratuitous gore and glorifying serious violence | Reserves right to remove content or suspend | Default retention, plus training unless you opt out (non-Enterprise). **ZRM is Enterprise-only** (`enable_logging=false` on `/v1/speech-to-text/*`) | n/a | **A real-time capture notice must come before speech is captured.** Consent records kept ≥5 years |

### 2.2 LLM APIs (the model that writes the character's lines)

| Vendor (policy version) | (a) T2 | (a-v) V2 | (b) Runtime moderation | (c) Retention / training / ZDR | (e) Disclosure |
|---|---|---|---|---|---|
| **OpenAI API** (Usage Policies eff. 2025-10-29, via Wayback 2026-10-19 (unverified in the 2026-10-20 fact-check: live page 403); Model Spec 2026-08-18) | **P in practice.** The Usage Policies ban only sexual violence, NCII and anything involving minors. But the Model Spec rule *Don't respond with erotica or gore* is **System-level** ("cannot be overridden by developers or users") and covers text **and audio**. "Grown-up mode" is still "exploring". Non-graphic romance (T1) is fine | **?**: extreme gore is barred unless context makes it appropriate | Safety classifiers can error, then block the org (seven-day escalation; GPT-5 family). Use `safety_identifier` to scope enforcement to one user | No training by default. **Abuse logs 30 days.** ZDR and Modified Abuse Monitoring by approval. New: "ZDR with Private Safety Processing" (customer-controlled storage) and "Private Retention with PSP" (fka Eyes Off) | TTS: disclose that the voice is AI. Likeness or voice without consent is barred |
| **Anthropic** (Usage Policy eff. **2026-11-12**, version shown on 2026-10-20; API & data retention doc, fetched) | **P**: bans depicting or requesting sex acts, fetish or fantasy content, and erotic chats | **?**: bars promoting or glorifying graphic violence or gore | "Real-time safeguards" may block outputs | Content not retained by default, except **Covered Models** (Fable/Mythos 5.x: 30 days). ZDR by arrangement. **Flagged chats kept up to 2 years even under ZDR** | **Consumer chatbots must disclose AI at the start of each session or in the UI** (need not name Claude) |
| **Google Gemini API** (Prohibited Use Policy 2024-12-17 [>12 months old, but still current]; Additional Terms eff. 2026-03-23; Abuse monitoring 2026-06-09; Safety settings 2026-10-15) | **P**: sexually explicit content made for pornography or gratification. Exceptions for artistic and similar reasons are at Google's discretion | **?**: bars "violence or incitement"; fiction may qualify for the artistic exception | Adjustable filters default **Off** on 2.5+ models. Core harms are always blocked. **Automated abuse scanning explicitly lists sexually explicit content.** Less restrictive settings "may be subject to review". API clients must not be likely to be accessed by under-18s | **Paid:** no training; prompts and outputs logged **55 days** for abuse monitoring. **Unpaid:** used to improve products, with human review | Must not misrepresent provenance as solely human |
| **xAI / "SpaceXSI"** (AUP eff. 2026-08-14; Enterprise ToS 2026-08-14; Security FAQ, fetched) | **A**: bans only real-person sexual likeness and nudification, pornographic depiction of real persons' likenesses, and sexualizing minors | **A**: bans critically harming human life, not fiction | May throttle or block specific Inputs or Outputs (Enterprise ToS) | **Stored 30 days for auditing, never trained on.** **ZDR is self-serve (where available) and team-wide**; it disables the stateful Responses API, Files, Collections, Batch, deferred completions and voice-agent conversation history | Must be transparent about AI use. **Must not strip provenance metadata or watermarks.** Must flow down an end-user AUP no less protective |
| **Groq-hosted open weights** (Groq AUP 2025-10-15; Service-Specific Terms 2025-11-13; model licenses) | **A\***: Groq bans only illegal sexual content and lets customers request exceptions. **Model licenses overlay:** the Llama 4 AUP bars illegal content incl. "sexual solicitation" and obscene material to minors; the gpt-oss policy only requires following the law | **?**: Groq lists "violence"; the Llama AUP bars content intended to incite violence | None documented | As in the STT row: no retention by default, self-serve ZDR | Llama AUP: do not present outputs as human-generated |
| **Cerebras** (ToS eff. 2024-08-27 [stale]; policies page updated 2024-08-27) | **?**: bars "obscene, pornographic, or other material that would violate any law" (reads as a legality test), plus a sole-discretion "objectionable" catch-all. Third-party model terms apply | **?**: "promotes ... violence" | None documented | **Says it does not store, use or share inputs and outputs**; Service Content not used for training | No impersonation |

### 2.3 TTS

| Vendor (policy version) | (a) T2 audio | (a-v) V2 | (b) Runtime moderation | (c) Retention / training / ZDR | (d) Clone consent | (e) Disclosure / watermark |
|---|---|---|---|---|---|---|
| **ElevenLabs** (Prohibited Use Policy 2026-10-09; Terms 2026-10-09; ZRM doc; v4 page) | **A\***: §6 bans *visual* explicit acts, incest/bestiality/necrophilia erotica and NCII. §3 bans *harmful emotional dependency*. May require prior approval for higher-risk uses | **A\***: bans gratuitous gore and glorifying serious violence | **Live Moderation** on shared Voice Library PVCs (blocks prohibited categories, adds latency). May remove content or suspend. Flagged accounts can lose ZRM | Default: history kept. **Training on your content unless you turn off the Data use toggle**; Enterprise defaults to no training. Backups 30 days after deletion. **ZRM Enterprise-only** (`enable_logging=false`, TTS WS covered); **IVC/PVC not ZRM-eligible** | Living persons need explicit, informed consent. **v4: every clone (IVC or PVC) needs verified consent from the owner.** PVC only for your own voice, with verification. No-go blocklist for prominent public figures. No minors' recordings, no voice recognizable as a real minor | Disclose AI where law requires or where users would be materially misled. **All generated audio is watermarked**; do not remove watermarks to disguise AI. C2PA plus a public classifier |
| **Fish Audio** (**Customer Agreement updated 2026-08-10**; consumer Terms eff. 2024-08-18 [stale]; Privacy 2024-08-28) | **P**: Customer Materials (incl. Inputs and Outputs) must not be *obscene, pornographic or unlawful*. Consumer Terms ban sexually explicit submissions | **P**: consumer Terms ban *extreme violence* | Automated analysis of submissions for abuse and illegal content | Consumer Terms: content may train models. Customer Agreement: licence to improve the Services, **plus a ZDR toggle** (no retention beyond processing, no training) | Customer warrants all consents from identifiable individuals. Docs: only your own voice or a written permission; never a celebrity without permission. **No technical verification** | Must not present output as entirely human; disclosure encouraged |
| **Cartesia** (AUP rev. 2025-07-23; Terms rev. 2024-06-14 [stale]; ZDR doc) | **?**: no sexual clause, but a sole-discretion "objectionable / contradicts our values" catch-all | **?** (literal **P**): bans content that *describes* violent acts against people | None documented | **Inputs, outputs and interactions may train models** unless you opt out (form). **ZDR Enterprise-only** for TTS/STT; not for cloning | Only your own voice or others' with explicit consent; no impersonation incl. celebrities; **no output representing under-18s** | No deceptive content |
| **Inworld** (AUP updated 2025-06-11; Service-Specific Terms 2026-05-14; ZDR doc) | **?**: bars building tools that *may be inappropriate for minors, including ... sexually explicit or suggestive content*. A literal reading bans T2 (and even T1). Inworld markets "social and companions" | **?** (corrected from **A**): the violent-content rules exempt purely fictional contexts, but the separate minors clause also lists *graphic violence, obscenity, or other mature themes* | Automated systems plus human review | Licence to use Input to improve the Services (SST). **ZDR on Enterprise and Enterprise-Trial** across TTS, STT, Inworld-hosted LLMs (not third-party-routed models) and Realtime; cloning samples excluded | IVC form needs a rights confirmation. Impersonation without consent banned | **AI disclosure required unless obvious from context** (corrected from "at all times") |
| **MiniMax** (ToS eff. 2026-03-30) | **P**: bans creating or spreading obscene, pornographic, violent or murderous content | **P** | Not documented (the ToS reserves deletion and suspension) | May use inputs and outputs to improve the Services; no ZDR documented | Not found in fetched docs (open) | **Deep-synthesis duty:** non-intrusive identifiers plus a prominent mark on generated content |
| **Gemini TTS** (Google policy as above; Voice replication doc 2026-09-24; Speech generation 2026-10-12) | **P** | **?** | As Gemini API | As Gemini API (55-day logs, paid tier) | **Consent audio reciting a verbatim statement** (30 locales, Spanish incl.) from the **same adult speaker**, checked by speaker verification. 200 voices per project (shared with prompted voices). Only `gemini-3.8-flash-tts` / `flash-lite-tts`. Stored voices have a 1-year TTL. **Stateless `store=False` voice keys** (client-held, 7-day TTL) avoid server-side storage of the voice profile | SynthID covers Lyria and NotebookLM audio. TTS-API watermarking is **not stated** (?) |

### 2.4 S2S / realtime / half-cascade (the vendor's model writes **and** voices the character)

| Vendor (policy version) | (a) T2 | (b) Runtime moderation | (c) Retention / ZDR | (d) Custom voices / consent | (e) Disclosure |
|---|---|---|---|---|---|
| **OpenAI Realtime / GPT-Live** (as OpenAI; data controls, custom voices, GPT-Live sessions docs, fetched) | **P** (Model Spec covers audio: "erotic or violent visceral noises") | **GPT-Live: some moderation events end the session (`reason: content`); others cut the rest of the current assistant speech and emit `error`.** Realtime: build your own guardrails (transcript monitoring) | `/v1/realtime` and `/v1/live/sessions`: 30-day abuse logs, **ZDR-eligible** (not eligible for PSP or Safety Retention). GPT-Live (`gpt-live-1`) session storage is off by default. In projects that enable it, `store:true` keeps the recording 30 days, with **no public delete endpoint**. **`/v1/audio/voices` (voice creation) is not ZDR** | Recording voices: **consent recording with an exact phrase** (EN/ES and others), sample must match, ≤20 per org, sales-gated. Prompt-to-voice (GPT-Live only, ≤100 per org): **no named person, public figure or fictional character; adult voices only** | TTS AI disclosure. SynthID audio provenance check available |
| **Gemini Live** (Google; Live guide 2026-09-18) | **P** | As Gemini API (filters off by default, abuse scanning, review) | 55-day logs on paid; unpaid tier trains | **Live docs show only prebuilt voices**; replication is documented only for the 3.8 Flash/Flash-Lite TTS models. The current stable Live models are `gemini-3.8-live` and `gemini-3.8-live-extended-thinking`, and their model page documents no voice replication. The Live guide's examples still use `gemini-live-2.5-flash-preview` | Provenance must not be misrepresented |
| **Grok Voice (xAI)** (AUP 2026-08-14; Custom Voices and S2S docs, fetched) | **A** | Not documented for voice. Enterprise ToS lets xAI throttle or block I/O. `force_message` speaks verbatim TTS lines without the model (useful for disclosures) | 30-day audit storage, no training. ZDR self-serve | **Custom Voices only in the US, excluding Illinois.** 30 per team, clip ≤120 s, API creation Enterprise-only. **No consent recording documented** | Do not strip watermarks or provenance; be transparent about AI |
| **Eleven Realtime v1 (Mini/Max)** (ElevenAgents Terms 2026-10-09; Realtime models doc; Guardrails doc) | **A\***: ElevenLabs use policy applies to the ElevenLabs model. **Backup LLMs and third-party Model Options carry their providers' terms "directly between you and that provider"** (?) | Content guardrails are opt-in. When they trigger, **`end_call` is the default**; in streaming mode under 500 ms of audio may play before the block. A `retry` exit exists only in blocking mode, which adds about 200–500 ms per turn | **ZRM: Max only (US/EU); Mini cannot run under ZRM or HIPAA.** Max is not offered in the India or Singapore residency environments. Both models are also reachable through ElevenLabs' OpenAI-compatible Realtime API | Same as ElevenLabs TTS (verified consent) | **Before access, tell users: it is AI; ElevenLabs and the LLM provider process the call; it is recorded if retention is on. Keep consent evidence ≥5 years** |
| **Qwen Omni realtime** (Alibaba Model Studio; error-code doc 2026-10-11; Omni realtime 2026-10-16; voice cloning 2026-10-11) | **P de facto**: the **Green Net** content-safety filter blocks input or output as `400 DataInspectionFailed`. The Alibaba Cloud AUP page did not render (JS shell), so the policy text is unverified | Request-level rejection, plus custom-rule blocks (`CustomRoleBlocked`) | Regions: Singapore and Beijing only. Retention not verified (open) | Voice cloning documented; **no consent rule found** (open) | China-law labelling likely (unverified for the international site) |
| **Ultravox (now Inworld)** (Inworld ToS eff. 2026-10-01 on ultravox.ai; Inworld AUP 2025-06-11) | **?**: under the Inworld AUP, same as the Inworld TTS row | Inworld T&S review; materials flagged for T&S may be analysed | **No training on non-public Materials** except T&S-flagged ones. Calls, messages and recordings stored until deleted through the API | Cloning doc has **no consent rule** (open) | Inworld AUP: AI disclosure required unless obvious from context |

---

## 3. Evidence by vendor (paraphrased, with exact clause locations)

### 3.1 LLM vendors

**OpenAI.**
- **Usage Policies:** effective 2025-10-29. The Wayback snapshot of 2026-10-19 is the latest, and its changelog's newest entry is 2025-10-29.
  - Under *Protect people* they prohibit sexual violence and non-consensual intimate content.
  - Under *Respect privacy* they prohibit using someone's likeness, including their voice, without consent in ways that could confuse authenticity.
  - Under *Keep minors safe* they prohibit underage sexual or violent roleplay and exposing minors to sexual or violent content.
  - **They do not prohibit consensual adult sexual content.**
- **Model Spec (2026-08-18):**
  - The section *Sensitive content in appropriate contexts → Don't respond with erotica or gore* sits at the **System** level, which the spec defines as overridable only by OpenAI system messages, never by developers or users.
  - It covers text, **audio** (it names erotic or violent visceral noises) and visual content.
  - The grown-up-mode note still says OpenAI is *exploring* letting developers and users generate erotica in age-appropriate contexts through the API and ChatGPT.
  - The Under-18 section confirms that adults may get scenes that minors may not ("even if a similar scene would be allowed between consenting adults"). Non-explicit romance is in scope for adults; explicit erotica is not.
  - **Respect real-world ties** is a **Root** rule. It forbids relationships that undermine the user's human ties and cautions against exclusivity. It applies to every companion persona run on OpenAI.
  - **Always use the preset voice** (System) means a voice model must not switch to a different voice by itself.
- **Data controls doc:**
  - No training on API data by default.
  - Abuse logs are kept 30 days.
  - ZDR and Modified Abuse Monitoring require prior approval.
  - "Safety Retention" lets OpenAI re-enable retention and human review for specific customers, with written notice.
  - `/v1/audio/transcriptions` keeps no abuse logs. `/v1/audio/speech` and `/v1/realtime` keep 30 days. `/v1/audio/voices` keeps data until deleted and is **not ZDR**.
  - `/v1/live/sessions` is ZDR-eligible. If `store: true`, recordings are kept 30 days, and there is no public delete endpoint.
- **GPT-Live sessions doc, *Handle moderation*:** the two behaviours listed in §2.4, with a session close reason `content` meaning a safety filter ended the session.
- **Safety classifiers doc:** risk thresholds lead to errors, a warning email, and then loss of model access after about 7 days. `safety_identifier` (or the `OpenAI-Safety-Identifier` header for Realtime) scopes enforcement to individual users.
- **Custom voices doc:** the consent phrases include Spanish. Up to 20 recording-based voices per organization, limited to eligible customers. Prompt-to-voice must not ask to imitate a named person, public figure or fictional character, and children's voices are not allowed.
- **TTS doc:** you must clearly tell end users that the TTS voice is AI-generated.
- **Content provenance doc:** SynthID applies to images *and audio*.

**Anthropic.**
- **Usage Policy, effective 2026-11-12** (shown on 2026-10-20; version history available).
  - The section *Do Not Generate Sexually Explicit Content* bans depicting or requesting sexual intercourse or sex acts, fetish or fantasy content, incest or bestiality, and erotic chats.
  - Separately, it bans promoting, trivializing or glorifying graphic violence and gore.
  - Its fiction carve-out appears only in the impersonation clause (clearly disclosed parody, satire or fiction).
  - Additional guidelines: every consumer-facing chatbot must disclose that users are talking to AI, at minimum at the start of each chat session or in the product interface.
- **API and data retention doc:** conversation content is not retained by default. Covered Models need 30-day retention. ZDR is available by arrangement. **Content flagged by trust-and-safety systems may be kept up to 2 years regardless of ZDR.**

**Google (Gemini API, Gemini TTS, Gemini Live).**
- **Generative AI Prohibited Use Policy** (last modified 2024-12-17):
  - Bans sexually explicit content created for pornography or sexual gratification.
  - Bans "violence or the incitement of violence".
  - Bans deceptive impersonation and misrepresenting provenance as human.
  - Exceptions may be granted for educational, documentary, scientific or artistic reasons, or where public benefit outweighs harm.
- **Gemini API Additional Terms** (effective 2026-03-23):
  - Users must be 18+.
  - No API client directed at, or likely to be accessed by, under-18s.
  - Paid-only in the EEA, Switzerland and the UK.
  - Less restrictive safety settings may need Google's review and approval.
  - Paid tier: no training, limited logging for abuse. Unpaid tier: training and human review.
- **Abuse monitoring page** (2026-06-09): **prompts, context and outputs are kept 55 days**. Automated scanning names sexually explicit content.
- **Safety settings** (2026-10-15): adjustable filters (including `sexually_explicit`) are **Off by default** on 2.5+ models. Child-safety protections are always on.
- **Voice replication** (2026-09-24): consent audio must recite a verbatim statement (Spanish is supported) from the same adult speaker, with speaker verification. 200 voices per project. Supported only on `gemini-3.8-flash-tts` and `gemini-3.8-flash-lite-tts`.

**xAI ("SpaceXSI", SpaceXAI LLC).**
- **AUP** (effective 2026-08-14):
  - Lists as abuse: undressing or nudifying real persons, putting a real person's likeness in a sexual context, deceptive impersonation of a real person, and pornographic depiction of real persons' likenesses.
  - Bans sexualizing children.
  - Bans stripping provenance metadata or watermarks, and failing to be transparent about AI use.
  - **It does not ban consensual adult sexual fiction.**
- **Enterprise ToS** (2026-08-14):
  - Your end-user terms must be no less protective than the AUP.
  - xAI may throttle or block specific inputs and outputs.
  - User content is deleted within 30 days unless agreed otherwise.
  - The de-identified data carve-out does not apply under ZDR.
- **Security FAQ:**
  - Data stored 30 days for audit, never used for training.
  - ZDR is team-wide and self-serve where available, but xAI recommends it only when compliance requires.
  - `safety_identifier` (hashed user id) scopes violations to a user.
- **Custom Voices doc:** US only, excluding Illinois. 30 per team. Clip up to 120 s. API creation is Enterprise-only. Usable on `/v1/tts`, the TTS WebSocket and `/v1/realtime`. No consent-recording step is documented.
- **S2S doc:** `force_message` speaks verbatim TTS without the model.

**Groq.**
- **AUP** (effective 2025-10-15):
  - Bans uses involving CSAM, violence, violent extremism, hate, harassment, NCII *or sexually explicit content that is illegal*.
  - Also bans "illegal, offensive, invasive ... harmful" purposes.
  - Customers with adequate safeguards may request an exception.
- **Your Data:** inference is not retained by default. Reliability and abuse logs may be kept up to 30 days. ZDR is self-serve for all customers.
- **Service-Specific Terms** (2025-11-13): DPA processing for the designated beta model Kimi K2 0905.
- **Llama 4 AUP:** illegal-content list (including sexual solicitation and obscene material to minors without legally required age gating), impersonation without consent, and representing outputs as human-generated.
- **gpt-oss usage policy:** comply with applicable law.

**Cerebras.**
- **ToS** (effective 2024-08-27, stale): bars content that is "obscene, pornographic, or other material that would violate any law", content that promotes hatred, violence or harm, and anything harmful or objectionable at Cerebras' discretion.
- **Policies page** (updated 2024-08-27): says it does not store, leverage or share AI inputs and outputs.
- Third-party model terms apply.

### 3.2 STT vendors

- **Soniox ToS (2026-06-29):**
  - The acceptable-use list covers harmful, deceptive and unauthorized activity, voice cloning without rights, and misleading people about AI. It has no sexual-content clause.
  - The Security & privacy page: no model training, no retention except Async storage (auto-deleted after 30 days), and logs never contain audio or transcripts.
- **AssemblyAI AI AUP (effective 2026-01-22):**
  - **§2.11 Sexually Explicit Content** bans Uses that depict or request sex acts, relate to sexual fetishes or fantasies, depict incest or bestiality, or engage in erotic chats.
  - Violations are a material breach of the ToS.
  - Streaming ZDR applies only when you have opted out of model training.
- **Deepgram Terms (2026-08-06):**
  - §3.2: Deepgram may use your content to train and test its models.
  - §3.3: opt out per request.
  - Users must be 18+.
  - Catch-all for content harmful or objectionable "in our sole discretion".
  - The Your Data doc gives the default-retention and `mip_opt_out` table in §2.1. Full in-region residency needs both a regional endpoint and the opt-out.
- **ElevenLabs Speech-to-Text Terms (2026-10-09):**
  - For real-time transcription, you must disclose before speech is captured that it is being captured and transcribed, and that ElevenLabs and its providers process it.
  - **Keep consent and notice records for the longer of the legal period or 5 years.**
  - Automated redaction features do not alter the stored input.

### 3.3 TTS vendors

- **ElevenLabs:**
  - Use policy, Terms and Service-Specific Terms: all dated 2026-10-09.
  - **ZRM doc:**
    - Enterprise only.
    - Restricted if the use case is high-risk or the account is flagged by automated moderation.
    - IVC and PVC samples are not eligible.
    - Deleted generations persist in backups for up to 30 days.
    - Debugging and moderation logs may keep data even after deletion.
  - **v4 page:** every clone needs verified consent from the voice's owner. Scripts are not used for training without consent.
  - **Cloning FAQ:** PVC only for your own voice. Someone else's voice can be shared to you after *they* verify a PVC.
  - **No-go voices FAQ:** cloning of prominent public figures is blocked.
  - **Watermark FAQ:** watermarks are embedded in all generated audio and add no latency.
  - **Live Moderation FAQ:** shared PVCs can block prohibited text.
- **Fish Audio:**
  - **Customer Agreement (updated 2026-08-10):**
    - §1.5 defines Customer Materials to include Inputs and Outputs.
    - §6.2 makes the customer warrant they are not obscene, pornographic or unlawful, and that it holds consents for any identifiable person's voice.
    - §4.4 sets out the ZDR toggle: no retention beyond processing and no training while it is on. It excludes aggregated data created before enabling, metadata, and third-party integrations.
    - §3.6 lets Fish suspend for breach of §6.2.
  - **Consumer Terms (effective 2024-08-18):** ban sexually explicit submissions, extreme violence and obscene content, and allow training on content.
- **Cartesia:** AUP (2025-07-23) as in the matrix. Terms §(c)/(d): training unless you opt out by form. Users must be 18+ (US residency wording). ZDR doc: Enterprise, TTS and STT inference only.
- **Inworld:** AUP (2025-06-11) as in the matrix. Its minors clause covers sexually explicit or suggestive content *and* graphic violence, obscenity and "other mature themes", which is why V2 is **?** despite the fiction exemption in the violence section. Its disclosure clause bars failing to disclose AI "unless it's obvious from the context". Service-Specific Terms (2026-05-14) cover User Voice Models and an "improve the Services" licence. ZDR doc: Enterprise, covers TTS, STT, hosted LLMs and Realtime; voice cloning samples not eligible.
- **MiniMax:** ToS (effective 2026-03-30) bans obscene, pornographic, violent, murderous, terroristic or criminal-incitement content. It requires deep-synthesis labelling. Inputs and outputs may be used to improve the Services. Rapid clones are deleted if not used within 7 days (Voice Clone API listing).

### 3.4 S2S vendors

These are covered in §2.4 and the vendor notes above. A few additions:

- **ElevenAgents Terms (2026-10-09):**
  - §1.2: an LLM Provider's published terms bind you directly.
  - §3.5: AI, processing and recording disclosure before access. Where law requires consent, keep evidence of it for the legal period or 5 years, whichever is longer. (STT Terms §3.3 applies the same 5-year rule to every notice and consent given under its §3.)
  - §4: ElevenLabs may suspend individual agents or Model Options without notice.
  - Exhibit 2, Speech Engine: ElevenLabs provides only the voice layer, and the LLM and moderation are a "Customer System". In this mode the content risk of the model sits with Magic Worlds' own LLM, while ElevenLabs STT and TTS stay under the use policy.
- **Realtime models doc:** Mini is the default and lowest-cost option, but cannot run under ZRM or HIPAA. Realtime mode cannot use a custom LLM.
- **Guardrails doc:** see the matrix.

---

## 4. Lanes that can legally carry 18+ content (by tier)

| Lane | T0 | T1 romance | T2 explicit | V2 graphic | Notes |
|---|---|---|---|---|---|
| **Current cascade:** Groq Whisper → internal LLM → **ElevenLabs** | ✔ | ✔ | **A\*** if the LLM profile is permissive (xAI or open weights) | A\* | Get written confirmation from ElevenLabs. Enforce §6 hard categories pre-TTS |
| **Current cascade:** Groq Whisper → internal LLM → **Fish** | ✔ | ✔ (the Fish terms do not ban suggestive content) | **✘ P** | **✘ P** (extreme) | Route T2 and V2 sentences away from Fish, or get a carve-out |
| Cascade with OpenAI, Anthropic, Google or MiniMax as the LLM | ✔ | ✔ (Anthropic: avoid erotic chats) | ✘ | ? | Use only for T0/T1 personas |
| Cascade with xAI Grok or open weights (Groq, Cerebras, self-hosted) as the LLM | ✔ | ✔ | ✔ (A / A\*) | ✔ | Best fit for the 18+ lane. Keep your own minors, NCII and real-person filters |
| STT swap to Soniox / Deepgram (opt-out) / ElevenLabs Scribe | ✔ | ✔ | ✔ / ? / A\* | ✔ | **Avoid AssemblyAI for T2** |
| OpenAI GPT-Live / Realtime | ✔ | ✔ | ✘ | ? | Built-in moderation can end paid calls |
| Gemini Live | ✔ | ✔ | ✘ | ? | |
| Grok Voice (S2S) | ✔ | ✔ | ✔ | ✔ | **Cloned voices US-only (no Illinois)**, and Spanish quality is unverified (see r07) |
| Eleven Realtime | ✔ | ✔ | A\* / ? | A\* | Fallback LLMs carry third-party terms. ZRM only on Max |
| Qwen Omni | ✔ | ? | ✘ (Green Net) | ✘ | |
| Ultravox / Inworld | ✔ | ? | ? | ? (fact-check: the minors clause also names graphic violence) | Inworld AUP wording on content inappropriate for minors |

---

## 5. Established best practice (a), current SOTA practice (b), emerging (c), pitfalls (d)

### (a) Established best practice
- Map content tiers to vendor policy *per vendor per role*, and enforce the strictest policy in each lane before text reaches that vendor. In S2S the vendor's own model writes the lines, so you cannot pre-filter. A lane is only as permissive as its strictest component.
- Get a **written confirmation or carve-out** for explicit adult use from every vendor in the T2 lane. Most policies reserve discretion: ElevenLabs's prior-approval clause, Cartesia's and Deepgram's "objectionable" catch-alls, Groq's exception process.
- Isolate enforcement blast radius:
  - send per-user `safety_identifier`s to OpenAI and xAI;
  - use separate vendor accounts, projects or workspaces for T2 traffic, so a suspension does not take down the general product.
- Enable no-training and ZDR wherever it is self-serve: Groq Data Controls, the xAI team-wide toggle, the Fish ZDR toggle, Deepgram `mip_opt_out=true`, AssemblyAI training opt-out, and the ElevenLabs "Data use" toggle on non-Enterprise plans.
- Voice cloning: collect a recorded consent statement from the speaker, verify the speaker matches the sample, attest the speaker is an adult, keep the evidence, and support takedown. OpenAI's and Google's flows are the reference designs (exact consent phrase in the speaker's language, Spanish included). ElevenLabs requires verified consent for v4 clones.
- Disclose AI before the call starts, keep the disclosure in the UI, and repeat it on cadence where state law requires (see r09). Preserve vendor watermarks.

### (b) Current SOTA / leading options
- **Most permissive full stack, by text:** xAI (LLM or S2S) + ElevenLabs (TTS) + Soniox or Groq (STT). All have self-serve or enterprise ZDR, and none bans consensual adult fiction in its policy text.
- **Strongest consent tooling:** OpenAI custom voices (consent phrase plus match, but sales-gated and US-centric voices) and Gemini 3.8 Flash TTS voice replication (consent phrase plus speaker verification, self-serve). Neither may be used for T2.
- **Strongest retention posture:** Soniox (no retention or training by design), Cerebras (claims no storage), and Groq (no default retention plus self-serve ZDR).

### (c) Emerging and experimental
- **Provenance:** OpenAI now exposes a SynthID audio check, and ElevenLabs watermarks all output. Google's SynthID page says its Detector checks images, video and audio from Google and partners including OpenAI, NVIDIA and Kakao, with Apple "soon". Its audio watermarking is still named only for Lyria and NotebookLM podcasts. EU AI Act Art. 50 machine-readable marking is coming (see r09). Expect watermark-preservation duties to spread.
- **Vendor-side "content guardrails" with `end_call` defaults** (ElevenAgents) and session-terminating moderation (GPT-Live). These are moving into S2S stacks and need explicit product handling: refunds, the reconnect UX, and whether quota is charged.
- **Industry consolidation changes the governing terms:** Ultravox is now governed by Inworld's terms (2026-10-01), and xAI's legal pages have been rebranded to SpaceXSI. Re-check policy versions on every vendor change.

### (d) Pitfalls and anti-patterns
- **Assuming Fish accepts adult content.** It does not, under either of its current documents.
- **Picking an STT vendor for latency alone.** AssemblyAI's AUP bans erotic chats, and Deepgram's default retains and trains on call audio.
- **Assuming "filters off" means "allowed".** Gemini's filters default to Off, but the policy still bans the content and abuse scanning looks for it.
- **Relying on OpenAI's Usage Policies text alone.** The Model Spec governs model behaviour, and developers cannot unlock erotica.
- **Counting ZRM or ZDR into the design when it can be revoked.** ElevenLabs can restrict ZRM for accounts flagged for moderation, and OpenAI can impose "Safety Retention". Anthropic keeps flagged content up to 2 years even under ZDR.
- **Using cloned voices on Grok Voice for non-US users.** Not available outside the US, or in Illinois.
- **Letting users upload any "character voice" without a consent recording.** Fish, Cartesia, xAI, Qwen and Ultravox do not verify consent, so liability stays with the operator.
- **Re-encoding or transcoding in a way that strips provenance**, or disabling disclosure because "it's obviously fiction". Anthropic and ElevenAgents require disclosure regardless. Inworld has an "obvious from the context" exception, but a voice call with a human-sounding character is unlikely to qualify.

---

## 6. What remains unverified (and why)

- **ChatGPT consumer "adult mode" status.** openai.com and help.openai.com return 403, and the Internet Archive CDX search was offline. The primary evidence available is the **Model Spec of 2026-08-18**, which still describes grown-up mode as being explored for both API and ChatGPT. That implies it is not generally available. The secondary report that ChatGPT adult mode was paused on 2026-03-26 (justainews / aihaven, cited in r05 and r07) remains **unverified**. The 2026-10-20 fact-check could not settle it either: openai.com still returned 403, and the shared WebSearch quota was exhausted.
- **OpenAI Usage Policies version (2025-10-29):** not re-verified by the fact-check, because the live page returns 403 and archive services were not used for this pass. The Model Spec of 2026-08-18 is still the latest; `model-spec.openai.com/` redirects to it.
- **Alibaba Cloud international AUP text:** the page is a JS shell. Only the Green Net runtime behaviour is verified.
- **xAI Custom Voices consent flow in the Console:** not documented in the API docs. A Console attestation may exist.
- **MiniMax, Qwen and Ultravox voice-clone consent rules:** not present in the fetched docs.
- **Whether Gemini TTS output carries SynthID:** the SynthID page names only Lyria and NotebookLM audio.
- **Whether ElevenLabs would treat explicit adult audio as needing "prior approval"** under its high-risk clause. This needs a written answer.
- **Inworld's intended reading** of "tools inappropriate for minors" for an 18+-gated product.

---

## 7. Sources (all fetched 2026-10-20 unless noted)

**LLM**
- OpenAI Usage Policies, eff. 2025-10-29 (Wayback snapshot 2026-10-19): https://web.archive.org/web/20261019190145/https://openai.com/policies/usage-policies/ (live URL https://openai.com/policies/usage-policies/ returns 403)
- OpenAI Model Spec 2026-08-18: https://model-spec.openai.com/2026-08-18.html
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
- OpenAI GPT-Live sessions (Handle moderation): https://developers.openai.com/api/docs/guides/live-conversations
- OpenAI safety classifiers: https://developers.openai.com/api/docs/guides/safety-checks
- OpenAI custom voices: https://developers.openai.com/api/docs/guides/custom-voices
- OpenAI text to speech (disclosure): https://developers.openai.com/api/docs/guides/text-to-speech
- OpenAI content provenance: https://developers.openai.com/api/docs/guides/content-provenance
- OpenAI voice server controls (guardrails): https://developers.openai.com/api/docs/guides/voice-server-controls
- Anthropic Usage Policy, eff. 2026-11-12: https://www.anthropic.com/legal/aup
- Anthropic API and data retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Google Generative AI Prohibited Use Policy, last modified 2024-12-17 [>12 months; still current]: https://policies.google.com/terms/generative-ai/use-policy
- Gemini API Additional Terms, eff. 2026-03-23: https://ai.google.dev/gemini-api/terms
- Gemini API abuse monitoring, updated 2026-06-09: https://ai.google.dev/gemini-api/docs/usage-policies
- Gemini safety settings, updated 2026-10-15: https://ai.google.dev/gemini-api/docs/safety-settings
- xAI ("SpaceXSI") AUP, eff. 2026-08-14: https://x.ai/legal/acceptable-use-policy
- xAI Enterprise ToS, updated 2026-08-14: https://x.ai/legal/terms-of-service-enterprise
- xAI security FAQ (retention, ZDR): https://docs.x.ai/developers/faq/security
- Groq AUP & Responsible AI Policy, eff. 2025-10-15: https://console.groq.com/docs/legal/ai-policy
- Groq Your Data: https://console.groq.com/docs/your-data
- Groq policies index (last modified 2026-06-22): https://console.groq.com/docs/legal
- Groq Service-Specific Terms, eff. 2025-11-13: https://groq.com/groq-service-specific-terms
- Llama 4 Acceptable Use Policy: https://www.llama.com/llama4/use-policy/
- gpt-oss usage policy: https://github.com/openai/gpt-oss/blob/main/USAGE_POLICY
- Cerebras Terms of Use, eff. 2024-08-27 [stale]: https://www.cerebras.ai/terms-of-service
- Cerebras policies (updated 2024-08-27) [stale]: https://inference-docs.cerebras.ai/support/policies

**STT**
- Soniox Terms of Service, updated 2026-06-29: https://soniox.com/policies/terms-of-service
- Soniox security & privacy: https://soniox.com/docs/stt/security-and-privacy
- AssemblyAI AI Acceptable Use Policy, eff. 2026-01-22: https://www.assemblyai.com/legal/acceptable-use-policy
- AssemblyAI data retention & model training: https://www.assemblyai.com/docs/data-retention-and-model-training
- Deepgram Terms, updated 2026-08-06: https://deepgram.com/terms
- Deepgram Your Data: https://developers.deepgram.com/trust-security/your-data
- ElevenLabs Speech to Text Terms, updated 2026-10-09: https://elevenlabs.io/speech-to-text-terms

**TTS**
- ElevenLabs Prohibited Use Policy, updated 2026-10-09: https://elevenlabs.io/use-policy
- ElevenLabs Terms of Service, updated 2026-10-09: https://elevenlabs.io/terms-of-use
- ElevenLabs Service-Specific Terms, updated 2026-10-09: https://elevenlabs.io/service-specific-terms
- ElevenLabs ElevenAPI Terms, updated 2026-10-09: https://elevenlabs.io/elevenapi-terms
- ElevenLabs Zero Retention Mode: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode
- ElevenLabs v4 (verified consent): https://elevenlabs.io/v4
- ElevenLabs voice cloning FAQ: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning
- ElevenLabs no-go voices: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices
- ElevenLabs data use FAQ: https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models
- ElevenLabs watermarking FAQ: https://elevenlabs.io/docs/help-center/legal/audio-detector/what-is-watermarking-and-why-is-eleven-labs-using-it
- ElevenLabs Live Moderation FAQ: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation
- ElevenLabs safety page: https://elevenlabs.io/safety
- Fish Audio Customer Agreement, updated 2026-08-10: https://fish.audio/enterprise-terms/
- Fish Audio Terms of Service, eff. 2024-08-18 [stale]: https://fish.audio/terms/
- Fish Audio Privacy Policy, eff. 2024-08-28 [stale]: https://fish.audio/privacy/
- Fish Audio voice-cloning best practices: https://docs.fish.audio/developer-guide/best-practices/voice-cloning
- Cartesia Acceptable Use Policy, rev. 2025-07-23: https://cartesia.ai/legal/acceptable-use
- Cartesia Terms, rev. 2024-06-14 [stale]: https://cartesia.ai/legal/terms
- Cartesia Zero Data Retention: https://docs.cartesia.ai/enterprise/zero-data-retention
- Inworld AUP, updated 2025-06-11: https://inworld.ai/aup
- Inworld Service-Specific Terms, updated 2026-05-14: https://inworld.ai/service-specific-terms
- Inworld Zero data retention: https://docs.inworld.ai/portal/zero-data-retention
- Inworld Instant Voice Cloning: https://docs.inworld.ai/tts/instant-voice-cloning
- MiniMax Terms of Service, eff. 2026-03-30: https://platform.minimax.io/docs/guides/terms-of-service
- Gemini voice replication, updated 2026-09-24: https://ai.google.dev/gemini-api/docs/voice-replication
- Gemini speech generation, updated 2026-10-12: https://ai.google.dev/gemini-api/docs/speech-generation
- Google SynthID: https://deepmind.google/models/synthid/

**S2S**
- Gemini Live guide, updated 2026-09-18: https://ai.google.dev/gemini-api/docs/live-guide
- xAI Custom Voices: https://docs.x.ai/developers/model-capabilities/audio/custom-voices
- xAI Speech to Speech (force_message): https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech
- ElevenAgents Terms, updated 2026-10-09: https://elevenlabs.io/agents-terms
- ElevenLabs Realtime models: https://elevenlabs.io/docs/eleven-agents/customization/realtime-models
- ElevenLabs Agents guardrails: https://elevenlabs.io/docs/eleven-agents/best-practices/guardrails
- Alibaba Model Studio error codes (Green Net), updated 2026-10-11: https://www.alibabacloud.com/help/en/model-studio/error-code
- Qwen Omni realtime, updated 2026-10-16: https://www.alibabacloud.com/help/en/model-studio/realtime
- Qwen Omni voice cloning, updated 2026-10-11: https://www.alibabacloud.com/help/en/model-studio/qwen-omni-voice-cloning
- Ultravox / Inworld Terms of Service, eff. 2026-10-01: https://ultravox.ai/terms
- Ultravox voice cloning: https://docs.ultravox.ai/voices/cloning
- Ultravox call management: https://docs.ultravox.ai/agents/call-management

**Internal cross-references:** r04 §3 (TTS policy notes), r05 §2.4, r07 §8, r09 §6.5–6.7, r10 (dual-provider voice twins). Magic Worlds backend: `src/services/speech/moderation.py` (pre-TTS gate; category lists "EMPTY pending the policy sign-off") and `src/services/voice_orchestration/config.py` (`REQUIRED_CONSENT_VERSION = "voice-v2"`, `FISH_CONSENT_VERSION = "voice-v3"`).

---

## 8. Implications for Magic Worlds (prioritized)

**P0: stop the policy breach risk that exists today**

1. **Fish lane: block T2 and V2 now.**
   - Fish's Customer Agreement (2026-08-10) makes Magic Worlds warrant that Inputs and Outputs are not obscene or pornographic. Any explicit sentence synthesized on Fish is a contractual breach and grounds for suspension (§3.6).
   - Add a lane rule to the existing pre-TTS gate in `moderation.py`: classify every sentence into a tier and reject Fish for T2/V2. Either re-route to ElevenLabs (if the voice has a twin) or deny the sentence.
   - Alternatively, ask Fish for a written 18+ carve-out.
   - Turn on Fish's self-serve **ZDR** toggle (§4.4), and check that `voice-v3` consent text names Fish and its no-training status.
2. **Fill the empty moderation lists from vendor hard lines.**
   - The `moderation_lists` category set is "EMPTY pending the policy sign-off". Seed it with the union of the hard prohibitions in the T2 lane:
     - minors and anything that sexualizes them (every vendor);
     - NCII and sexual violence (OpenAI, ElevenLabs, xAI, Groq);
     - incest, bestiality and necrophilia erotica (ElevenLabs §6, Anthropic, AssemblyAI);
     - real-person sexual likeness (xAI, ElevenLabs, OpenAI);
     - gratuitous gore that "revels" in injury (ElevenLabs);
     - voices recognizable as real minors (ElevenLabs).
   - Make the `severe` class map to these.
3. **Pin the call LLM profile by tier.**
   - The callbot graph must resolve to a permissive provider for T2 personas: xAI Grok, or open weights on Groq, Cerebras or self-hosted.
   - Never resolve T2 to OpenAI, Anthropic, Google or MiniMax. Doing so breaches their policy (Anthropic, Google, MiniMax) or produces refusals that break persona (OpenAI's Model Spec is System-level).
   - Record the tier-to-provider mapping in the published profile catalog so ops cannot drift. If Claude is used anywhere in the call path, Anthropic's per-session AI disclosure becomes mandatory.

**P1: retention and consent hygiene**

4. **STT:** Groq is policy-compatible. Turn on **Groq ZDR in Data Controls**: it is self-serve, and call audio is the most sensitive data handled. If moving to streaming STT:
   - prefer **Soniox** (no retention, no training, no content clause);
   - otherwise Deepgram with `mip_opt_out=true` on every request (its default retains and trains);
   - otherwise ElevenLabs Scribe v2 RT (requires the capture notice and 5-year records).
   - **Do not adopt AssemblyAI for calls that can reach T2.**
5. **ElevenLabs:**
   - Get **written confirmation** that verified-adult fictional explicit *audio* is acceptable. The policy bans *visual* explicit content, but it reserves prior approval and has the dependency clause.
   - Turn off the **Data use** training toggle until Enterprise.
   - Plan for ZRM via Enterprise, knowing it can be withdrawn if moderation flags the account. That argues for a dedicated workspace for the 18+ lane.
   - Avoid shared Voice Library voices for 18+ characters, since Live Moderation can block mid-call.
6. **Clone-consent flow, owned by Magic Worlds:**
   - For every user-uploaded character voice, record a **verbatim consent statement in EN or ES**, modelled on the OpenAI/Google phrases, from the same speaker as the sample.
   - Run a speaker-match check, collect an 18+ attestation, block celebrities and public figures, and ban minors.
   - Store the consent audio, the sample and a transcript for **5 years** to match the ElevenLabs Agents/STT record duties.
   - Reasons: Fish, Cartesia, xAI, Qwen, Ultravox and Soniox (which now also offers cloning) verify nothing, and ElevenLabs v4 requires verified consent.
   - If Gemini TTS is ever used for replicated voices, prefer stateless `store=False` voice keys so the biometric profile stays in Magic Worlds' own store.
   - Do not offer "sounds like <named actor/character>" voice design. OpenAI forbids fictional-character imitation, and publicity-rights law (ELVIS Act, see r09) puts the tool provider at risk.
7. **Disclosure and provenance:**
   - Show a pre-call AI disclosure plus a vendor-processing notice that lists STT/LLM/TTS vendors per lane, versioned like `voice-v2`/`voice-v3`. Repeat it in the UI.
   - Keep ElevenLabs watermarks intact. MP3 passthrough is fine; avoid lossy re-encode chains.
   - If MiniMax is ever used, add deep-synthesis labels.

**P2: architecture choices for S2S and half-cascade**

8. **S2S for the 18+ lane: only Grok Voice is policy-compatible, and it cannot carry cloned voices outside the US, or in Illinois.**
   - Keep the 18+ lane on the cascade.
   - OpenAI GPT-Live/Realtime, Gemini Live and Qwen Omni are T0/T1-only "quick stock-voice" options. Their built-in moderation (GPT-Live session termination, Green Net) needs a refund and quota rule and a graceful in-character reconnect message.
   - **Eleven Realtime** is A\* only if the backup LLM chain is pinned to permissive models. ZRM is available only on Max.
   - **Speech Engine** (ElevenLabs voice layer plus your own LLM) keeps policy control with Magic Worlds and is the cleaner "managed voice, own brain" option.
9. **Isolate enforcement blast radius.** Use separate vendor accounts or workspaces for T2 traffic (xAI team, ElevenLabs workspace, Groq org). Send hashed per-user `safety_identifier` to OpenAI and xAI, so one abusive user does not trigger org-level blocks (OpenAI's seven-day escalation).
10. **Re-check on every vendor change.** Since 2026-03 alone: Anthropic's AUP (eff. 2026-11-12), ElevenLabs' full legal set (2026-10-09), Fish's Customer Agreement (2026-08-10), xAI's AUP and ToS (2026-08-14) and Ultravox's move to Inworld terms (2026-10-01) all changed.
    - Add a quarterly policy-diff check, plus a per-vendor `policy_version` field next to the consent version.

---

## Fact-check log (2026-10-20)

**Method:**
- Each claim was re-fetched from the vendor's own page on 2026-10-20 with `curl`, using HTML-to-text or the vendor's `.md` export.
- WebFetch was refused or returned 403 for anthropic.com, x.ai and model-spec.openai.com, so those pages were fetched with `curl` instead.
- WebSearch was unavailable because the shared quota was exhausted. No archive or proxy services were used.

**Corrections applied to the body:**
1. **Inworld V2:** changed from **A** to **?**.
2. **Inworld disclosure:** "at all times" changed to "unless obvious from context".
3. **ElevenAgents 5-year record:** scoped to consent "where applicable law requires" it.
4. **xAI ZDR:** self-serve only "where available".
5. **Qwen error code:** spelling harmonised across sections.

**Additions (newer developments the notes missed):**
- Gemini stateless voice keys, with storage TTLs.
- Soniox TTS v2 and voice cloning.
- OpenAI PSP retention options.
- GPT-Live session storage is off by default.
- Gemini 3.8 Live is the current stable Live model.
- ElevenLabs guardrail `retry` mode and Eleven Realtime regional limits.
- SynthID Detector now checks partners' content.

| # | Claim checked | Verdict | Source |
|---|---|---|---|
| 1 | xAI AUP is branded "SpaceXSI", effective 2026-08-14. It bans real-person sexual likeness, nudification and sexualizing children, plus stripping watermarks; it has no ban on consensual adult fiction | Confirmed (footer reads "SpaceXAI LLC") | https://x.ai/legal/acceptable-use-policy |
| 2 | Anthropic Usage Policy effective 2026-11-12 bans sex acts, fetish content and erotic chats, and requires consumer chatbots to disclose AI | Confirmed. Added that the effective date is still in the future | https://www.anthropic.com/legal/aup |
| 3 | OpenAI Model Spec 2026-08-18: "Don't respond with erotica or gore" is **System** level, covers audio ("visceral noises"), and grown-up mode is still "exploring". "Respect real-world ties" is Root and "Always use the preset voice" is System | Confirmed. The spec root redirects to 2026-08-18, so no newer spec exists | https://model-spec.openai.com/2026-08-18.html |
| 4 | OpenAI data controls: `/v1/audio/voices` is not ZDR and keeps data until deleted. `/v1/realtime` and `/v1/live/sessions` have 30-day abuse logs and are ZDR-eligible. `store:true` keeps 30 days with no delete endpoint. Safety Retention exists | Confirmed. Added: storage is off by default, plus the new PSP options | https://developers.openai.com/api/docs/guides/your-data |
| 5 | GPT-Live moderation either ends the session (`reason: content`) or cuts the current speech and emits `error` | Confirmed | https://developers.openai.com/api/docs/guides/live-conversations |
| 6 | OpenAI custom voices: exact consent phrase, at most 20 recording-based voices per org, eligible customers only. Prompt-to-voice: up to 100, no named person, public figure or fictional character, adults only, not ZDR | Confirmed | https://developers.openai.com/api/docs/guides/custom-voices |
| 7 | OpenAI safety classifiers: about a seven-day escalation for GPT-5; `OpenAI-Safety-Identifier` header for Realtime | Confirmed | https://developers.openai.com/api/docs/guides/safety-checks |
| 8 | Gemini voice replication: `gemini-3.8-flash-tts` and `-flash-lite-tts`, verbatim consent in 30 locales (Spanish included), same adult speaker with speaker verification, 200 voices per project | Confirmed. Added: stateless `store=False` keys (7-day TTL), 1-year TTL for stored voices, and the 200-voice limit is shared with prompted voices | https://ai.google.dev/gemini-api/docs/voice-replication |
| 9 | Gemini API abuse monitoring keeps prompts, context and outputs **55 days**, and automated scanning names sexually explicit content | Confirmed (page last modified 2026-06-09) | https://ai.google.dev/gemini-api/docs/usage-policies |
| 10 | Gemini adjustable safety filters are **Off** by default on 2.5+ models | Confirmed (page last modified 2026-10-15) | https://ai.google.dev/gemini-api/docs/safety-settings |
| 11 | Google Prohibited Use Policy last modified 2024-12-17 (sexually explicit content for gratification; artistic exceptions). Gemini API Additional Terms effective 2026-03-23 (18+; less restrictive settings may need review) | Confirmed | https://policies.google.com/terms/generative-ai/use-policy ; https://ai.google.dev/gemini-api/terms |
| 12 | Gemini Live documents only prebuilt voices | Confirmed. Added: current stable `gemini-3.8-live` and `-extended-thinking`; no replication on their model page | https://ai.google.dev/gemini-api/docs/live-guide ; https://ai.google.dev/gemini-api/docs/models |
| 13 | ElevenLabs use policy updated 2026-10-09. §6 bans *visual* explicit acts, incest/bestiality/necrophilia erotica, NCII and gratuitous gore. §3 bans harmful emotional dependency. It reserves prior approval | Confirmed | https://elevenlabs.io/use-policy |
| 14 | ElevenLabs ZRM is Enterprise-only, `enable_logging=false`, covers the TTS WebSocket, excludes IVC/PVC, keeps backups 30 days, and can be restricted for flagged accounts | Confirmed | https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode |
| 15 | Eleven v4: every clone (IVC or PVC) needs verified consent from the owner | Confirmed (FAQ and safety text on the v4 page) | https://elevenlabs.io/v4 |
| 16 | Eleven Realtime v1 Mini/Max: Mini is the default and cheapest; Mini cannot run under ZRM or HIPAA; Realtime mode cannot use a custom LLM; it falls back to backup LLMs | Confirmed. Added: Max is not offered in India or Singapore residency, and both are reachable through the OpenAI-compatible Realtime API | https://elevenlabs.io/docs/eleven-agents/customization/realtime-models |
| 17 | ElevenLabs guardrails: `end_call` is the default, and under 500 ms of audio may leak in streaming mode | Confirmed. Added: `retry` is blocking-mode only and adds about 200–500 ms | https://elevenlabs.io/docs/eleven-agents/best-practices/guardrails |
| 18 | ElevenAgents §3.5 disclosure and 5-year consent records; STT Terms §3.2 capture notice and §3.3 5-year records (both 2026-10-09) | Corrected (scope): the ElevenAgents 5-year rule applies to consent "where applicable law requires" it | https://elevenlabs.io/agents-terms ; https://elevenlabs.io/speech-to-text-terms |
| 19 | Fish Customer Agreement updated 2026-08-10: §1.5 Customer Materials include Inputs and Outputs; §6.2 not "obscene, pornographic or unlawful"; §4.4 ZDR toggle; §3.6 suspension. Consumer Terms (2024-08-18) ban sexually explicit content and extreme violence, and allow training | Confirmed. Added: ZDR covers only services Fish designates ZDR-eligible | https://fish.audio/enterprise-terms/ ; https://fish.audio/terms/ |
| 20 | AssemblyAI AI AUP effective 2026-01-22, §2.11 bans erotic chats and sex acts | Confirmed | https://www.assemblyai.com/legal/acceptable-use-policy |
| 21 | Deepgram Terms updated 2026-08-06 (§3.2 training licence, §3.3 per-request opt-out, 18+). Your Data doc: MIP retains and trains by default; `mip_opt_out=true` retains only for processing; metadata kept 90 days | Confirmed | https://deepgram.com/terms ; https://developers.deepgram.com/trust-security/your-data |
| 22 | Soniox ToS 2026-06-29 has no sexual clause and states it does not verify consent. Security page: no training; nothing stored except Async (30 days) | Confirmed. Added: the ToS now also covers Soniox TTS v2 and voice cloning | https://soniox.com/policies/terms-of-service ; https://soniox.com/docs/stt/security-and-privacy |
| 23 | Groq AUP effective 2025-10-15 bans only *illegal* sexually explicit content and offers exceptions. Your Data: no retention by default, logs up to 30 days, ZDR for all customers, data in US GCP | Confirmed | https://console.groq.com/docs/legal/ai-policy ; https://console.groq.com/docs/your-data |
| 24 | xAI Custom Voices: US only (no Illinois), 30 per team, clip up to 120 s, API creation Enterprise-only. Security FAQ: 30-day audit storage, no training, team-wide self-serve ZDR; `force_message` exists | Confirmed. ZDR is self-serve "where available" | https://docs.x.ai/developers/model-capabilities/audio/custom-voices ; https://docs.x.ai/developers/faq/security ; https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech |
| 25 | Anthropic retention: Covered Models (Fable/Mythos 5 and 5.1) need 30 days; flagged content kept up to 2 years even under ZDR | Confirmed | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention |
| 26 | Qwen Omni: Green Net `400 DataInspectionFailed`; Singapore and Beijing regions only | Confirmed. Current model is `qwen3.8-omni-flash-realtime` | https://www.alibabacloud.com/help/en/model-studio/error-code ; https://www.alibabacloud.com/help/en/model-studio/realtime |
| 27 | Inworld AUP (2025-06-11): the minors clause makes T2 ambiguous; violence exempts fiction (V2 = **A**); "mandatory AI disclosure at all times" | **Corrected:** V2 changed to **?** because the minors clause also names graphic violence and mature themes; disclosure is required "unless it's obvious from the context" | https://inworld.ai/aup |
| 28 | Inworld ZDR is Enterprise-only and excludes cloning samples | Confirmed. Added: Enterprise-Trial plans also qualify; LLM ZDR covers only Inworld-hosted models | https://docs.inworld.ai/portal/zero-data-retention |
| 29 | Ultravox is now governed by Inworld ToS effective 2026-10-01 | Confirmed (Ultravox acquired by Inworld) | https://ultravox.ai/terms |
| 30 | Cartesia AUP rev. 2025-07-23 and Terms rev. 2024-06-14. ZDR is Enterprise-only, TTS/STT inference only, and excludes cloning | Confirmed | https://cartesia.ai/legal/acceptable-use ; https://cartesia.ai/legal/terms ; https://docs.cartesia.ai/enterprise/zero-data-retention |
| 31 | MiniMax ToS effective 2026-03-30 bans obscene, pornographic and violent content | Confirmed | https://platform.minimax.io/docs/guides/terms-of-service |
| 32 | SynthID audio covers only Lyria and NotebookLM; Gemini TTS watermarking is not stated | Confirmed. Added: the Detector also checks partner content (OpenAI, NVIDIA, Kakao) | https://deepmind.google/models/synthid/ |
| 33 | Cerebras says it does not store, use or share AI inputs and outputs (policies updated 2024-08-27) | Confirmed | https://inference-docs.cerebras.ai/support/policies |
| 34 | OpenAI Usage Policies effective 2025-10-29 | Unverified in this pass: the live page returns 403 and archives were not used | https://openai.com/policies/usage-policies/ |
| 35 | ChatGPT consumer "adult mode" paused on 2026-03-26 | Unverified: no primary source reachable and the WebSearch quota was exhausted | n/a |
