/**
 * Filter bar for the Members tab: debounced search, plan filter, sort, and the
 * total count. Every filter resolves server-side through
 * {@link useMembershipAdmin}.
 */
import { useTranslation } from 'react-i18next'
import { Loader2, Search, X } from 'lucide-react'
import type { MembershipMemberSort, MembershipPlan } from '@/shared'
import { Icon, IconButton, Select, controlClass, cx, type SelectOption } from '@/ui/primitives'
import type { PlanFilter } from '../hooks/useMembershipAdmin'

interface MembersToolbarProps {
    plans: MembershipPlan[]
    planFilter: PlanFilter
    onPlanFilterChange: (value: PlanFilter) => void
    search: string
    onSearchChange: (value: string) => void
    searching: boolean
    sort: MembershipMemberSort
    onSortChange: (sort: MembershipMemberSort) => void
    total: number | null
}

const SORTS: MembershipMemberSort[] = ['recent', 'usage_today', 'usage_month', 'payg', 'username']

export function MembersToolbar({
    plans,
    planFilter,
    onPlanFilterChange,
    search,
    onSearchChange,
    searching,
    sort,
    onSortChange,
    total,
}: MembersToolbarProps) {
    const { t } = useTranslation()
    const hasQuery = search.length > 0

    const planOptions: SelectOption[] = [
        { value: 'all', label: t('admin.membership.members.allPlans') },
        ...plans.map((plan) => ({ value: plan.plan_code, label: plan.display_name, description: plan.plan_code })),
    ]
    const sortOptions: SelectOption[] = SORTS.map((value) => ({ value, label: t(`admin.membership.members.sort.${value}`) }))

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex items-center sm:w-[280px]">
                    <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                        <Icon icon={Search} size={15} />
                    </span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') onSearchChange('')
                        }}
                        placeholder={t('admin.membership.members.searchPlaceholder')}
                        aria-label={t('admin.membership.members.searchPlaceholder')}
                        className={cx(controlClass, 'rounded-full py-2 pl-9', hasQuery ? 'pr-9' : 'pr-3')}
                    />
                    {searching && <Loader2 className="absolute right-9 animate-spin text-ember-500" size={15} aria-hidden />}
                    {hasQuery && (
                        <IconButton
                            size="sm"
                            onClick={() => onSearchChange('')}
                            label={t('admin.membership.members.clearSearch')}
                            className="absolute right-1"
                        >
                            <Icon icon={X} size={15} />
                        </IconButton>
                    )}
                </div>
                <div className="sm:w-[190px]">
                    <Select
                        size="sm"
                        options={planOptions}
                        value={planFilter}
                        onChange={(value) => onPlanFilterChange(value)}
                        aria-label={t('admin.membership.members.planFilterLabel')}
                    />
                </div>
                <div className="sm:w-[190px]">
                    <Select
                        size="sm"
                        options={sortOptions}
                        value={sort}
                        onChange={(value) => onSortChange(value as MembershipMemberSort)}
                        aria-label={t('admin.membership.members.sortLabel')}
                    />
                </div>
            </div>
            {total != null && (
                <span className="font-ui text-[12px] text-parchment-400">{t('admin.membership.members.total', { count: total })}</span>
            )}
        </div>
    )
}
