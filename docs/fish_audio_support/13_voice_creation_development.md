# Voice creation — development handoff

October 15, 2026. The owner selected the already-approved Gabriel Spanish voice
for the first release and prioritized the system for creating voices over a
larger starter catalogue. The eight distinct audition references remain separate
identities; moods never create catalogue entries. The additional auditions are
not release starters.

The running app opens **Voices → Explore voices** on the distinct-speaker
catalogue. Choose **Fish Audio** to find Gabriel, **Listen** to play its sample,
and **Use this voice** to open its settings already filled in. Saved choices
live under **Saved settings**; changing emotion never creates a catalogue voice.
The approved **Gabriel · Español** settings were saved through the real
development root session as a Fish version-3 preset. Its owned ten-second sample
was loaded and played in the browser. The catalogue initially shows both languages;
the frontend also accepts
the backend's nullable legacy ElevenLabs provider field instead of silently
dropping those voices. The root catalogue has a server-side provider filter,
provider badges and the correct **Spanish: Drama 3** acceptance for Gabriel.
Root users have a direct **Create a new voice** action, which opens creation
with Fish selected. Fish Audio and ElevenLabs are visible choices; the flow is
**describe → listen and compare → save** with English/Spanish auditions. A saved
draft offers **Review this voice** and explains the review/publish steps.
The root console has four main sections: **Voices**, **Create a voice**,
**Review voices**, and **Tools**. Limits, metrics and the lab live under Tools.
The catalogue table keeps voice/provider, status, language review, references and
management; source details remain in each voice's drawer. EN/ES UI copy uses
"saved settings" rather than presenting delivery variants as new voices.
Screenshots are in the ignored `.dev/fish-visible-voices/` folder
(`catalogue-ux.jpg`, `create-ux.jpg`).
This is the development first release; Fish calls and multi-speaker narration
stay disabled as separate follow-up capabilities.

## Implemented workflow

Root console → Create → Design → Fish Audio → English or Spanish → describe an
original voice → generate 1–4 candidates → compare → save the chosen voice.

The backend sends `model: voice-design-1` to native `/v1/voice-design`, with a
20–1,000-character description, up to 150 preview characters, language and
candidate count. It moderates the description and preview before dispatch. It
does not forward ElevenLabs loudness, enhancement or quality settings.

Candidates are validated PCM WAV files. The browser receives an application
candidate token and playable audio; the provider signature remains server-side.
An unsigned preview remains playable but cannot be saved. The application
retains input and selection after a failed save.

Saving uploads the exact original audio and signature to multipart `/model`,
with private visibility and fast training. Both creation and read-back must
confirm `source=voice_design`, private visibility, an available TTS model and the
application's unique marker. The application then stores a `designed` Fish
catalogue draft with its owned MP3 preview. Local publication remains distinct
from public publication on Fish.

Request admission shares the Fish supplier-account concurrency and daily budget
with speech. Design costs $0.01 per successful generation batch, independent of
candidate count. Saving reserves the same conservative ceiling; that estimate
does not assert a separately billed save fee. Attempts use `unit=requests` and
dated pricing. [Official pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits).

Completed save retries recover the existing catalogue voice. An uncertain
provider save first looks for the unique marker in the complete owned
inventory; it does not automatically repeat model creation. Unsaved candidates
expire after 30 minutes and are bounded to 128 entries/32 MiB per worker, matching
the existing studio session convention. A restart or another worker can require
new previews; this is not a durable cross-worker candidate store.

## Evidence

- Direct native probes generated signed English and Spanish candidates and
  saved both as private, trained design models.
- The opted-in application test passed with a fresh disposable MySQL database:
  two candidates per language, actor isolation, signed private persistence,
  catalogue drafts, owned MP3 samples, repeated save without another provider
  write, and fresh Drama 3 speech using each persistent model ID.
- Auth and moderation are explicit synthetic fixtures in that application test;
  this does not claim production safety or human acoustic acceptance.
- The disposable database and the private provider fixtures created by the
  application test were removed after the assertions passed.
- The browser fixture passed Spanish candidate comparison, selection and save.
  [Studio screenshot](/home/andres/PycharmProjects/magic-worlds-api/.dev/fish-design-contract/2026-10-15/studio-preview.jpg).

The owner-authorized root account also passed a read-only check against the
running development API: Fish creation is available in English/Spanish with
1–4 candidates, and Gabriel remains the sole public Fish starter. The check
caught an exact-version catalogue comparison rejecting the SPA's version-4
header. The fixed route accepts known versions 3/4 for listing, provider filters
and key lookup, while legacy/unknown clients keep their safe behavior. All three
version-4 failures were reproduced before the fix; the focused regression suite
passed afterward (73 tests). The running API then returned 200 for both creation
capabilities and the version-4 catalogue, with no manual server action or
supplier request. The existing approved Gabriel sample also returned 200 and
validated as 386 complete MP3 frames (10,083 ms).
The frontend's local voices feature gate is enabled. See
[live root evidence](evidence/2026-10-15-root-creation.json).

The original sanitized application report is
[2026-10-15-voice-creation.json](evidence/2026-10-15-voice-creation.json).
Raw candidate WAV/signature responses remain in the backend's ignored `.dev/`;
no credentials or signature values are committed.

## Development configuration

The owner-confirmed stopped development database was backed up, restored into a
disposable database and checked row-for-row before the additive request-billing
upgrade. All 99 tables and 3,131 rows were preserved, except the intentional
revision-marker change. That handoff revision was `2026_10_fish_design`; the current database has since
advanced to `2026_10_fish_calls` (101 tables), as recorded in the
[call handoff](18_call_engine_development.md).

Private development configuration enables root voice creation for English and
Spanish and user preview/narration for the approved Spanish voice. The selected
starter is Gabriel (`vk_35d9b99bf23f45704a705c2724f97582`); the owner's actual
qualitative approval is recorded without inventing numeric scores. Production
acceptance is explicitly false. Other references remain admin-only drafts;
English user speech still needs an accepted English voice and its language gate.

New deployments run the original additive Fish migration, then
`scripts/migrations/20261015_fish_design.py` (read-only first, then `--apply` with
workers stopped). The original Fish schema is frozen so its migration remains
independent of the design billing extension. Examples keep all new gates off.
Calls, advanced performance, pronunciation dictionaries and whole-scene work
retain their later-release gates.
