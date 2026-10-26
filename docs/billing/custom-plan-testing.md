# Custom plans and consumer limit validation

Validated on October 17, 2026 using the root management routes, consumer profile routes, and a disposable MySQL 8.4 instance.

## Give a consumer a testing plan

1. Open **Membership & plans → Plans → New plan** as a root user.
2. Set a permanent plan code, display name, and included daily credits. Use **Start from** to copy an existing plan's operation limits.
3. Configure daily request allowances, concurrency, and operation costs. Narration also requires a daily character cap; calls require a daily seconds cap. **Configure all operations** reveals limits for features hidden by the current frontend configuration.
4. Save the plan, open **Members**, find the consumer, and choose **Change plan**. Select the custom plan and save the assignment.
5. Later edits to that plan apply to its existing members. Usage already consumed today remains consumed. Assign the consumer back to another plan when testing ends.

Root can edit custom names, included credits, active status, and every operation limit. A plan with active members cannot be deactivated; move its members first. Consumer and admin accounts cannot create, edit, or assign plans.

Plan quotas and frontend feature availability are separate. Configuring a hidden operation prepares its limits; the app's feature configuration still controls whether its consumer interface is shown.

## What the limits mean

| Control | Consumer behavior |
| --- | --- |
| Included daily credits | Shared across charged operations. Plan changes preserve today's consumption. |
| Daily operation allowance | Limits included use. Existing PAYG policy allows overage when the wallet can pay. |
| LLM requests on the consumer's own key | Use the plan's separate daily request capacity and spend no app credits. |
| Media concurrency | Counts current pending/running jobs, including jobs committed after a request's earlier database snapshot. |
| Narration daily quantity | Standard-equivalent characters across the account's turns. Zero allows no additional narration. |
| Call daily quantity | A hard seconds cap, also bounded by the global call ceiling. Zero allows no calls. |
| Image cost | Comes from the selected image profile. The root plan editor preserves the stored plan field. |
| Voice cost | Narration and calls use their existing character/duration pricing; previews use the preview meter's pricing. These rates are separate from the plan's editable daily quantities. |

## Tests that exercise the real database

[Custom-plan integration tests](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_membership_custom_plan_database.py) create and drop a random database per test on an explicitly supplied isolated MySQL socket. They exercise actual FastAPI routes, plan persistence, account summaries, credit ledgers, LLM admission, media job storage, narration accounting, and call quota reservations. Test identity is supplied by a dependency override so root and consumer authorization can be exercised without an external identity provider. No generation provider is called.

| Scenario | Assertions |
| --- | --- |
| Root plan lifecycle | Create, read, edit every limit, assign by ID/hash, list members, prevent retirement with members, deactivate and reactivate. |
| Authorization and validation | Consumer/admin management requests return 403; incomplete operations, missing voice caps, and invalid concurrency return 422 without persisting a plan. |
| Consumer credits and requests | Custom costs debit the real ledger; request and credit exhaustion reject further admission; root increases apply immediately. |
| Own-key capacity | Daily capacity is enforced and updated by root without spending app credits. |
| Media concurrency | An old transaction snapshot cannot admit a second job into a one-job plan; increasing the plan cap admits it. |
| Voice quantities | Narration and call usage consume the custom allowances; edits increase remaining capacity; zero caps block further use. |

From the backend repository, with an isolated MySQL socket available:

```bash
LLM_PROFILE_TEST_MYSQL_SOCKET=/path/to/isolated/mysqld.sock \
  .venv/bin/python -m pytest -q \
  tests/integration/test_membership_custom_plan_database.py \
  tests/integration/test_membership_payer_database.py \
  tests/integration/test_llm_execution_admission_database.py \
  tests/integration/test_turn_charge_workspace_database.py
```

The frontend interaction tests cover creating and assigning plans, required quantities, preserving image pricing, all nine runtime operations, configuring hidden operations, and retaining those edits when the extra rows are collapsed.

```bash
pnpm exec vitest run --exclude '**/.claude/**' --exclude '**/.codex/**' \
  src/features/admin/membership src/features/profile \
  src/shared/voice/voiceUsage.test.ts
```

The nested-worktree exclusions keep the run scoped to this checkout.
