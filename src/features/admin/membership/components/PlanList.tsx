/**
 * Plan catalog grid for the Membership & plans console. One card per plan:
 * identity + ownership badges, the included daily allowance, member count, a
 * collapsible per-operation limit list, and Edit / Members actions.
 *
 * Tone semantics: ember marks locally-owned plans (the free fallback and
 * custom plans), arcane marks billing-synced paid defaults, neutral marks an
 * inactive plan.
 */
import { useTranslation } from 'react-i18next'
import { ChevronDown, Layers, Loader2, Lock, Pencil, Plus, Users } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { MembershipPlan } from '@/shared'
import { Badge, Button, Card, Icon, IconTile, cx } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { formatNumber, operationName, orderedLimitEntries, planBadgeTone } from './membershipFormat'

interface PlanListProps {
    plans: MembershipPlan[]
    loading: boolean
    onCreate: () => void
    onEdit: (plan: MembershipPlan) => void
    onViewMembers: (plan: MembershipPlan) => void
}

export function PlanList({ plans, loading, onCreate, onEdit, onViewMembers }: PlanListProps) {
    const { t } = useTranslation()

    if (plans.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={loading ? Loader2 : Layers} size={36} className={loading ? 'animate-spin' : undefined} />}
                message={loading ? t('admin.membership.plans.loading') : t('admin.membership.plans.empty')}
                secondaryText={loading ? undefined : t('admin.membership.plans.emptyHint')}
            />
        )
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-4">
            {plans.map((plan) => (
                <PlanCard key={plan.plan_code} plan={plan} onEdit={onEdit} onViewMembers={onViewMembers} />
            ))}
            <button
                type="button"
                onClick={onCreate}
                className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-parchment-50/15 bg-ink-800/40 p-5 font-ui text-sm font-semibold text-parchment-300 transition-colors hover:border-ember-500/45 hover:text-ember-300"
            >
                <Icon icon={Plus} size={22} />
                {t('admin.membership.plans.create')}
            </button>
        </div>
    )
}

function PlanCard({
    plan,
    onEdit,
    onViewMembers,
}: {
    plan: MembershipPlan
    onEdit: (plan: MembershipPlan) => void
    onViewMembers: (plan: MembershipPlan) => void
}) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()
    const tone = planBadgeTone(plan)
    const limits = orderedLimitEntries(plan.limits)

    return (
        <Card className={cx('flex flex-col gap-4 p-5', !plan.is_active && 'opacity-80')} data-testid={`plan-card-${plan.plan_code}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {plan.is_active ? (
                        <IconTile icon={Layers} tone={tone === 'arcane' ? 'arcane' : 'ember'} size="sm" />
                    ) : (
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-600 text-parchment-300">
                            <Icon icon={Lock} size={20} />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h3 className="truncate font-display text-h3 font-semibold text-parchment-50">{plan.display_name}</h3>
                        <p className="font-mono text-[11px] text-parchment-500">
                            {t('admin.membership.plans.codeLabel')} {plan.plan_code}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {!plan.is_active && <Badge tone="neutral">{t('admin.membership.plans.badges.inactive')}</Badge>}
                {plan.is_default ? (
                    <Badge tone={plan.is_active ? tone : 'neutral'}>{t('admin.membership.plans.badges.default')}</Badge>
                ) : (
                    <Badge tone={plan.is_active ? 'ember' : 'neutral'}>{t('admin.membership.plans.badges.custom')}</Badge>
                )}
                {plan.is_billing_synced && <Badge tone="arcane">{t('admin.membership.plans.badges.billingSynced')}</Badge>}
                {plan.plan_code === 'free' && <Badge tone="neutral">{t('admin.membership.plans.badges.fallback')}</Badge>}
            </div>

            <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col">
                    <span className="font-display text-h2 font-semibold leading-none text-parchment-50">
                        {formatNumber(plan.daily_credit_limit, intlLocale)}
                    </span>
                    <span className="mt-1 font-ui text-[12px] text-fg-subtle">
                        {t('admin.membership.plans.creditsPerDay')}
                    </span>
                </div>
                <span className="inline-flex items-center gap-1 font-ui text-[12px] text-parchment-300">
                    <Icon icon={Users} size={13} />
                    {t('admin.membership.plans.members', { count: plan.member_count })}
                </span>
            </div>

            <details className="group border-t border-line-faint">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 font-ui text-label text-parchment-200 [&::-webkit-details-marker]:hidden">
                    {t('admin.membership.plans.limitsSummary')}
                    <Icon icon={ChevronDown} size={14} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="flex flex-col">
                    {limits.map(([operation, limit]) => (
                        <li
                            key={operation}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-faint py-1.5 last:border-b-0"
                        >
                            <span className="truncate font-ui text-caption font-semibold text-parchment-100">
                                {operationName(operation, t)}
                            </span>
                            <span className="font-ui text-[11px] text-parchment-300">
                                {t('admin.membership.plans.limitRow', {
                                    limit: formatNumber(limit.daily_request_limit, intlLocale),
                                    inFlight: limit.max_in_flight,
                                    cost: limit.credit_cost,
                                })}
                            </span>
                        </li>
                    ))}
                </ul>
            </details>

            <div className="mt-auto flex gap-2">
                <Button variant="secondary" size="sm" iconLeft={<Icon icon={Pencil} size={14} />} onClick={() => onEdit(plan)}>
                    {t('admin.membership.plans.edit')}
                </Button>
                <Button variant="ghost" size="sm" iconLeft={<Icon icon={Users} size={14} />} onClick={() => onViewMembers(plan)}>
                    {t('admin.membership.plans.viewMembers')}
                </Button>
            </div>
        </Card>
    )
}
