/**
 * Member rows for the Membership & plans console: identity, plan badge,
 * today's included usage against the plan allowance, calendar-month ledger
 * credits, PAYG balance, and the Change plan action.
 */
import { useTranslation } from 'react-i18next'
import { Loader2, Users, WalletCards } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { MembershipMember } from '@/shared'
import { Avatar, Badge, Button, Icon, Tag, cx } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { formatDate, formatNumber, percentOf } from './membershipFormat'

interface MembersListProps {
    members: MembershipMember[]
    loading: boolean
    hasMore: boolean
    loadingMore: boolean
    onLoadMore: () => void
    onAssign: (member: MembershipMember) => void
    /** Disables the row actions while an assignment is in flight. */
    busy?: boolean
}

export function MembersList({ members, loading, hasMore, loadingMore, onLoadMore, onAssign, busy = false }: MembersListProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()

    if (members.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={loading ? Loader2 : Users} size={36} className={loading ? 'animate-spin' : undefined} />}
                message={loading ? t('admin.membership.members.loading') : t('admin.membership.members.empty')}
                secondaryText={loading ? undefined : t('admin.membership.members.emptyHint')}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-line-faint" aria-busy={loading || undefined}>
                {members.map((member) => {
                    const name = member.display_name || member.username
                    const since = formatDate(member.started_at, intlLocale)
                    const usedPct = percentOf(member.credits_used_today, member.daily_credit_limit)
                    const exhausted = member.daily_credit_limit > 0 && member.credits_used_today >= member.daily_credit_limit
                    return (
                        <li key={member.user_id} className="flex flex-wrap items-center gap-4 py-4" data-testid={`member-row-${member.user_id}`}>
                            <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3">
                                <Avatar name={name} size={36} ring="ember" />
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="truncate font-ui text-sm font-semibold text-parchment-50">{name}</span>
                                        {member.display_name && (
                                            <span className="truncate font-mono text-meta text-parchment-400">@{member.username}</span>
                                        )}
                                        {member.user_type !== 'consumer' && <Tag>{member.user_type}</Tag>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[12px] text-parchment-400">
                                        <span className="font-mono text-[11px] text-parchment-500">
                                            #{member.user_id} · {member.user_hash}
                                        </span>
                                        {since && <span>{t('admin.membership.members.since', { date: since })}</span>}
                                        {member.implicit_free && <span className="italic">{t('admin.membership.members.implicitFree')}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex basis-[120px] flex-col gap-1">
                                <Badge tone={member.is_default_plan ? (member.plan_code === 'free' ? 'neutral' : 'arcane') : 'ember'}>
                                    {member.plan_display_name}
                                </Badge>
                                <span className="font-mono text-[10px] text-parchment-500">{member.plan_code}</span>
                            </div>

                            <div className="flex basis-[150px] flex-col gap-1">
                                <span className="font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-500">
                                    {t('admin.membership.members.today')}
                                </span>
                                <span className={cx('font-ui text-[13px] font-semibold', exhausted ? 'text-blood-300' : 'text-parchment-100')}>
                                    {t('admin.membership.members.todayValue', {
                                        used: formatNumber(member.credits_used_today, intlLocale),
                                        max: formatNumber(member.daily_credit_limit, intlLocale),
                                    })}
                                </span>
                                <div
                                    role="progressbar"
                                    aria-label={t('admin.membership.members.today')}
                                    aria-valuemin={0}
                                    aria-valuemax={member.daily_credit_limit}
                                    aria-valuenow={Math.min(member.credits_used_today, member.daily_credit_limit)}
                                    className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600"
                                >
                                    <div
                                        className={cx('h-full rounded-full transition-[width]', exhausted ? 'bg-blood-500' : 'bg-ember-500')}
                                        style={{ width: `${usedPct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex basis-[110px] flex-col gap-1">
                                <span className="font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-500">
                                    {t('admin.membership.members.month')}
                                </span>
                                <span className="font-ui text-[13px] font-semibold text-parchment-100">
                                    {t('admin.membership.members.monthValue', { credits: formatNumber(member.credits_used_month, intlLocale) })}
                                </span>
                            </div>

                            <div className="flex basis-[110px] flex-col gap-1">
                                <span className="font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-500">
                                    {t('admin.membership.members.wallet')}
                                </span>
                                <span className="inline-flex items-center gap-1 font-ui text-[13px] font-semibold text-ember-300">
                                    <Icon icon={WalletCards} size={13} />
                                    {t('admin.membership.members.walletValue', { balance: formatNumber(member.payg_balance, intlLocale) })}
                                </span>
                            </div>

                            <div className="ml-auto">
                                <Button variant="secondary" size="sm" disabled={busy} onClick={() => onAssign(member)}>
                                    {t('admin.membership.members.assign')}
                                </Button>
                            </div>
                        </li>
                    )
                })}
            </ul>
            {hasMore && (
                <div className="flex justify-center">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        iconLeft={loadingMore ? <Icon icon={Loader2} size={14} className="animate-spin" /> : undefined}
                    >
                        {t('admin.membership.members.loadMore')}
                    </Button>
                </div>
            )}
        </div>
    )
}
