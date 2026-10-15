# Fish call engine development

October 15, 2026. M6's engine integration is implemented in both working trees.
**R4 is not accepted and Fish calls remain disabled.** This continues the
[native transport checkpoint](17_call_transport_development.md), preserving its
earlier single native probe as transport evidence. This slice added two bounded
native Spanish engine probes with explicit in-memory application fixtures;
neither is full public-call acceptance.

Gabriel remains the only development starter; English/Spanish root voice
creation is enabled independently. No extra catalogue curation is required to
use the implemented creation workflow.

## Integrated behavior

- The existing call engine selects ElevenLabs or Fish from the resolved voice;
  Groq STT, the conversation engine, access checks, quotas, UI and owned assets
  stay in use. Fish resolves a fixed Drama 3 timestamp-WebSocket profile.
- Each Fish generation has an epoch, bounded input/output queues and its own
  socket. Idle/blocked turns open no native connection or account lease. Normal
  completion sends stop and drains finish; interruption invalidates delivery
  before waiting for cleanup. Stale epochs have no timing or audio rights.
- Shared account admission reserves cumulative compiled UTF-8 input before
  dispatch. Supplier estimates survive uncertain cancellation/partial failure;
  capacity releases once. Legacy ElevenLabs character spend is not charged
  for Fish input. Application billing still meters accepted whole MP3 frames.
- The word ledger registers exact original source geometry before dispatch.
  Metadata-only snapshots update revisions without adding/billing audio.
  Numbers/readings are atomic, direction/events add no dialogue characters,
  unmatched evidence remains explicit and cancellation freezes updates.
  Fish call assets include the compiled performance/source identity.
- Direction and owned immutable pronunciation versions pass moderation before
  controls compile. Optional performance has its own release gate. Native Fish
  failures keep the text reply and accepted audio prefix, without replay or
  voice/provider substitution. No approximate character ledger is substituted.
- Catalogue call approval is separate from narration acceptance. Root can
  explicitly approve an accepted primary-language voice after the call release
  is enabled. Failed language acceptance revokes approval. Missing/unhealthy
  provider call data disables client entry; unrelated numeric controls are
  hidden from Fish catalogue metadata.
- Fish requires expanded `voice-v3` processing consent; `voice-v2` alone is
  stale for Fish. The UI names Fish, direction/pronunciation input, Groq and
  saved AI replies. The new copy is visibly a development draft. The existing
  published default remains `voice-v2`; no consent was recorded by automation.
- A local `mw.voice.first_audible` mark correlates session/turn/segment with
  browser playback and captured end-of-speech timing. It is emitted once,
  carries no content/native reference and rejects cancelled/stale turns.
  Playback state is an audibility proxy, not a hardware measurement.

The backend [API/runbook](/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/fish_calls.md)
documents request bodies, gates, accounting and migration commands.

## Schema and environment

The canonical target is `2026_10_fish_calls` (101 tables). A frozen copy of
`2026_10_fish_performance` remains the exact migration predecessor. The expansion
only widens three checks: call provider, Fish call eligibility and supplier call
attempts. Six resumable DDL phases are verified under the migration lock.

The real isolated-MySQL test passed apply/reapply, all six interrupted phases
and runtime readers at each intermediate shape,
unchanged row fingerprints, cumulative UTF-8 pricing, shared capacity and
cancellation release. Its temporary database was removed. It made no native
Fish requests and did not modify the configured development database.

The configured development database is now upgraded to M6. A fresh private backup
restored 101 tables and 3,269 rows with matching fingerprints before applying.
Every existing row was unchanged except the revision marker; reapplying made no
changes and the API returned ready after applying. The compatible rollout covered all exact DDL
shapes, so a maintenance stop was unnecessary. Fish calls remain explicitly off.
Backup SHA-256:
`4da489aee1ef6b02e4dcfac0b42ae1a605c4410a293afaffa37a2a55b383c427`.

Other deployments must establish compatible readers on every worker with calls
off before applying; use a coordinated maintenance window if that cannot be
verified. Preserve the private backup and do not downgrade to an incompatible
reader after new provider records exist.

## Verification and remaining acceptance

Engine tests exercise the actual Fish bridge with explicit synthetic native
frames and fake STT/conversation fixtures: normal completion, zero-byte timing
revisions, stale epochs, blocked/no-connection input, direction moderation and
partial failure without replay. Pure/source, admission, migration and legacy
ElevenLabs regressions remain covered. Current counts are recorded in the
[machine-readable evidence](evidence/2026-10-15-call-engine.json).

Two bounded native engine probes used the real shared account ledger and Gabriel,
with explicit in-memory STT, conversation, consent and application-billing seams.
No public call, microphone capture, consent write or catalogue change occurred.

| Native case | Observation |
| --- | --- |
| Complete | Valid mono 44.1 kHz / 128 kbps MP3: 108,668 bytes, 6,792 ms, ten accepted audio chunks. All 65 original code points projected, including “24”. One socket close; supplier outcome succeeded; shared lease released. |
| Cancel after first accepted chunk | Cancel frame published after 0.222 ms; native socket closed after 81.343 ms. One accepted audio chunk, no finalized word timing, one close/release. The 220-unit / 2,200 USD-micro supplier estimate remained uncertain. |

Completion's supplier estimate was 77 UTF-8 units / 770 USD micros. Both cases
left zero active local account leases. These are estimates, not actual debit
reconciliation; local release does not establish Fish's internal occupancy.
The completion's first accepted audio arrived after 927 ms (cancel case: 550 ms),
with fake STT/conversation. These are individual engine timings, not browser
p50/p95 or physical cancellation-to-silence measurements.

Private [native engine sample](/home/andres/PycharmProjects/magic-worlds-api/.dev/fish-call-application/2026-10-15/complete-engine-01.mp3),
SHA-256 `9a9f750a47c4f6dc067802a1d2b5e9e744cf81ec0d4993adf92840e7c15e971a`.
Packets and reports are in the same private directory. Dispatch guards prevent
automatic replay of either request. An earlier local label assertion stopped
before dispatch (zero connections/requests); it was corrected before these probes.

Browser inspection used an isolated Storybook preview. The expanded processing
copy, draft label and accurate Fish retention footer were visible. The preview
made no microphone request, native call or consent write; its temporary server
was stopped afterward. Private screenshot:
`.dev/fish-call-validation/consent-preview.jpg` in the frontend repository.

### Authenticated profile follow-up

The owner authorized the existing root test account from the private backend
`.env` on the `.90` development setup. Real BFF login, api.auth token validation
and published system callbot/moderation profile resolution passed. The callbot's
actual graph and reply collector streamed nine chunks, validated a 107-code-point
reply with no tool calls and retained usage. First text arrived at 1,578.794 ms;
the request completed at 4,479.815 ms. This diagnostic used synthetic character
input and did not perform application admission or persistence.

Required moderation did not pass: with the plan warmed, one new synthetic
preview returned `unavailable` after 2,003.164 ms against its 2,000 ms budget. The
call-sentence probe was not dispatched after that failure. Its native outcome is
uncertain after local cancellation; it was not retried and nothing reached Fish.
The configured development classifier remains disabled and moderation optional;
a ready response therefore does not establish required classifier execution.
Neither the environment nor published profiles were changed.

These were two native LLM requests total, zero Fish requests and zero application
content writes. Two earlier private-harness setup failures stopped after login
with zero model requests (auth cookie isolation and float timeout); both were
corrected before dispatch. Credentials/tokens stayed private. See the
[authenticated profile evidence](evidence/2026-10-15-call-profiles.json).

Remaining R4 work is concrete: required moderation must pass its execution
budgets, followed by the full authenticated application flow.
Reconcile actual supplier debit/slot behavior; complete disconnect,
slow-playback and supported-device acceptance; agree and measure end-to-end
p50/p95 and cancellation-to-silence targets. Expanded consent copy and acoustic
release review remain open. These bounded probes do not satisfy
those acceptance gates.

M5 stays independently disabled pending scene identity/order, word and device
review. A subsequent explicit native PCM renderer passed the four-speaker long
boundary and fresh owned application flow after incomplete native MP3 tails;
see the [scene handoff](16_scene_narration_development.md). The overall
integration goal remains active.
