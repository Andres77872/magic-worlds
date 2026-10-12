# Gap closure: voice catalog API semantics, Default-voice expiry, previews and webhooks

Date: **2026-10-12**. Read-only research. No code, configuration or other note was changed. No API key was used and no paid endpoint was called.

**Scope.** This note closes the critic gaps in [09_research_critic_gaps.md](./09_research_critic_gaps.md) that concern the ElevenLabs voice catalog:
- **G2**: Voice Library API semantics.
- **G3**: previews.
- **G4**: disappearing voices.
- **G5**: Default-voice facts, from public sources only. The account-specific half of G5 needs the production key and is listed as a test in §9.

It also settles contradictions **C1, C10, C12, C13 and C16**. Evidence comes from:
- the live ElevenLabs docs, API reference, help center, changelog and legal pages;
- the OpenAPI spec at `https://api.elevenlabs.io/openapi.json`;
- the official Python and JS SDK source, and the official MCP server;
- community threads, where the docs are silent;
- a small set of **unauthenticated** live probes of public endpoints (§11 discloses their scope).

The note ends with a **paid staging test plan** (§9) and the **implications for the catalog design** (§10). It builds on [03_elevenlabs_voices_catalog_cloning_design.md](./03_elevenlabs_voices_catalog_cloning_design.md) and [08_voice_data_model_migration_surface.md](./08_voice_data_model_migration_surface.md) and does not repeat them.

**Evidence tags**

| Tag | Meaning |
|---|---|
| `[verified: url]` | Read on an official ElevenLabs page, or in the official SDK, MCP or OpenAPI source, on 2026-10-12. |
| `[verified: live probe]` | Seen in an unauthenticated request to a public ElevenLabs endpoint on 2026-10-12, between 11:15 and 11:40 UTC. §11 lists the requests. |
| `[secondary: url]` | Community forum, third-party issue tracker or search summary. |
| `[inference]` | Reasoned from verified facts, but not stated anywhere. |
| `[unverified]` | Not confirmed. A test or a written answer from ElevenLabs is needed. |

**Confidence** (on each answer): **High** means documented or directly observed. **Medium** means consistent indirect evidence, or official pages that partly conflict. **Low** means a single secondary source or inference. **Unknown** means no usable evidence.

To respect copyright, ElevenLabs page text is paraphrased. There is one short verbatim quote; everything else links to its source.

---

## 0. Answers at a glance

| # | Question | Answer | Confidence |
|---|---|---|---|
| 1a | Do Default (premade) voices expire on 2026-12-31? | **Yes.** They expire on 31 Dec 2026 and are inaccessible afterwards. | High |
| 1b | Do accounts created after March 2026 get them? | **No.** Only accounts created before March 2026 have them. | High |
| 1c | What replaces them? | 19 named **Voice Library** voices. 16 of their ids were confirmed as `high_quality` library voices with `notice_period = 4015` days, `free_users_allowed=true`, no live moderation and `rate 1.0`, all from one public owner (§1.2). | High (ids, properties) / Medium (owner is ElevenLabs) |
| 1d | What happens to API calls with a Default id after expiry? | **Not documented.** Legacy voices were auto-routed to replacements; no such promise exists for Default voices. Assume failure or a silent voice change. | Unknown |
| 2a | Can TTS use a library `voice_id` without adding it? | **Not documented.** The web UI can. Community reports say the API needs an add. Moot for us: we always add (§2.1). | Low |
| 2b | Does `POST /v1/voices/add/{public_user_id}/{voice_id}` return a new id? | **Not documented.** The evidence leans towards a *different* id (the copy model, `original_voice_id`, an SDK issue). Store both ids. | Low–Medium |
| 2c | Does adding use a slot? | **No.** | High |
| 2d | Does adding use a monthly voice add/edit operation? | **Ambiguous.** The help center calls adding and editing "voice operations", but frames them as creating or editing a voice. Budget 1 op per add until tested. | Low |
| 2e | Can a deleted library copy be re-added? | **No**, if the source left the Library or the copy was deleted during a notice period. If the source is still listed, probably yes, but the re-add **picks up the owner's current terms** (live moderation, free-user exclusion). | High / Medium |
| 2f | Free tier? | Library voices are **not usable via the API on the free tier**. | High |
| 3 | Which voices can be remixed? | Owned IVC, PVC and Design voices, voices with explicit permission, and **Library voices with an infinite notice period**. Default voices appear in an example but expire. Remixing costs the preview-script characters. The output is a **new voice** (new id, one custom slot). | Medium–High |
| 4a | Preview URL lifetime? | GCS objects are long-lived static files (`max-age=3600`). On the API-preview URL the payload is **unsigned** and its hourly timestamp is **not enforced**: timestamps from −365 d to +30 d all returned the same bytes. | High (observed) / Unknown (guarantee) |
| 4b | May we cache or re-host previews? | **Not addressed by the terms.** The ToS reserves rights, and the PUP bars "mirroring" and scraping without consent. Caching within the upstream `Cache-Control` (1 h) is defensible. Persistent re-hosting needs written confirmation. | Medium (risk) |
| 4c | `verified_languages[].preview_url`? | One preview per (language, model, accent). Most are distinct audio per model and deterministic. One `eleven_v4` entry reused the voice's generic preview. | High (observed) |
| 5a | Notice period semantics | 30 days to 2 years, or none. Owners can lengthen but never shorten. Access is kept for users who added (VLA) or used (help center) the voice. ElevenLabs may remove any voice at any time. | High |
| 5b | API fields | `sharing.notice_period` (days), `sharing.disable_at_unix` (null or absent when no removal is pending), `sharing.status`, and `min_notice_period_days` (validator 0–4015). | High |
| 5c | Webhooks | Events `voice_removal_notice`, `voice_removal_notice_withdrawn` and `voice_removed`, via the workspace subscription `voice_library_removal_notice`. The **payload schema is undocumented** beyond `{type, event_timestamp, data}`. Signed with HMAC-SHA256 (§5.3). Retries are documented only for agent events. | High / Unknown (payload) |
| 6a | `generated_voice_id` lifetime | **Not documented.** | Unknown |
| 6b | Design cost | Charged once per call for the preview-text characters (100–1,000), for three previews. | High (rule) / Low (USD rate) |
| 6c | Voice ops per month | Free 55, Starter 65, Creator 95, Pro 290, Scale 1,040, Business 1,040, Enterprise unlimited. | High |
| 7 | Pagination and rate limits for a nightly sync | `/v2/voices`: cursor, `page_size` ≤ 100, `voice_ids` ≤ 100. `/v1/shared-voices`: offset `page`, `page_size` ≤ 100. **No per-endpoint rate limits are published.** A 500-voice sync is under 15 requests. | High / Unknown (limits) |

---

## 1. Default (premade) voices (G5, C1)

### 1.1 The announcement

- The help center says: "All our Default voices will expire on December 31, 2026". After that date they are no longer accessible. Only accounts created **before March 2026** have them. ElevenLabs presents the replacements as permanent voices [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices] [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices].
- The Voices overview repeats the warning [verified: https://elevenlabs.io/docs/overview/capabilities/voices].
- **There is no changelog entry for it.** All 99 changelog entries from 2024-10-13 to 2026-10-05 were searched; none mentions the Default-voice retirement [verified: https://elevenlabs.io/docs/changelog/llms.txt]. A LiveKit community thread dates the announcement email to about **4 March 2026** [secondary: https://community.livekit.io/t/new-default-elevenlabs-voices/459].
- Default voices need no "add". For accounts that have them, they appear in voice menus and in `GET /v2/voices` (filter `voice_type=default`) [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices] [verified: https://elevenlabs.io/docs/api-reference/voices/search].
- **How to tell whether an account is eligible.** `GET /v1/user` returns `created_at`, the account's creation time in Unix seconds. It is 0 for accounts created before the field existed [verified: https://api.elevenlabs.io/openapi.json, schema of `GET /v1/user`]. Accounts with `created_at` ≥ 2026-03-01 should have no Default voices [inference].
- **The exact cut-off instant is not stated.** The page does not say whether access ends at the start or the end of 31 December, or in which time zone [unverified]. Plan for **2026-12-30 00:00 UTC**.

### 1.2 What replaces them (official ids and their properties)

The help page links every old and new voice through ElevenLabs' mail redirector. Each link resolves to `elevenlabs.io/app/voice-library?search=<voice_id>`. Resolving the links on the official page gives the ids below [verified: links on https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices, resolved 2026-10-12].

Properties of the new voices come from unauthenticated `GET /v1/shared-voices` probes [verified: live probe]. Every new voice found had these properties:
- `category: high_quality`;
- `notice_period: 4015`;
- `free_users_allowed: true`;
- `live_moderation_enabled: false`;
- `rate: 1.0`;
- public owner `64cbc624eb5aab4e95a968e1f41d75402277cca6e549036ed17e56ea33bbbc9e`;
- added to the Library between 2026-02-26 and 2026-03-02.

| Old Default | Old id | Replacement (as named on the help page) | New id | Probe result |
|---|---|---|---|---|
| Roger | `CwhRBWXzGAHq8TQ4Fs17` | Darian - Warm Grounded Storyteller | `gOupLcAkjEnguROwi4oS` | found; es verified on v2-family models |
| Sarah | `EXAVITQu4vr4xnSDxMaL` | Talia - Warm Soft Guide | `OZ0L6eISlOejga3XjDFt` | found; es verified |
| Laura | `FGY2WhTYpPnrIDTdsKH5` | Elara - Crisp Pro Narrator | `WQP7cQUF5aAS6Axh5yaa` | found; es verified (Flash/Turbo) |
| Charlie | `IKne3meq5aSn9XLyUdCD` | Baxter - Dry Calm Aussie | `jSuBIjxMKhqIfb0wCK1F` | found; es verified |
| George | `JBFqnCBsd6RMkjVDRZzb` | Eldrin - Crisp British Baritone | `6WwXjDDEMyNmFG95zycZ` | found; es verified |
| Callum | `N2lVS1w4EtoT3dr4eOWO` | Kellan - Casual Friendly Speaker | `cymHWdiF8WjUCg6vvFxx` | found, but the Library **now names this id "Vane - Rugged and gravelly"** |
| River | `SAz9YHcvj6GT2YYXdXww` | Elowen - Upbeat Modern Narrator | `dvbL7qkNGZY1IqPGZAjM` | found |
| Harry | `SOYHLrjzK2X1ezoPC6cr` | Kaelen - Amateur Warrior | `10NkTYmU7tSz3Kkl3Lex` | found |
| Liam | `TX3LPaxmHKxFdv7VOQHJ` | Lawrence - Bright and Informative | `ktkP7Nsj67dw2zcplQYt` | found |
| Alice | `Xb7hH8MSUJpSbSDYk0k2` | Alicia - Polished Global Anchor | `BFd5oBc2DDna33pSi4Gf` | not reached by the 3-result probe |
| Matilda | `XrExE9yKIg1WjnnlVkGX` | Maisie - Friendly Casual Neighbor | `QtY3JBOUKEB5xzrRfOKc` | found; es verified (multilingual_v2) |
| Will | `bIHbv24MWmeRgasZH58o` | Warren - Effortless and Cool | `7QN34D2r3hCNwbOYIeK0` | not reached |
| Jessica | `cgSgspJ2msm6clMCkdW9` | Jade - Upbeat and Natural | `g7LVvkPWALzPxOQbF6OE` | found |
| Eric | `cjVigY5qzO86Huf0OWal` | Eddie - Helpful and Comforting | `l7kNoIfnJKPg7779LI2t` | found, now named **"Eddie - Natural and Helpful"** |
| Chris | `iP95p4xoKVk53GoZ742B` | Caleb - Trusted Guide | `AaOhDHYJ1XLZk74lXhdE` | found |
| Brian | `nPczCjzI2devNBz1zQrb` | Sawyer - Midnight Storyteller | `8dEUmyPMdDdK91vboYih` | found |
| Daniel | `onwK4e9ZLuTAKqWW03F9` | Finley - Articulate Anchor | `fnYMz3F5gMEDGMWcH1ex` | found |
| Lily | `pFZP5JQG7iQjIQuC4Bku` | Florence - Atmospheric Storyteller | `22N9cF8z0o7y23njdyaY` | not reached |
| Bill | `pqHfZKP75CvOlQylNhV4` | Wyatt - Seasoned Mentor | `FrS6cKLB1wg4WYgPa9GW` | found |

What this tells us:
- **The replacements are ordinary Voice Library voices,** so the rules in §2 (add, free tier, notice period) apply to them. A community thread reached the same conclusion in March 2026 [secondary: https://community.livekit.io/t/new-default-elevenlabs-voices/459].
- **"Infinite" or "perpetual" notice is very likely `4015`.** Owners can pick at most 2 years (730 days) [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period]. The API's `min_notice_period_days` validator accepts **0–4015**. Over the whole Library, `min_notice_period_days=731` and `=4015` both return the same **296** voices, and 291 of them belong to the owner above [verified: live probe]. The Voice Library Addendum says the Library contains voice models provided by ElevenLabs itself as well as user voices [verified: https://elevenlabs.io/vla]. That this owner is ElevenLabs itself is **[inference]** (Medium). That 4015 is how the API encodes "infinite" is **[inference]** (Medium–High).
- **Not every voice from that owner is perpetual.** In the probe, 29 of its 105 voices had `notice_period` 730 and two had 180 or 90 [verified: live probe]. Filter on `notice_period >= 4015`, not on the owner.
- **None of the 16 confirmed replacements lists `eleven_v4` in `verified_languages`.** Six list Spanish (`es`), only on v2-family models [verified: live probe]. Because of the v4 audition rule (G7), Default replacements are not automatically good narration voices for magic-worlds.
- **Names drift.** Two ids no longer carry the name the help page gives them. The VLA lets ElevenLabs rename shared voices at its discretion [verified: https://elevenlabs.io/vla]. Key everything on ids and keep our own display names.

### 1.3 Migration guidance ElevenLabs gives

- Test the replacements before 31 December 2026. They are not a 1-to-1 match, and tone and style may differ [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices].
- For more control, create your own voices with Voice Design, Voice Remixing, IVC or PVC [verified: same page].
- **The official samples still use expiring Default ids.**
  - The API quickstart uses George, `JBFqnCBsd6RMkjVDRZzb` [verified: https://elevenlabs.io/docs/eleven-api/quickstart].
  - The remix quickstart remixes George [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/remix-a-voice].
  - The official MCP server defaults to Jessica, `cgSgspJ2msm6clMCkdW9` [verified: https://github.com/elevenlabs/elevenlabs-mcp/blob/c6dc1688ead5e0e67cdcaa5e336bed647019340c/elevenlabs_mcp/server.py#L60].
  - Never copy a voice id from a sample.

### 1.4 What happens to API calls on a Default id after expiry

- **Not documented** (Unknown). The pages say only that the voices will no longer be accessible.
- **Precedent from Legacy voices.** Legacy voices (older Defaults) were removed and their API ids route automatically to replacements [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices]. Two pages show the routing table was **re-pointed** over time:
  - an older page maps Clyde→Harry, Domi→Laura, Drew→Bill, Freya→Matilda and James→Daniel, all of which are now expiring Defaults [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-are-voices-updated-changed];
  - the current Legacy page maps the same voices to Kaelen, Elara, Wyatt, Maisie and Finley, the new perpetual voices [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices].
  - ElevenLabs therefore **can** route old ids to new voices. It has not promised to do so for Default voices.
- **Either outcome is a defect for us.** One possibility is an error: `voice_not_found` (404) or `voice_access_denied` (403) [verified: https://elevenlabs.io/docs/eleven-api/resources/errors]; which one is [unverified]. The other is a **silent switch to a different voice**. Both break character consistency. Treat any Default id as unusable after 2026-12-30.

### 1.5 Resolution of C1

**Claim B wins.** Never publish, map to, or default to a Default (premade) voice:
- they expire about 11 weeks from today;
- a post-March-2026 account has none;
- post-expiry behavior is undocumented.

What 01 §18.2 item 2 (line 1186), 05 §6.5 and §11.6 (lines 563 and 1047), 06 §11.5 (`/v2/voices?category=premade` for `/voice-presets/system-voices`) and 07 §7.1 ("Default ElevenLabs voices" copy) were reaching for should be re-read as follows:
- **"ElevenLabs perpetual library voices"**: `notice_period >= 4015`, owner-curated, `free_users_allowed`, no live moderation, `rate 1.0`. These include the official Default replacements.
- **plus our own designed and remixed voices.**
- The user-facing copy should say "House voices" or "Curated voices", never "Default ElevenLabs voices".

---

## 2. Voice Library via the API (G2, C10)

### 2.1 TTS by `voice_id` of a shared voice that was never added

| Evidence | Says | Tag |
|---|---|---|
| Voice Library guide | The **web app** can use Library voices without saving them. Using a voice records its notice period for the account. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] |
| TTS API reference | `voice_id` is described only as the id of the voice to use. It says nothing about Library voices. | [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert] |
| API pricing FAQ | Any voice in "your library" can be referenced by id. Ambiguous: probably means My Voices. | [verified: https://elevenlabs.io/pricing/api] |
| Free tier | Library voices are not available via the API on the free tier. This implies some form of paid API use exists [inference]. | [verified: https://elevenlabs.io/docs/overview/capabilities/voices] |
| LiveKit thread (March 2026) | A LiveKit team member reported that paid users cannot use a Library voice until they add it to their library. | [secondary: https://community.livekit.io/t/new-default-elevenlabs-voices/459] |
| Vapi and Retell support threads | Both advise adding the voice first to fix "voice not found". | [secondary: https://support.vapi.ai/t/26977579/voice-not-found] [secondary: https://community.retellai.com/t/when-adding-a-voice-resource-not-found/728] |
| Official MCP server | Its TTS tool calls `voices.get(voice_id)` before synthesizing, which presumably resolves only voices visible to the account [inference]. Its Library search tool has no "add" step. | [verified: https://github.com/elevenlabs/elevenlabs-mcp/blob/c6dc1688ead5e0e67cdcaa5e336bed647019340c/elevenlabs_mcp/server.py#L255-L300] |

**Answer.** It is **undocumented** for the API. Secondary evidence leans towards "an add is required" (Low).

**It does not matter for the design. Always add**, for three reasons:
1. The VLA keeps notice-period access for users who *added* the voice before removal. The help center also covers users who merely used it, but the VLA is the contract [verified: https://elevenlabs.io/vla] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period].
2. **Adding locks in the owner's terms at that moment.** A later change to Live Moderation applies only to users who add the voice after the change [verified: https://elevenlabs.io/vla]. "Exclude free users" likewise affects only new additions [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library].
3. The added copy appears in `GET /v2/voices` with `sharing.disable_at_unix`, which the nightly sync needs.

### 2.2 Does the add call return a new `voice_id`?

The reference returns `{voice_id}`. The example request path uses `21m00Tcm4TlvDq8ikWAM` and the example response returns `b38kUX8pkfYO2kHyqfFy`, but both are placeholders [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/share]. The SDK method `voices.share` adds nothing [verified: https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/voices/client.py#L436-L485].

| Evidence for "a new id" | Evidence for "same id" |
|---|---|
| Voice objects carry `sharing.original_voice_id` and `sharing.status` values `copied` and `copied_disabled` [verified: https://elevenlabs.io/docs/api-reference/voices/get]. | Users report generating with the ids they see in the Library [secondary: LiveKit thread above]. |
| The docs call added voices "library copies" (`voice_type=non-community` excludes them) [verified: https://elevenlabs.io/docs/changelog/2026/4/13]. | `is_bookmarked` is documented as relevant only to community (library-copied) voices, and the add call takes `bookmarked`. Adding may be a per-user bookmark on the same voice [verified: https://elevenlabs.io/docs/api-reference/voices/get] [inference]. |
| An SDK issue (January 2025): re-adding returned 400 `voice_already_cloned`, yet `voices.get(<library id>)` returned `voice_not_found`. That fits a copy stored under a different id [secondary: https://github.com/elevenlabs/elevenlabs-python/issues/454]. | |

**Answer.** Unknown, leaning towards "may differ" (Low–Medium). **Store both ids**: `provider_voice_id` (returned by the add call, used for synthesis) and `library_voice_id` + `public_owner_id` (used for Library lookups and re-adds). Settle it with staging test T3.

### 2.3 Slots and monthly voice operations

- **Slots: no.** Library voices saved to My Voices do not use custom voice slots. Only Voice Design and Voice Cloning voices do [verified: https://elevenlabs.io/docs/overview/administration/billing] [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it].
- **Operations: ambiguous.**
  - The slot page says adding and editing voices are voice operations, with a monthly quota.
  - The quota page describes operations as creating a new voice or editing an existing one [verified: https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices].
  - Saving a Library voice is neither clearly creating nor editing.
  - `GET /v1/user/subscription` exposes `voice_add_edit_counter` and `max_voice_add_edits`, so test T3 can settle it [verified: https://elevenlabs.io/docs/api-reference/user/subscription/get].
  - **Budget 1 op per add.** A 100-voice library import then costs 100 of Pro's 290 monthly ops.

### 2.4 Re-adding after delete

- **Source removed from the Library:** a deleted copy can **never** be saved again [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it].
- **Copy deleted during an active notice period:** it cannot be saved again either, because the voice is no longer in the Library [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period].
- **Source still listed:** re-adding is very likely possible, because the voice is still in the Library [inference]. The cost:
  - the re-add is a *new* addition, so it gets the owner's **current** Live Moderation and free-user settings [verified: https://elevenlabs.io/vla];
  - it may use another op [unverified].
- **Adding twice** without deleting returns 400 `voice_already_cloned` [secondary: https://github.com/elevenlabs/elevenlabs-python/issues/454].
- **Owned voices** (designed, remixed, IVC): deletion is permanent and cannot be undone [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices]. Clones cannot be exported [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning].

### 2.5 Free-tier and gating restrictions

- Library voices are **not available via the API on the free tier** [verified: https://elevenlabs.io/docs/overview/capabilities/voices].
- Owners can exclude free users, and voices with a credit multiplier are paid-only. Free users then get an error saying the voice is not available to them [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library].
- The ToS limits free users to non-commercial use [verified: https://elevenlabs.io/terms-of-use, §1(c), last updated 09 Oct 2026].
- A Home Assistant issue (August 2026) reports support's position: a free account created after March 2026 will have **no** API-usable TTS voice after 2026-12-31. Default voices are gone, Library voices are blocked on the API, and creating new Design voices needs a paid plan [secondary: https://github.com/home-assistant/home-assistant.io/issues/47697].
- **Consequence:** production and staging both need a paid plan.

### 2.6 Resolution of C10

**Claim B wins as a design rule.** Always add curated Library voices and store the returned id (03 §4.4, 08 §11.1).

05's statement that Library voices can be used without saving is true for the **web app** only. For the API it is undocumented. Test T2 records the actual behavior, but the design does not depend on the result.

---

## 3. Voice Remix (C16)

| Source voice | Remixable? | Evidence |
|---|---|---|
| Our IVC, PVC or Voice Design voice | **Yes** | [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/remix-a-voice] [verified: https://elevenlabs.io/docs/overview/capabilities/voices] |
| A remix of ours | **Yes**, with no iteration limit | [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing] |
| Voices we have explicit permission to use (for example workspace-shared) | **Yes** (key-facts list) | [verified: same page] |
| Library voice with an **infinite** notice period, added to our account | **Yes** per the remix capability page and the remix quickstart | [verified: both pages above] |
| Library voice with a finite notice period (30–730 days) | **No** | same pages (by omission) |
| Default (premade) voice | The TTS playground guide says yes, and the remix quickstart's example remixes George. **Moot**, because Defaults expire. | [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech] [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/remix-a-voice] |

- **Conflict explained.** The playground guide says Library voices cannot be remixed at all. The Voices overview lists only owned voices. Both are older generic pages. The two remix-specific pages (capability and quickstart) agree with each other, so they are taken as authoritative. Confidence: Medium–High.
- **"Infinite" in the API.** This is most likely `notice_period = 4015`, as on ElevenLabs' perpetual voices (§1.2) [inference]. `sharing.voice_mixing_allowed` exists on voice objects, but its semantics are undocumented [verified: https://elevenlabs.io/docs/api-reference/voices/get] [unverified meaning]. Test T7 checks both.
- **Cost.** Remixing is priced on the length of the test script, like Design: you pay the preview-text characters once per call [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing]. The text is 100–1,000 characters, or `auto_generate_text` [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/remix].
- **Output.**
  - The call returns three previews, each with a `generated_voice_id`.
  - Saving one with `POST /v1/text-to-voice` creates a **new voice** with a new `voice_id`. The original is never modified [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/create] [verified: https://elevenlabs.io/docs/overview/capabilities/voice-remixing].
  - The result is a v3-grade voice model that also works on other models [verified: same page].
  - Saving takes **one custom slot**. This is documented for Design saves, and remix saves go through the same endpoint [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design] [inference for remix]. It is probably also one voice op, since it creates a new voice [inference].
- **Resolution of C16.** 07 E19 is right. 03 Q16's doubt is resolved in favor of the remix pages. 01's "owned or default voices" is half right: Defaults are moot. **Remixing a perpetual (4015) Library voice into an owned house voice is a valid hedge.** Each remix costs a slot and loses the Library voice's studio-grade PVC quality: remix quality is comparable to an IVC [verified: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech].

---

## 4. Previews (G3, C12)

### 4.1 URL shapes, hosting and headers

All rows below are [verified: live probe]; the Origin header sent was `https://example.org`.

| Shape | Example form | Status and headers observed |
|---|---|---|
| **Static GCS object** (library and premade voices) | `https://storage.googleapis.com/eleven-public-prod/database/workspace/<ws>/voices/<voice_id>/<file>.mp3`; premade: `…/eleven-public-prod/premade/voices/<id>/<uuid>.mp3` | `200`; `cache-control: public, max-age=3600`; `Expires` = Date + 1 h; `ETag`; `Last-Modified`; `access-control-allow-origin: *`. The `content-type` **varies**: `audio/mpeg` on 2026 library objects, `text/plain` on the 2024 objects used in the API reference examples. |
| **API preview, voice-level** | `https://api.us.elevenlabs.io/v1/voices/<voice_id>/previews/audio?payload=<base64 JSON>`; payload `{voice_source, workspace_id, filename, timestamp}` | `200`, `audio/mpeg`, `access-control-allow-origin: *`. **No `Cache-Control`, `Expires`, `ETag` or `Last-Modified`.** `HEAD` returns **405**. A missing `payload` returns 422. An unknown `filename` returns 404 `Preview not found`. The `api.elevenlabs.io` host serves the same bytes. |
| **API preview, verified-language** | same path; payload `{kind: "verified_language", language, model_id}` | `200`, `audio/mpeg`, `cache-control: public, max-age=3600`, CORS `*`. **No timestamp in the payload.** |

Docs-example URLs fetched:
- The shared-voices reference example URL (`…/sB1b5zUrxQVAFl2PhZFp/55e71aac-….mp3`, Last-Modified 2024-04-28) still serves `200`, `text/plain`, `max-age=3600` [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared] [verified: live probe].
- So does the get-voice example (`…/premade/voices/9BWtsMINqrJLrRacOk9x/405766b8-….mp3`, Last-Modified 2024-09-21) [verified: https://elevenlabs.io/docs/api-reference/voices/get] [verified: live probe].
- Public sources link `9BWtsMINqrJLrRacOk9x` to the former Default "Aria", which is now Legacy (routed to "Zoe") [unverified mapping].
- **A preview can outlive its voice.** Preview reachability is therefore **not** a voice health signal.

### 4.2 Lifetime

- **The docs say nothing** about preview URL lifetime, signing or hotlinking [verified: absence across https://elevenlabs.io/docs/api-reference/voices/search, https://elevenlabs.io/docs/api-reference/voices/get and https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared].
- **The voice-level API payload is not signed.** It is plain base64 JSON with no MAC. Its `timestamp` is in microseconds, rounded down to the **hour**: `1791802800000000` = 2026-10-12 11:00 UTC at 11:20 UTC. 03's probe saw 10:00 an hour earlier.
- **The timestamp is not enforced.** For the same voice, timestamps shifted by −1 h, −24 h, −7 d, −30 d, −365 d, +1 h and +30 d all returned `200` with **identical bytes** (sha256 prefix `b2513dd39f364e12`) [verified: live probe]. The hourly bucket looks like **cache-busting, not expiry** [inference].
- **What actually changes a preview** is the `filename` (voice-level) or the owner's custom preview, which owners can change at any time [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-add-a-custom-preview-for-my-shared-voice].
- **Rules for us:**
  - never store a raw `preview_url` as identity;
  - store the downloaded bytes' sha256 and a **canonical source key**: the GCS path, or the API path plus the payload with `timestamp` removed;
  - never construct preview URLs ourselves. The payload format is undocumented and may change.
- Confidence: High (observed today) / Unknown (any guarantee).

### 4.3 `verified_languages[].preview_url` semantics

- **One entry per (language, model_id, accent/locale), each with a `preview_url`** [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared] [verified: live probe].
- **In the probe sample** (105 voices from the perpetual-voice owner, 2,715 entries, every one with a `preview_url`; 29 voices list `eleven_v4` and 44 list `es`) [verified: live probe]:
  - Within a language, previews were **different audio per model**. For Darian in Spanish, `eleven_multilingual_v2`, `eleven_flash_v2_5` and `eleven_turbo_v2_5` gave three different files, and repeat fetches were byte-identical.
  - Darian's English entries all pointed to one shared GCS file.
  - One voice's `eleven_v4` entry served **the same bytes as its voice-level custom preview**. A verified entry's preview is therefore **not guaranteed to be rendered on that model**.
- **Model ids include internal ones** (`eleven_v4_hq`, `eleven_v4_exp`, `eleven_v4_post_trained`, `eleven_v4_fast`, `eleven_v2_5_flash`, `eleven_v2_flash`) [verified: live probe]. Keep the allowlist from 03 §12.3.
- **Use for magic-worlds:**
  - per-language preview for the picker: choose the entry for (user language, narration model), falling back to the call model, then the voice-level preview;
  - label it "sample", not "how it will sound in narration".

### 4.4 May we cache or re-host preview audio?

- **No page grants or forbids it explicitly** (Medium-confidence risk).
  - ToS §5(a)–(b): content in the Services belongs to ElevenLabs or its licensors. The license is limited, non-sublicensable and revocable, and any use not specifically authorized needs prior written permission [verified: https://elevenlabs.io/terms-of-use, last updated 09 Oct 2026].
  - Prohibited Use Policy §12 bars:
    - scraping or automated extraction except as robots.txt permits;
    - framing, mirroring or embedding the Services without written consent;
    - proxies that give others access outside the applicable terms [verified: https://elevenlabs.io/use-policy, last updated 09 Oct 2026].
  - `api.elevenlabs.io/robots.txt` disallows all paths for crawlers [verified: live probe].
  - Library previews are recordings or generations of a **third party's** voice, shared under the VLA, which does not address previews [verified: https://elevenlabs.io/vla].
- **Defensible without asking** [inference]: serving previews through the BFF with HTTP caching **no longer than upstream's `max-age=3600`**, fetched with our authenticated API key from URLs our account received.
- **Needs written confirmation** (support or legal; see §9 T10): persisting the MP3s indefinitely in our storage and serving them with `immutable` caching, as 03 §9.3 and §12.4 propose. The same request should cover keeping a removed voice's preview playable during its notice period.
- **Do not hotlink from the SPA** (07 §11.3), even though CORS allows it:
  - it leaks user IPs and referrers to ElevenLabs and Google;
  - it ties the UI to undocumented URL shapes;
  - it would need a CSP allowance (none exists today; there is no `Content-Security-Policy` in `/home/andres/WebstormProjects/magic-worlds/index.html`).

### 4.5 Spanish coverage (G3 bullet 2)

From unauthenticated `total_count` reads [verified: live probe]:

| Filter on `GET /v1/shared-voices` | total_count |
|---|---|
| `language=es` | 8,789 |
| `language=es&min_notice_period_days=365` | 7,502 |
| `…&include_custom_rates=false&include_live_moderated=false` | 6,368 |
| `language=es&min_notice_period_days=4015` (perpetual) | **218** |
| `language=en&min_notice_period_days=4015` | 126 |
| `min_notice_period_days=4015` (all languages) | 296 |

- Adding `category=high_quality` needs authentication.
- Coverage of `es` *verified-language previews on the narration model* (v4) still needs the authenticated count in test T11.
- Of the 16 confirmed Default replacements, 6 have `es` entries and none has a v4 entry (§1.2).

### 4.6 Resolution of C12

**Claim B (03 §12.4–12.5) wins on architecture**: a DB-backed synced `voice_catalog` with server-side filtering, and **no live provider call per user action**. Reasons:
- no rate limits are published (§7);
- our curation data (display names, roleplay tags, per-model eligibility, `replacement_voice_key`) exists only in our DB;
- `/v2/voices` lists only voices in our account anyway.

On previews, the answer is a **compromise**:
- BFF-served previews, cached at most 1 h, until ElevenLabs confirms caching in writing;
- then persistent storage as 03 designs it;
- never SPA hotlinking.

Free-text recipe previews stay a separate, metered decision (owner decision 13; G10).

---

## 5. Voice removal lifecycle and webhooks (G4)

### 5.1 Notice-period semantics

| Rule | Tag |
|---|---|
| The owner may set a notice period of 30 days to 2 years, or none. With none, anyone who saved the voice loses access **immediately** on removal. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period] |
| On removal, the voice leaves the Library at once. It stays usable for the notice period by users who saved or used it (help center), or who **added** it before removal (VLA, the contract). | [verified: same page] [verified: https://elevenlabs.io/vla] |
| Outputs generated before the end of the notice period stay usable afterwards. | [verified: https://elevenlabs.io/vla] |
| Owners can lengthen the notice period but never shorten it. Re-sharing a voice later **resets** its notice period. | [verified: https://elevenlabs.io/vla] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-delete-a-voice-ive-shared-with-the-voice-library] |
| Affected users get email and in-app notices that recommend similar voices. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library] |
| **ElevenLabs may remove any shared voice at its sole discretion, at any time, with or without notice**, and may rename it. Even 4015-day voices are not guaranteed. | [verified: https://elevenlabs.io/vla] |
| No-go voice detection can block a voice outright, after which it is unusable. | [verified: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices] |

### 5.2 Fields that expose the lifecycle

| Field | Where | Semantics | Tag |
|---|---|---|---|
| `sharing.notice_period` | `GET /v1/voices/{id}`, `GET /v2/voices` (`VoiceSharingResponseModel`, integer) | Days. Observed values: 30, 90, 180, 730 and 4015. The unit is inferred from `min_notice_period_days`. | [verified: https://elevenlabs.io/docs/api-reference/voices/get] [verified: live probe] |
| `notice_period` | `GET /v1/shared-voices` (`LibraryVoiceResponseModel`, nullable integer) | Same, before the add. | [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared] |
| `sharing.disable_at_unix` | Voice objects (nullable) | Unix time when access ends. Absent or `null` when no removal is pending. The help center points to `GET /v1/voices/{id}`; the field is in the same sharing model returned by `/v2/voices` (the second half is [inference]). | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period] [verified: https://elevenlabs.io/docs/api-reference/voices/search] |
| `sharing.status` | Voice objects | `enabled`, `disabled`, `copied` or `copied_disabled`. That `copied_disabled` means "our copy of a withdrawn voice" is [inference]. | [verified: https://elevenlabs.io/docs/api-reference/voices/get] |
| `sharing.live_moderation_enabled`, `free_users_allowed`, `rate`, `fiat_rate`, `voice_mixing_allowed`, `ban_reason`, `review_status` | Voice objects | Terms and safety state. | same |
| `safety_control` | Voice objects | `NONE`, `BAN`, `CAPTCHA`, `ENTERPRISE_BAN`, `ENTERPRISE_CAPTCHA` | same |
| `min_notice_period_days` | Query on `/v2/voices` and `/v1/shared-voices` | The server accepts 0–4015 (a 400 error says so). | [verified: live probe] [verified: https://elevenlabs.io/docs/api-reference/voices/search] |

### 5.3 Webhooks

**Events and subscription**
- Event types: `voice_removal_notice` (scheduled for removal), `voice_removal_notice_withdrawn` and `voice_removed` (no longer usable) [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks].
- Subscribe by creating a workspace webhook, then patching its events:
  - `POST /v1/workspace/webhooks` with `settings: {auth_type: "hmac", name, webhook_url (HTTPS), request_headers?}` returns `{webhook_id, webhook_secret}`. The secret is shown only on creation [verified: https://elevenlabs.io/docs/api-reference/webhooks/create].
  - `PATCH /v1/workspace/webhooks/{webhook_id}` with `{name, is_disabled, retry_enabled?, request_headers?, events: ["voice_library_removal_notice"]}`. `events` is the **complete** set: anything not listed is unsubscribed [verified: https://elevenlabs.io/docs/api-reference/webhooks/update].
  - The enum is `voice_library_removal_notice | speech_to_text | agent_qa | flows` [verified: https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/types/workspace_webhook_event_type.py].
- **Only workspace admins** can configure webhooks [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks].
- `GET /v1/workspace/webhooks?include_usages=true` returns `is_disabled`, `is_auto_disabled`, `events`, `most_recent_failure_error_code` and `most_recent_failure_timestamp`. Monitor these [verified: https://elevenlabs.io/docs/api-reference/webhooks/list] [verified: https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/types/workspace_webhook_response_model.py].

**Payload**
- Only the envelope `{type, event_timestamp, data}` is documented. The `data` schema for voice events is **undocumented**: it is absent from the docs, the OpenAPI spec and both SDKs [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks] [verified: https://api.elevenlabs.io/openapi.json (no voice-removal schema)].
- `event_timestamp` is a number in the example but a "string" in the table [verified: same page].
- **Treat the webhook as a trigger to re-fetch**, keyed by any voice id found in `data`. If no id can be parsed, run a full Job B.

**Signature scheme** (from SDK source) [verified: https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/webhooks_custom.py] [verified: https://github.com/elevenlabs/elevenlabs-js/blob/ec61f8ecbdd65b24d71b826ccff01aeff7ab0137/src/wrapper/webhooks.ts]:
- The header is `ElevenLabs-Signature: t=<unix seconds>,v0=<hex>`.
- `v0` is `HMAC-SHA256(key = webhook_secret, msg = "<t>.<raw request body>")`, hex-encoded.
- The SDKs reject a `t` older than **30 minutes**. They do **not** reject future timestamps, and they compare with `!=`/`!==`, which is not constant-time.
- **Our implementation should:**
  - verify on the **raw bytes**;
  - use `hmac.compare_digest`;
  - enforce a ±5-minute window plus the 30-minute floor;
  - dedupe events.
- Optionally add a static secret through `request_headers`, and allowlist ElevenLabs' egress IPs: US `34.67.146.145` and `34.59.11.47`; EU and Asia pairs are listed on the page [verified: https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting].

**Retries and auto-disable** [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks]
- Retries are **off by default** and enabled per webhook.
- The schedule is immediate, 30 s, 2 min, 8 min and 30 min, with up to 10% jitter.
- Retries happen only on 5xx, 429, 408 and connection errors or timeouts. 4xx responses are not retried.
- Each webhook holds at most 100 queued retries.
- **Retries are documented only for agent post-call events.** Voice-removal events are not listed, so assume **at most one delivery**.
- **Auto-disable:** after 10 or more consecutive failures, if the last success was more than 7 days ago or never happened. Workspace admins get an email, and a manual re-enable is required.

**Our backend today**
- magic-worlds-api already has an inbound-webhook pattern:
  - `POST /webhooks/fal`: `/home/andres/PycharmProjects/magic-worlds-api/src/routes/webhooks/fal.py:13-18`, verified by `FalWebhookVerifier` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/webhook.py:37-74`);
  - mounted through `/home/andres/PycharmProjects/magic-worlds-api/src/routes/__init__.py:26`;
  - its public URL comes from the **optional** `FAL_WEBHOOK_PUBLIC_BASE_URL` (`/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/config.py:32`, `:270-273`; `/home/andres/PycharmProjects/magic-worlds-api/.env.example:279`).
- With that variable unset, image jobs fall back to polling (`/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/image_generation.md:275-276`). This corrects 09 G4's "no inbound webhook route".
- Whether production has public HTTPS ingress is still [unverified]. **Copy the same pattern: webhook optional, polling primary.**

### 5.4 Polling cadence

- ElevenLabs gives **no recommended cadence**. What follows is our design [inference].
- **With a notice period** (≥ 30 days): a **daily** health check gives at least 29 days of warning. Curating only `notice_period ≥ 365` (or 4015) tolerates weeks of sync outage.
- **Immediate removals** (no notice, sole-discretion takedown, no-go block, BAN) cannot be caught by polling. They need **runtime detection**:
  - classify `voice_not_found` (404) and `voice_access_denied` (403) on a catalog voice as `voice_unavailable`;
  - mark the voice `suspect`;
  - trigger a single-voice re-fetch;
  - use the configured fallback voice for that turn;
  - alert root [verified error codes: https://elevenlabs.io/docs/eleven-api/resources/errors].
- Cadence: Job B daily, plus on webhook, plus on runtime error. Job A nightly. Job C hourly. Details are in §10.2.

---

## 6. Voice Design and voice-operation quotas

### 6.1 Design limits and cost

- Inputs:
  - `voice_description`: 20–1,000 characters;
  - preview `text`: 100–1,000 characters, or `auto_generate_text`;
  - each call returns 3 previews;
  - models `eleven_multilingual_ttv_v2` (default) and `eleven_ttv_v3` [verified: https://elevenlabs.io/docs/overview/capabilities/voices] [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/design].
- **Cost:** only the characters of the preview text, charged once per call even though three previews come back [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design] [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost].
- **The USD rate per design character is not listed** on the API pricing page [verified: https://elevenlabs.io/pricing/api]. At the multilingual TTS list price of $0.08 per 1k characters, one call would cost **$0.008–$0.08** [inference; unverified rate].
- **Saving** (`POST /v1/text-to-voice`) uses **one custom slot** [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-design]. It probably also uses one voice op, since it creates a new voice [inference].
- **`generated_voice_id` lifetime is undocumented.**
  - It is absent from the reference, the guides, the OpenAPI spec and the SDK docstrings [verified: https://elevenlabs.io/docs/api-reference/text-to-voice/create] [verified: https://api.elevenlabs.io/openapi.json].
  - A third-party integration guide says previews expire, without giving a duration [secondary: https://tanstack.com/ai/latest/docs/media/voice-creation].
  - Design the admin flow so that a pick is saved within the same session. Keep the three `audio_base_64` previews locally so that an expired id costs only a re-design, not lost audition notes.
  - Test T8 measures the lifetime.

### 6.2 Slots, operations and concurrency per plan

| Plan | Voice add/edit ops per month | Custom voice slots (help center) | Custom voice slots (pricing page) | PVC slots | Concurrency (help center / pricing) |
|---|---|---|---|---|---|
| Free | 55 | 3 | 3 | – | 2 / 2 |
| Starter | 65 | 10 | 10 | – | 3 / 3 |
| Creator | 95 | 30 | 30 | 1 | 5 / 5 |
| Pro | 290 | 160 | 160 | 1 | 10 / 10 |
| Scale | 1,040 | 660 | 660 | 3 | 15 / 15 |
| Business | 1,040 | **660** | **2,200** | 10 | **15 / 25** |
| Enterprise | unlimited | custom | custom | custom | elevated |

Sources:
- ops: [verified: https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices];
- slots: [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it] [verified: https://elevenlabs.io/pricing];
- concurrency: [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-429] [verified: https://elevenlabs.io/pricing].

Notes:
- Ops reset when the account receives new credits, which is monthly on most paid plans. Grant recipients get 12× Business, reset yearly [verified: ops page].
- The Business slot and concurrency conflicts (C11) remain. Read `voice_limit` and `max_voice_add_edits` from `GET /v1/user/subscription` instead of hard-coding them [verified: https://elevenlabs.io/docs/api-reference/user/subscription/get].
- TTS concurrency is double for Flash/Turbo models: Pro 20, Scale and Business 30 [verified: https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it].

---

## 7. Pagination and rate limits for a nightly sync (100–500 voices)

| Endpoint | Paging | Limits and quirks | Tag |
|---|---|---|---|
| `GET /v2/voices` | Cursor: `next_page_token` + `has_more`; `page_size` default 10, **max 100** | `voice_ids` takes **at most 100** per call. `include_total_count` defaults to true and has a performance cost, so pass `false`. Page 0 can include extra Default voices: pass `voice_type=non-default`. Filters: `voice_type`, `category`, labels, `min_notice_period_days`, and more. | [verified: https://elevenlabs.io/docs/api-reference/voices/search] |
| `GET /v1/shared-voices` | Offset `page` (default 0) + `page_size` (default 30, **max 100**); returns `has_more`, `total_count`, `last_sort_id` (undocumented) | **Unauthenticated:** at most 3 results, no pagination ("must be logged in to use pagination"), and some filters (`search`, `featured`, `category`) refused. `owner_id`, `language`, `min_notice_period_days`, `sort`, `gender` and `accent` worked. | [verified: https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared] [verified: live probe] |
| `GET /v1/voices` (legacy) | none | Stops working once a workspace exceeds **500 voices**. Never use it. | [verified: https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/voices/client.py#L56-L60] |
| Rate limits | — | **No per-endpoint numbers are published.** A 429 carries `detail.code` `rate_limit_exceeded` (back off exponentially), `concurrent_limit_exceeded` (wait for in-flight requests) or `system_busy` (retry). Enterprise plans get custom rate limits. No rate-limit headers were seen on `/v1/shared-voices`. Whether non-TTS calls count against the plan's concurrency limit is [unverified]. | [verified: https://elevenlabs.io/docs/eleven-api/resources/errors] [verified: https://elevenlabs.io/pricing/api] [verified: live probe] |

**Request budget for a 500-voice catalog** [inference]:

| Job | Requests per run |
|---|---|
| Job A: account inventory, `page_size=100&voice_type=non-default&include_total_count=false` | ≤ 6 |
| Job B: curated health check, `voice_ids` batches of 100 | ≤ 5 |
| Job C: subscription read | 1 |
| Preview refresh, only when the canonical source key changes | usually 0–20 |

Run the jobs serially with one in-flight request, honor `Retry-After` if present (its presence is [unverified]), and back off on 429 or 5xx. That stays far below any plausible limit.

---

## 8. Contradictions resolved

| Id | Resolution | Why |
|---|---|---|
| **C1** | **B wins.** Ban Default voices. Use ElevenLabs' perpetual (4015-day) Library voices, which include the official Default replacements, plus owned voices as house defaults. | §1 |
| **C10** | **B wins (design rule).** Always add Library voices and store the returned id plus the original. API use without an add is undocumented (test T2), and adding locks in the notice and moderation terms. | §2.1, §2.2 |
| **C12** | **B wins on architecture**: synced DB catalog, server-side filters. **Previews are a compromise**: BFF-served with ≤ 1 h caching until written OK, then persistent storage. Never hotlink from the SPA. | §4.4, §4.6 |
| **C13** | **B wins, with a refinement.** Admin "delete" becomes a **soft retire** in our catalog. A Library copy uses no slot, so deleting it frees nothing and may be irreversible or change its terms on re-add: **never delete Library copies through the console.** Owned voices (designed, remixed, IVC) may be provider-deleted only when the reference count is 0, the voice is not `deprecating` or `removed`, and the root user explicitly confirms. Today's route deletes directly (`/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:182-196`; FE `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:1604-1611`). | §2.4 |
| **C16** | **A (07 E19) wins.** Library voices with an infinite notice period can be remixed; the remix-specific pages outrank the older generic ones. Remixing makes a new owned voice (one slot), priced by preview characters. | §3 |

---

## 9. Still requires a paid staging test

**Setup**
- Use a **separate staging workspace on a paid plan.** Creator ($22) is enough for T2–T8. It must be a plan whose API can use the Library, so not Free.
- Create one API key with the TTS, Voices read/write, Voice Generation and Workspace webhooks scopes.
- Keep every TTS call at ≤ 40 characters on `eleven_flash_v2_5` with `output_format=mp3_22050_32`.
- Before and after every step, record `GET /v1/user/subscription`: `character_count`, `voice_slots_used`, `voice_limit`, `voice_add_edit_counter` and `max_voice_add_edits`.
- Log every response's `request_id` and the cost header, if present (06 Q3).
- Choose test voices:
  - **P**: a perpetual voice, for example Eldrin `6WwXjDDEMyNmFG95zycZ`;
  - **N**: a community PVC with `notice_period` 365–730, `rate=1`, no live moderation;
  - **M**: one live-moderated voice, which is also useful for G1.

The **production** half of G5 is read-only and costs nothing beyond the key. The owner runs it with the production key:
- `GET /v1/user` (`created_at`);
- `GET /v1/user/subscription`;
- `GET /v2/voices?voice_type=default&page_size=100&include_total_count=true`;
- `GET /v2/voices?voice_type=personal` and `=community`;
- `GET /v1/workspace/webhooks?include_usages=true`.

Record in the plan: tier, creation date (and therefore Default-voice eligibility), slots and ops headroom, existing voices and existing webhooks.

| Test | Exact steps | Closes |
|---|---|---|
| **T1. Baseline** | (1) Record the subscription counters. (2) `GET /v2/voices?voice_type=default` and note the count (expect 0 on a post-March-2026 account). (3) `GET /v1/shared-voices?page_size=100&min_notice_period_days=4015&language=en` and confirm P's `public_owner_id` and `notice_period`. | G5 |
| **T2. TTS on an un-added Library voice** | (1) Confirm P and N are absent: `GET /v2/voices?voice_ids=P,N` returns no rows. (2) `POST /v1/text-to-speech/P` with `{"text":"Prueba uno.","model_id":"eleven_flash_v2_5"}`, then the same for N. Record status and `detail.code` (expect 200, 404 `voice_not_found` or 403 `voice_access_denied`). (3) Repeat `GET /v2/voices?voice_ids=P,N` to see whether *using* a voice auto-adds it. (4) Check the counter deltas. | G2a, C10 |
| **T3. Add semantics** | (1) `POST /v1/voices/add/{public_owner_id}/N` with `{"new_name":"mw-stg-N","bookmarked":true}`; record the returned id R. (2) Compare R with N. (3) `GET /v1/voices/R`: record `sharing.status`, `original_voice_id`, `public_owner_id`, `notice_period`, `disable_at_unix`, `live_moderation_enabled` and `is_bookmarked`. (4) Check the `voice_add_edit_counter` and `voice_slots_used` deltas. (5) TTS on R **and** on N. (6) Repeat (1) and expect 400 `voice_already_cloned`. | G2b, G2c, G2d |
| **T4. Delete and re-add (still listed)** | (1) `DELETE /v1/voices/R`. (2) TTS on R and record the error code; this also gives the "unknown voice" shape for G14. (3) Re-add N and record the new id R2 (equal to R?) and the counter delta. (4) TTS on R2. | G2e, C13 |
| **T5. Webhook plumbing** | (1) `POST /v1/workspace/webhooks` with `settings {auth_type:"hmac", name:"mw-stg", webhook_url:"https://<staging-host>/webhooks/elevenlabs"}`; store `webhook_secret`. (2) `PATCH` it with `{name, is_disabled:false, retry_enabled:true, events:["voice_library_removal_notice"]}`. (3) `GET /v1/workspace/webhooks?include_usages=true` and confirm `events`. (4) Have the endpoint return 500 for the first delivery to see whether voice events are retried. | G4 |
| **T6. Real removal payload** (needs a cooperating PVC owner) | (1) A team member with Creator+ shares their own PVC to the Library with a **30-day** notice period. (2) The staging account adds it (T3 steps). (3) The owner stops sharing. Capture `voice_removal_notice` (raw body, headers, signature), and poll `GET /v1/voices/{id}` for `disable_at_unix`. (4) The owner re-shares and we capture `…_withdrawn`. (5) The owner stops sharing again and waits 30 days; we capture `voice_removed` and the TTS error code after `disable_at_unix`. **Alternative:** ask support for sample payloads. | G4, 03 Q14/Q17 |
| **T7. Remix eligibility** | Call `POST /v1/text-to-voice/{id}/remix` (`text` 100 characters, `stream_previews:false`) on: (a) P's added copy; (b) N's added copy; (c) one owned designed voice from T8. Record status, error code, `character_count` delta and `sharing.voice_mixing_allowed` for each. Save one preview from (a) and record the slot and ops deltas. Delete it afterwards (owned voice, so allowed). | C16 |
| **T8. Design id lifetime and cost** | (1) Run three `POST /v1/text-to-voice/design` calls (`eleven_ttv_v3`, 100-character text) and record the `character_count` delta per call. (2) Save the first design's preview at +1 min, the second at +60 min and the third at +24 h with `POST /v1/text-to-voice`. Record the failure code when the id has expired. (3) Record the slot and ops deltas per save. (4) Delete the saved voices. | G13, 03 Q8 |
| **T9. Preview stability (48 h)** | Every 6 h for 48 h, for 10 added voices: `GET /v2/voices?voice_ids=…`. Store each `preview_url` and `verified_languages[].preview_url`, download the bytes and record status, content-type, `Cache-Control` and sha256. Compare the account-copy URLs with `/v1/shared-voices` URLs for the same voices. | G3 |
| **T10. Terms (written)** | Email support or legal (or ask the account manager) three questions: (a) may we cache Library and voice preview MP3s server-side and serve them to our authenticated end users to illustrate a voice? (b) may a removed voice's preview stay playable during its notice period? (c) the G1 questions on B2C use of Library voices. | G3, G1 |
| **T11. Spanish v4 coverage** | Authenticated `GET /v1/shared-voices?language=es&min_notice_period_days=365&include_custom_rates=false&include_live_moderated=false&category=high_quality&page_size=100&page=N` until `has_more=false`. Count voices with a `verified_languages` entry for `es` on the narration model and on the call model. | G3, G7 |
| **T12. Sync load** | Run the full nightly sync (§7) in a loop ten times back-to-back. Record any 429 `detail.code` and headers (`Retry-After`?). | §7 |
| **T13. Post-expiry Default behavior** (calendar-gated) | On 2027-01-01, on any pre-March-2026 account, `POST /v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb` with 10 characters. Record the status and whether the audio is a different voice. This informs only the incident playbook: nothing in the catalog should depend on it. | §1.4 |

---

## 10. Implications for the catalog design

### 10.1 What to store

These are additions or changes to 03 §12.2 and 08 §12.3. The column names are illustrative.

| Column | Why |
|---|---|
| `provider_voice_id` | The id we synthesize with: the id **returned by the add call**, or our own voice's id. |
| `library_voice_id`, `public_owner_id` | The original Library id and its owner, for re-add, Library lookups, owner filters, and "same voice" checks across accounts (§2.2). |
| `source_kind` | `library_perpetual` (notice ≥ 4015), `library_noticed`, `designed`, `remixed`, `ivc`, `premade_deprecated`. This drives the policy below. |
| `notice_period_days`, `disable_at`, `sharing_status` | Lifecycle (§5.2). |
| `terms_at_add` (JSON: `live_moderation_enabled`, `free_users_allowed`, `rate`, `fiat_rate`, `voice_mixing_allowed`) + `added_at` | These terms are **locked at add time** (VLA). Re-adding can change them (§2.4). |
| `provider_name` (source) vs `display_name` (ours) | Names drift (§1.2). |
| `safety_control`, `ban_reason`, `review_status` | Block on BAN or CAPTCHA. |
| `verified_languages` rows filtered by the model allowlist: `language`, `model_id`, `accent`, `locale`, `preview_source_key`, `preview_sha256`, `preview_asset_id` | Per-language previews (§4.3). The source key is the URL **without** the timestamp. |
| `preview_source_key`, `preview_sha256`, `preview_asset_id`, `preview_fetched_at` | Change detection and caching (§4.2). |
| `last_seen_at`, `missing_sync_count`, `suspect_since`, `last_error_code` | Health (§5.4). |
| `uses_custom_slot` | Owned voices only. |
| `reference_count` (or a `voice_reference` table) | Required before any provider delete (C13). |
| `replacement_voice_key` | Fallback when the voice is removed. |

### 10.2 Sync cadence

| Job | When | What |
|---|---|---|
| A: inventory | Nightly, after admin mutations, and on the admin "Sync" button | `/v2/voices?voice_type=non-default&page_size=100&include_total_count=false`, paged. Upsert. New rows start `draft` and `admin`-only. Two consecutive misses set `removed` (as 03 §12.3). |
| B: health | Daily, on webhook, and on runtime `voice_unavailable` | `/v2/voices?voice_ids=…` in batches of ≤ 100. Update `disable_at`, `sharing_status`, `safety_control` and terms. Move to `deprecating` when `disable_at` is set. |
| C: limits | Hourly and after mutations | `GET /v1/user/subscription`, for the slot, ops and character headroom widget and pre-flight checks. |
| Previews | Inside A and B, only when `preview_source_key` changes; plus a weekly forced re-verify | Download, sha256, store (or proxy ≤ 1 h until T10). |
| Webhook | When ElevenLabs delivers | Verify the HMAC, dedupe, enqueue B for that voice, return 200 fast. **Optional:** polling is the primary path. |

### 10.3 How to treat Default voices

- Never publish a Default voice. Never map a MiniMax voice to one. Never use one as `TTS_DEFAULT_VOICE_ID` or a fallback.
- If the account has them, Job A tags them `premade_deprecated`, admin-only, so that a stray reference shows up.
- Add a CI or startup guard that rejects any configured voice id in the old-Default id list (§1.2) or with `category=premade`. From **2026-12-01**, an alert fires if any reference remains.
- For a "safe default narrator" per language, pick from ElevenLabs' **perpetual** voices (`notice_period >= 4015`, `free_users_allowed`, no live moderation, `rate=1`), **added** to the account, **and** auditioned on our narration model. v4 coverage is not given (§1.2), so G7's protocol applies. A designed or remixed **owned** voice is the stronger alternative.

### 10.4 How to protect against disappearing voices

1. **Curation filter:** `notice_period >= 365` (prefer 4015), `include_custom_rates=false`, `include_live_moderated=false`, `safety_control=NONE`, and `free_users_allowed` irrelevant (we are paid).
2. **Always add** each curated voice and **never delete** a Library copy through the console. Retire it in our DB instead (C13).
3. **Every published voice has a `replacement_voice_key`,** chosen at publish time from the same language, gender and age bucket. Seed candidates with `POST /v1/similar-voices` [verified: https://elevenlabs.io/docs/api-reference/voices/find-similar-voices]. Every language has an **owned** fallback narrator voice.
4. **Lifecycle UX** (closes G4 bullet 4):
   - root gets a console banner and an email when a voice becomes `deprecating`;
   - card and preset owners see a "Voice leaving on {date}" badge in the Voice Studio and the character editor, with a one-click switch to the replacement;
   - on `removed`, the resolver substitutes the replacement and records the substitution in the TTS job metadata (as 03 §12.6);
   - no end-user email is needed.
5. **Hedge for key voices:** for the few voices most used by cards, if `source_kind=library_perpetual` and T7 confirms eligibility, remix them into an **owned** house variant. That costs a slot and IVC-level quality, but it cannot be withdrawn by an owner (ElevenLabs can still act on any voice under its policies).
6. **Runtime detection:** a 404 or 403 on a catalog voice marks it `suspect` and triggers Job B immediately. Never retry it blindly.
7. **Previews are not health signals.** Old GCS previews outlive their voices (§4.1). Judge health only by voice metadata and synthesis results.
8. **Budget:** 1 op per add (until T3) and 1 slot plus probably 1 op per design, remix or IVC save. Pre-flight against Job C's counters, as in 03 §12.6.

---

## 11. Verification log (2026-10-12)

**Docs and help center.** Fetched as `.md` from `elevenlabs.io/docs/...` between 05:16 and 05:30 local time:
- Default, Legacy and "updated & changed" voice pages; notice period; slots; operations; delete; Voice Library guide and FAQ;
- remixing (capability page and quickstart); Voice Design (guide and quickstart); voices overview; webhooks; post-call webhooks; IP allowlisting; errors; 429 and concurrency pages; billing;
- API reference pages: add shared voice, list shared voices, `/v2/voices`, get voice, delete, subscription, webhook create, update and list, design, remix, create, stream;
- all 99 changelog entries listed in `docs/changelog/llms.txt`.

**Legal and pricing pages.** `terms-of-use` (last updated 09 Oct 2026), `use-policy` (09 Oct 2026), `vla` (6 Mar 2026), `oem-terms` (28 Feb 2025), `pricing`, `pricing/api`.

**Source code and spec.**
- OpenAPI: `https://api.elevenlabs.io/openapi.json`.
- SDKs: elevenlabs-python at commit `fbe5daf0` (2026-10-07) and elevenlabs-js at commit `ec61f8ec` (2026-10-05).
- elevenlabs-mcp at commit `c6dc1688` (2026-08-20).

**Live probes (unauthenticated, no key), about 11:15–11:40 UTC:**
- Resolved the 38 voice links on the Default-voices help page through `r.contact.elevenlabs.io` redirect pages. No browser was used and no tracking iframe was loaded.
- About 180 `GET https://api.elevenlabs.io/v1/shared-voices?page_size=3&…` requests, combining `owner_id`, `language`, `accent`, `gender`, `age`, `use_cases`, `sort` and `min_notice_period_days`, to read public metadata for 105 voices.
- About 20 preview fetches (`GET` and one `HEAD`), including timestamp-shifted payloads and the docs-example GCS objects.
- `api.elevenlabs.io/robots.txt` disallows all paths, and PUP §12 restricts automated extraction except as robots.txt permits. These probes were a one-off, low-volume research read. **Do not repeat or automate unauthenticated enumeration.** All further discovery (T1, T11) must use the authenticated API under our account.

**Codebase (read-only).**
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/webhooks/fal.py:13-18`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/webhook.py:37-74`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/config.py:21`, `:32`, `:270-273`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/__init__.py:26`
- `/home/andres/PycharmProjects/magic-worlds-api/.env.example:279`
- `/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/image_generation.md:275-276`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_voices.py:182-196`
- `/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:87-96`
- `/home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py:46`
- `/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:1604-1611`
- `/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewVoice.ts:12-37`
- `/home/andres/WebstormProjects/magic-worlds/index.html` (no CSP)

---

## 12. Sources

**ElevenLabs docs and help center**
- https://elevenlabs.io/docs/llms.txt
- https://elevenlabs.io/docs/changelog/llms.txt (index), https://elevenlabs.io/docs/changelog/2026/4/13, https://elevenlabs.io/docs/changelog/2026/7/20, https://elevenlabs.io/docs/changelog/2026/1/5, https://elevenlabs.io/docs/changelog/2026/5/13
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-legacy-voices
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-are-voices-updated-changed
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-delete-a-voice-ive-shared-with-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/how-do-i-add-a-custom-preview-for-my-shared-voice
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library
- https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-delete-voices-from-my-voices
- https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it
- https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-on-how-many-times-i-can-edit-add-voices
- https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost
- https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices
- https://elevenlabs.io/docs/help-center/technical/api-error-code-429
- https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it
- https://elevenlabs.io/docs/overview/capabilities/voices
- https://elevenlabs.io/docs/overview/capabilities/voice-remixing
- https://elevenlabs.io/docs/overview/administration/billing
- https://elevenlabs.io/docs/eleven-creative/voices/voice-library
- https://elevenlabs.io/docs/eleven-creative/voices/voice-design
- https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning
- https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
- https://elevenlabs.io/docs/eleven-api/quickstart
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/remix-a-voice
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/voice-design
- https://elevenlabs.io/docs/eleven-api/resources/webhooks
- https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting
- https://elevenlabs.io/docs/eleven-api/resources/errors
- https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks

**API reference**
- https://elevenlabs.io/docs/api-reference/voices/search
- https://elevenlabs.io/docs/api-reference/voices/get
- https://elevenlabs.io/docs/api-reference/voices/delete
- https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared
- https://elevenlabs.io/docs/api-reference/voices/voice-library/share
- https://elevenlabs.io/docs/api-reference/voices/find-similar-voices
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/api-reference/text-to-voice/design
- https://elevenlabs.io/docs/api-reference/text-to-voice/remix
- https://elevenlabs.io/docs/api-reference/text-to-voice/create
- https://elevenlabs.io/docs/api-reference/user/subscription/get
- https://elevenlabs.io/docs/api-reference/webhooks/create
- https://elevenlabs.io/docs/api-reference/webhooks/update
- https://elevenlabs.io/docs/api-reference/webhooks/list
- https://api.elevenlabs.io/openapi.json

**Legal and pricing**
- https://elevenlabs.io/terms-of-use (last updated 09 Oct 2026)
- https://elevenlabs.io/use-policy (last updated 09 Oct 2026)
- https://elevenlabs.io/vla (last updated 6 Mar 2026)
- https://elevenlabs.io/oem-terms (last updated 28 Feb 2025)
- https://elevenlabs.io/pricing
- https://elevenlabs.io/pricing/api
- https://elevenlabs.io/robots.txt, https://api.elevenlabs.io/robots.txt

**Official source code**
- https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/webhooks_custom.py
- https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/voices/client.py
- https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/types/workspace_webhook_event_type.py
- https://github.com/elevenlabs/elevenlabs-python/blob/fbe5daf0108133f2554fa6b0bb5edc943cefb941/src/elevenlabs/types/workspace_webhook_response_model.py
- https://github.com/elevenlabs/elevenlabs-js/blob/ec61f8ecbdd65b24d71b826ccff01aeff7ab0137/src/wrapper/webhooks.ts
- https://github.com/elevenlabs/elevenlabs-mcp/blob/c6dc1688ead5e0e67cdcaa5e336bed647019340c/elevenlabs_mcp/server.py

**Secondary**
- https://community.livekit.io/t/new-default-elevenlabs-voices/459
- https://github.com/home-assistant/home-assistant.io/issues/47697
- https://github.com/elevenlabs/elevenlabs-python/issues/454
- https://support.vapi.ai/t/26977579/voice-not-found
- https://community.retellai.com/t/when-adding-a-voice-resource-not-found/728
- https://tanstack.com/ai/latest/docs/media/voice-creation

**Related notes in this folder**
- [00_current_tts_review.md](./00_current_tts_review.md)
- [01_elevenlabs_tts_models_and_api.md](./01_elevenlabs_tts_models_and_api.md) §18.2 (line 1186)
- [03_elevenlabs_voices_catalog_cloning_design.md](./03_elevenlabs_voices_catalog_cloning_design.md) §2.2, §4, §9, §12, §14
- [05_elevenlabs_platform_pricing_limits_policy.md](./05_elevenlabs_platform_pricing_limits_policy.md) §6.5 (line 563), §11.6 (line 1047)
- [06_backend_minimax_inventory.md](./06_backend_minimax_inventory.md) §11.5
- [07_frontend_minimax_inventory.md](./07_frontend_minimax_inventory.md) E19 (line 156), §7.1, §11.3
- [08_voice_data_model_migration_surface.md](./08_voice_data_model_migration_surface.md) §11
- [09_research_critic_gaps.md](./09_research_critic_gaps.md)
