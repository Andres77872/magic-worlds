# Cost, privacy and licensing

Snapshot: **2026-10-14**. Prices, promotional dates, account eligibility and terms can change. This document records current primary material and the implementation implications; it does not establish this project's actual contract, enabled privacy settings or invoice.

## Separate models and billing units

**Development verification, October 15:** Plus/Pro is not required for this API
integration. The [developer pricing contract](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
says API access is pay-as-you-go without subscription fees or monthly minimums.
The supplied Free-plan account with prepaid API credit completed real Drama 3
renders. Web-plan credits are a separate balance. See
[development evidence](12_development_validation.md); account-specific charges
still need reconciliation before production.

| Product | Documented price at research date | Unit / qualification |
| --- | --- | --- |
| Drama 3 introduction | $10 per million characters | Launch promotion October 13–November 12, 2026 |
| Drama 3 quoted list | $50 per million characters | Launch announcement's post-promotion reference price |
| S2.1 Pro | $15 per million UTF-8 bytes | General native API pricing table |
| Native ASR, including Pro | $0.36 per audio hour | Successful processed audio, rounded up to the second including silence |
| Voice design | $0.01 per successful request | Candidate count does not multiply that request price |

Drama prices/date window come from the [launch announcement](https://fish.audio/blog/fish-audio-drama-3/); the other entries come from [API pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits). The general pricing page did not list Drama at inspection, so it is not evidence that Drama uses S2 byte pricing. Confirm actual account charges and promo eligibility before implementation.

Do not assume “characters” means Python code points, JavaScript UTF-16 units, UTF-8 bytes, or spoken characters after directives are removed. Determine whether directions, scoped tags, speaker markers and pronunciation substitutions affect the billed quantity. Store both logical and submitted-text sizes while reconciling actual debits.

## Original cost estimates

For an assumed Drama billed-character quantity, arithmetic from the quoted prices is:

| Assumed billed characters | At $10/M | At $50/M |
| --- | --- | --- |
| 1,000 | $0.01 | $0.05 |
| 100,000 | $1.00 | $5.00 |
| 1,000,000 | $10.00 | $50.00 |

These estimates exclude retries, narration variants, design, reference persistence, transcription, taxes and negotiated terms. They are not a quote for a particular script until the billing-count rule is verified.

For S2, compute `len(text.encode("utf-8"))` in the backend. Non-ASCII characters can use multiple bytes; Spanish accents and emoji make a frontend character count inaccurate. Do not compare a million Drama characters to a million S2 bytes as though they were the same quantity.

The existing [spend circuit](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/spend_circuit.py:62) uses a 40 micro-USD/character Flash list estimate and a Flash-equivalent budget. That is an application estimator, not a current ElevenLabs invoice verified here. It cannot simply be reused as Fish's native usage count.

Use a versioned supplier price table with effective dates and a USD-micro budget accumulator. Retain separate application credits: current call delivery accounting should remain a product policy, not become a guessed conversion from Fish input text. Reconcile uncertain/cancelled attempts independently of user refunds.

## Price and balance operations

Record provider, effective model, price-version/date, unit type, estimated units/cost and actual debit where observable. The Fish wallet schema describes decimal credit/top-up amounts as strings; parse monetary values with decimal arithmetic, not floats or ElevenLabs subscription-character logic. [Wallet schema](https://docs.fish.audio/api-reference/openapi.json).

Alert before balance exhaustion and promotion expiry. A low-balance supplier failure is different from a user lacking Magic Worlds credits. Concurrency tier depends on cumulative prepayment, not a new independent limit per API key; do not buy extra keys expecting extra capacity. See [operations](07_best_practices_and_operations.md#account-wide-concurrency).

Recheck the price configuration before November 13. Keep a list-price budget scenario even during the promotion so an accepted product does not become uneconomical when the introduction ends. Free S2 availability is a separate temporary offer and is not a Drama price or a production privacy/SLA commitment. [Changelog](https://docs.fish.audio/developer-guide/getting-started/changelog).

## Hosted data handling

The Customer Agreement describes optional ZDR for designated models/features when enabled. Its restrictions on training/improvement and post-processing retention are prospective and conditional, with limited technical metadata and temporary processing/backup qualifications. Persistence-dependent features have exclusions. This is not a blanket promise that every API account or saved voice has zero retention. [Customer Agreement, section 4.4](https://fish.audio/enterprise-terms/).

The same agreement can become effective through paid account activation/purchase; it is not limited to an individually signed enterprise order. Without enabled eligible ZDR, it permits specified improvement and aggregation uses. Confirm the actual order/account terms and settings rather than inferring them from the URL name.

For Magic Worlds, establish these facts before enabling real user content:

- Does the account's ZDR setting cover Drama 3 HTTP and timestamp WebSockets?
- What processing regions, subprocessors and backup deletion behavior apply?
- What happens to text, generated audio, references and designed candidates under that setting?
- Which persistence features retain voice recordings, and how are they deleted/revoked?
- What usage/error metadata remains and for how long?

The general [privacy policy](https://fish.audio/privacy/) does not establish a project-specific fixed 24-hour deletion rule. No equivalent public Fish history-sweep contract was established in this research. Existing ElevenLabs deletion code cannot support a Fish disclosure without a separate verified mechanism.

Do not send original microphone segments to Fish in phase one: keep current Groq STT and send only approved assistant/narration text plus approved voice references. This minimizes the data flow change. If Fish ASR is later adopted, update the disclosure and retention evaluation for user speech as well.

## Content and voice rights

General terms and the Customer Agreement use different content-rule language. General terms prohibit explicit sexual submissions; do not infer blanket permission from purchasing credits or a differently worded customer section. Preserve the project's current content/moderation boundaries and obtain an account-specific answer for any necessary policy interpretation. [General terms](https://fish.audio/terms/), [Customer Agreement](https://fish.audio/enterprise-terms/).

For catalogue publication, verify the actual voice rights: owned/design provenance, authorized cloning or supplier-licensed use. A public voice ID is an address, not a rights grant. Fish inventory exposes licensed and lifecycle metadata that can inform review, but application acceptance must preserve evidence and respond to takedown/revocation. [Voice inventory](https://docs.fish.audio/api-reference/endpoint/model/list-models).

The current legal copy names ElevenLabs/Groq and describes their handling. Draft revised copy from verified account settings, with separate explanations for transient synthesis text, saved transcripts, local assets and any persistent reference voices. Avoid claims such as “Fish never stores your data” unless they match the exact enabled feature/contract.

## Hosted service versus self-hosted weights

Hosted API terms and model-weight licenses are different contracts. API access does not automatically grant a right to operate a public TTS service from downloaded weights, and a weights license does not establish hosted account privacy settings.

The current Drama community license permits qualifying royalty-free commercial use below US$500,000 in aggregate annual revenue across the user/entity and affiliates, with other conditions and attribution. A hosted TTS API/SaaS offering requires separate written licensing regardless of that threshold; exceptions include certain application/finished-output uses. S2 Pro has a different research-license context. Pin the actual weights/repository revision and review the applicable license against Magic Worlds' product and revenue before self-hosting. [Drama license](https://github.com/fishaudio/fish-speech/blob/main/LICENSE), [S2 Pro model card](https://huggingface.co/fishaudio/s2-pro).

Do not resolve a license mismatch by relying on a model card's metadata badge alone. The artifact's license file and any commercial agreement control the deployment decision. Self-hosting also brings GPU capacity, serving, monitoring, patching and reference security costs; “open weights” is not a complete cost model.

## Decision gates

Before production, confirm actual Drama access/pricing, billing units, retention eligibility, approved voices and supplier balance monitoring. Before self-hosting, additionally resolve the exact weights license and capacity model. These are bounded integration facts to establish, not reasons to defer the documentation or an isolated synthetic-content evaluation.
