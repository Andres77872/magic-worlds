# Billing: status and documentation

**Lifecycle: active entry point. Reviewed 2026-10-15.** Membership accounting, credit grants, usage limits and the purchase integration exist in source. Payment-provider/catalog agreement and sandbox acceptance remain open. This is not a production checkout certification.

This file owns the implementation status and backlog; use [SETUP.md](SETUP.md) for the maintained gates, startup configuration, disabled-server behavior and release procedure. Prices, example quotas, SQL table sketches and API alternatives from the June commercial proposal are not the runtime configuration.

## Actual implementation status

| Area | Source status | Release boundary |
| --- | --- | --- |
| Membership and usage | Plans, operation limits, reservations, PAYG ledger, root plans/members/usage console and `/user/me` projection exist. Since BFF 6d6138d (2026-10-14) every plan must also carry a `daily_quantity_limit` for `tts_generation` (narration characters) and `voice_call` (call seconds), rejected with 422 when missing and enforced at runtime; `/user/me` reports the matching narration-character and call-second usage fields | Validate administrative audit/reset behavior and matching deployment; checkout opt-in does not establish this acceptance |
| Purchases | Frontend plan/credit purchase UI plus BFF catalog, checkout, portal and reconciliation wrappers exist | Requires frontend opt-in and validated BFF/api.auth configuration/catalog; sandbox acceptance remains open |
| Provider authority | api.auth remote project catalog supplies paid products, prices, lookup keys and credit quantities | Historical local fixtures and proposed pricing tables cannot override the remote catalog |
| Promo/email grants | Redemption/claim routes and credit-token administration exist independently | Preserve grants and quota behavior with checkout off |
| Patreon | Backend entitlement reconciliation is independently gated (`PATREON_PROVIDER_SYNC_ENABLED`); BFF `/patreon/link/*` proxies api.auth's link-proof routes; frontend flag and gated client methods exist | No connect/link UI is implemented; PAT-01 product decision |

The source default for an absent `VITE_BILLING_ENABLED` is false. `.env.example` explicitly opts in, so copying that template changes the purchase surface. Local `.env` absence and backend provider flags were reviewed as configuration evidence only; built/deployed settings were not inspected. [SETUP.md](SETUP.md) records the local snapshot.

## Remaining work

| ID | Status | Completion evidence |
| --- | --- | --- |
| BILL-01 | Open release acceptance | Dated sandbox subscription/credit checkout, portal/cancel/return paths, invalid/unavailable catalog handling, off-mode behavior and idempotent repeated reconciliation, against an api.auth revision that includes the 2026-10-13 billing ownership procedures/triggers (`billing_scope_upgrade.py` applied) with its read-only `billing_ownership_audit.py` report reviewed. **TBD:** no local path reverses credits granted for a credit purchase that is later refunded (reconciliation fulfils only `paid` purchases); decide the intended refund behavior. **TBD:** legal/terms confirmation of credit expiry; purchased PAYG credits are non-expiring in source (the `/user/me` projection) |
| MEMBER-01 | Open membership follow-ups | Durable assignment audit, admin month totals after manual reset and an expanded paid catalog beyond `plus`/`pro`, with regression evidence; plan comparison and membership lifecycle remain TBD decisions. Rechecked 2026-10-15: not addressed by the api.auth 2026-10-13 commits. See [membership administration](../membership-management-review.md) |
| PAT-01 | Product decision pending | Decide whether Patreon account linking belongs in the product; backend reconciliation does not deliver this UI |
| DOC-04 | Dated pricing evidence | Refresh provider costs and reconcile estimates to observed usage before a pricing decision; the June proposal figures are not current evidence; **TBD:** payment countries, taxes/VAT and app-store fees as margin inputs, creator project-level versus player-level quotas, and whether image/TTS usage is available on the free plan |

Named owners and target dates remain unassigned. The shared [roadmap](../ROADMAP.md) owns scheduling. The 2026-10-15 cleanup rechecked the frontend gate/catalog hook, BFF configuration loader and billing routes; it did not recheck the api.auth 2026-10-13 billing ownership changes or the BFF 6d6138d plan quantity caps, which a follow-up 2026-10-15 source audit reflects in the rows above. No payments, provider requests, live account checks, environment changes or application tests were performed.
