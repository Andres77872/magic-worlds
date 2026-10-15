# Development validation — October 15, 2026

The owner supplied a temporary development API key with a stated 48-hour life
and authorized synthetic-content testing on the existing Free-plan account.
The [redacted evidence snapshot](evidence/2026-10-15-development.json) records
request sizes, audio hashes, debit observations and database checks.
The key is configured only in the ignored backend `.env` (mode `0600`). The
tracked `.env.example` documents the settings with a blank key. It is absent
from source, tests, documentation, compose and example configuration.

## API access and subscriptions

Plus or Pro is not required for this integration's native API usage. Fish's
[developer pricing documentation](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
specifies pay-as-you-go API access without subscription fees/monthly minimums.
Its [creator plans](https://fish.audio/plan/) are a separate offering; their
FAQ wording about API eligibility conflicts with the explicit developer contract.
The actual development key authenticated and completed native synthesis, so
there is no access failure requiring a web-plan upgrade here.

## Native HTTP evidence

Read-only discovery verified an API-credit wallet, complete owned inventory
(one entry) and available provider-licensed English/Spanish references. Testing
used licensed references rather than the account's private voice.

| Render | Reference | Submitted characters / UTF-8 bytes | Validated duration |
| --- | --- | --- | --- |
| English neutral | `6d71c24e892b467ebef21f3dd3f4810a` | 54 / 54 | 4,859 ms |
| Spanish neutral | `53ac6dc4ad314fed88aa28732ad9c87d` | 73 / 74 | 6,113 ms |
| English calm cue | Same English reference | 75 / 75 | 4,859 ms |
| Explicit opt-in contract test | Same English reference | 54 / 54 | Test passed |

All four requests used the application adapter with exact `model: drama-3`,
native JSON, no provider seed and no numeric ElevenLabs settings. The adapter
validated MP3 frames; independent `ffprobe` inspection confirmed MP3, mono,
44.1 kHz and 128 kbps. The opted-in native test passed once. The development
samples remain available locally:

- [English neutral](/tmp/fish-development-validation/en-neutral.mp3)
- [Spanish neutral](/tmp/fish-development-validation/es-neutral.mp3)
- [English calm](/tmp/fish-development-validation/en-calm.mp3)

The owner listened to the neutral samples: Spanish was approved as "perfect";
English was rejected for a metallic sound and bad pitch. Keep the licensed
Spanish reference `53ac6dc4ad314fed88aa28732ad9c87d` for development. The private
environment now approves only `es` and points the synthetic staging probe at
that reference with Spanish text. The rejected English reference is not enabled.
Full language-corpus, direction, long narration and device playback acceptance
remain open; the sample approval does not establish production acceptance.

## Integrated application flow

The [application-flow evidence](evidence/2026-10-15-application-flow.json)
records a passing opt-in test through real application routes, MySQL DAOs,
provider admission, native HTTP and owned storage. It imported licensed EN/ES
references as drafts, exercised catalogue negotiation and a Fish v3 preset,
rendered four stock-text previews, verified free cache hits and charged one
application credit for the fourth miss after three free previews. It then
resolved a saved narrator assignment, completed a real narration job with an
owned MP3 and one turn charge, and reused that job without a new supplier call.

The passing run made five native requests. Earlier fixture debugging made
twelve additional successful preview requests before database assertions failed;
together with the four initial probes and one final approved-Spanish configuration
smoke, development validation used 22 native renders. This is not an invoice-level
cost reconciliation.

Every app record was disposable and the generated database was removed in
cleanup. Identity, account prerequisites, moderation and listening acceptance
were synthetic fixtures. This proves the integrated media/billing path; real
authorization and safety regression tests remain separately automated, and no
listening verdict or public reference was written to the shared database.

## Billing observations

The authenticated [developer dashboard](https://fish.audio/app/developers/)
shows the account on the Free plan with an API balance denominated in dollars.
Its current Drama 3 price is **$10 per million UTF-8 bytes**. The counting unit
is therefore taken from this account's pricing table, rather than the launch
post's wording about characters. The dashboard currently displays five
concurrent requests shared across keys; development remains capped at one.

Immediate wallet reads showed no debit. A later account-wide balance reduction
of `0.006425` cannot be attributed to the four tests: the dashboard also shows
other model/key traffic. There is no request-level receipt, so that balance
change is not used to infer a price or counting rule.

The private development environment now uses UTF-8 bytes and the observed
$10/M rate with a dated price version. The tracked example retains a $50/M
ceiling in the same unit. The dashboard advertises a temporary launch offer;
recheck pricing before production or after the offer ends. Application credits
remain separate from supplier dollars, and actual debit reconciliation remains
an acceptance item.

## Migration and compatibility evidence

The initial read-only check recognized the configured database's
`2026_10_voice_native` revision and ten pending additive steps, including its
real MySQL check-clause formatting.

A separate, randomly named temporary database was provisioned from the frozen
native schema, upgraded through the real migration, verified against the new
canonical schema and removed afterwards. Existing synthetic ElevenLabs catalogue
and preset records survived unchanged; Fish v3 records were accepted and invalid
provider/version pairs were refused. The isolated MySQL test passed.
The same test verified account admission across two workers with a real row
lock, conditional duplicate release and retained uncertain spend; configured
budget exhaustion refused a further reservation.

The owner subsequently confirmed this is the development database and all API
workers were stopped. A private `0600` SQL backup captured 97 tables and 3,069
rows under a consistent snapshot. A complete restore into a fresh temporary
database reproduced every row fingerprint and passed native schema verification;
that temporary database was then removed. The ten-step additive migration was
applied to the confirmed development database and verified at
`2026_10_fish_audio`. Every pre-existing row fingerprint stayed identical except
the intentionally advanced revision marker. The backup is in the backend's
ignored `.dev/backups/` directory.

The accepted Spanish reference is now persisted as admin-only draft
`vk_35d9b99bf23f45704a705c2724f97582`. Its metadata records the owner's actual
sample feedback. No numeric listening scores or production acceptance were
invented. At that initial handoff English was not imported; later distinct
audition references were imported as drafts without accepting their quality.

Additional audit regressions prove old clients cannot clear/replace saved Fish
assignments, Fish breaker events retain their provider, root-only reference work
requires account readiness and rights, and partial migration states are recognized
without accepting changed constraints.

## Configuration and remaining gates

The temporary key/account/Spanish-reference settings are saved. Provider/account
readiness is enabled for development. The owner subsequently selected Gabriel
for the first release and prioritized EN/ES voice creation; the current handoff
enables creation in both languages and approved Spanish preview/narration.
The owner's qualitative development pass has no invented numeric scores.
See the [voice-creation handoff](13_voice_creation_development.md). The review
uses the supplier's standard [retention policy](https://fish.audio/privacy/),
which does not establish zero retention or a fixed API deletion deadline.
Only synthetic development content was sent. There is no production retention
approval, public publication on Fish or production deployment. Gabriel alone is
published inside the confirmed development application's catalogue.

When a live request reports expired/invalid credentials, request a replacement
from the owner. Do not embed the temporary key in an artifact or assume its
48-hour lifetime starts from the time of this report.
