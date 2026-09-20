/**
 * Orchestration hook for the Membership & plans root console. Owns the three
 * data surfaces the page renders — the aggregate overview (KPI tiles + usage
 * breakdown), the plan catalog, and the paginated member list with its
 * server-side plan / search / sort filters — plus the plan create / update,
 * plan assignment, and quota reset flows.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type {
    MembershipAssignRequest,
    MembershipAssignResponse,
    MembershipMember,
    MembershipMemberListParams,
    MembershipMemberSort,
    MembershipOverviewResponse,
    MembershipPlan,
    MembershipPlanCreateRequest,
    MembershipPlanUpdateRequest,
    QuotaResetRequest,
    QuotaResetResponse,
} from '@/shared'

export interface MembershipToast {
    tone: 'success' | 'error'
    title: string
    message?: string
}

/** Plan filter for the member list; `all` clears the server filter. */
export type PlanFilter = string | 'all'

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

export function useMembershipAdmin(isRoot: boolean) {
    const { t } = useTranslation()

    // Overview + plan catalog.
    const [overview, setOverview] = useState<MembershipOverviewResponse | null>(null)
    const [overviewLoading, setOverviewLoading] = useState(false)
    const [plans, setPlans] = useState<MembershipPlan[]>([])
    const [operations, setOperations] = useState<string[]>([])
    const [plansLoading, setPlansLoading] = useState(false)

    // Member list filters (resolved server-side).
    const [planFilter, setPlanFilter] = useState<PlanFilter>('all')
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<MembershipMemberSort>('recent')

    // Member list state.
    const [members, setMembers] = useState<MembershipMember[]>([])
    const [membersLoading, setMembersLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [nextOffset, setNextOffset] = useState<number | null>(null)
    const [total, setTotal] = useState<number | null>(null)

    // Mutations + surfaces.
    const [savingPlan, setSavingPlan] = useState(false)
    const [assigning, setAssigning] = useState(false)
    const [resettingQuotas, setResettingQuotas] = useState(false)
    const [lastQuotaReset, setLastQuotaReset] = useState<QuotaResetResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<MembershipToast | null>(null)

    // Guards against out-of-order member responses overwriting a newer request.
    const requestSeq = useRef(0)

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [searchInput])

    const loadOverview = useCallback(async () => {
        if (!isRoot) return
        setOverviewLoading(true)
        try {
            setOverview(await apiService.getMembershipOverview())
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.membership.errors.loadOverview'))
        } finally {
            setOverviewLoading(false)
        }
    }, [isRoot, t])

    const loadPlans = useCallback(async () => {
        if (!isRoot) return
        setPlansLoading(true)
        try {
            const res = await apiService.listMembershipPlans()
            setPlans(res.items)
            setOperations(res.operations)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.membership.errors.loadPlans'))
        } finally {
            setPlansLoading(false)
        }
    }, [isRoot, t])

    const buildParams = useCallback(
        (offset: number): MembershipMemberListParams => ({
            plan_code: planFilter === 'all' ? undefined : planFilter,
            search: search || undefined,
            sort,
            limit: PAGE_SIZE,
            offset,
        }),
        [planFilter, search, sort],
    )

    const loadMembers = useCallback(async () => {
        if (!isRoot) return
        const seq = ++requestSeq.current
        setMembersLoading(true)
        try {
            const res = await apiService.listMembershipMembers(buildParams(0))
            if (seq !== requestSeq.current) return
            setMembers(res.items)
            setNextOffset(res.next_offset)
            setTotal(res.total)
        } catch (err) {
            if (seq !== requestSeq.current) return
            setError(err instanceof Error ? err.message : t('admin.membership.errors.loadMembers'))
        } finally {
            if (seq === requestSeq.current) setMembersLoading(false)
        }
    }, [isRoot, buildParams, t])

    const loadMore = useCallback(async () => {
        if (nextOffset == null || loadingMore) return
        setLoadingMore(true)
        try {
            const res = await apiService.listMembershipMembers(buildParams(nextOffset))
            setMembers((current) => [...current, ...res.items])
            setNextOffset(res.next_offset)
            setTotal(res.total)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.membership.errors.loadMembers'))
        } finally {
            setLoadingMore(false)
        }
    }, [nextOffset, loadingMore, buildParams, t])

    // Overview + plans on mount; members whenever a filter changes.
    useEffect(() => {
        if (!isRoot) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadOverview()
        void loadPlans()
    }, [isRoot, loadOverview, loadPlans])

    useEffect(() => {
        if (!isRoot) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadMembers()
    }, [isRoot, loadMembers])

    const reload = useCallback(() => {
        setError(null)
        void loadOverview()
        void loadPlans()
        void loadMembers()
    }, [loadOverview, loadPlans, loadMembers])

    const createPlan = useCallback(
        async (body: MembershipPlanCreateRequest): Promise<MembershipPlan | null> => {
            if (!isRoot || savingPlan) return null
            setSavingPlan(true)
            setError(null)
            try {
                const created = await apiService.createMembershipPlan(body)
                setToast({ tone: 'success', title: t('admin.membership.editor.toastCreated'), message: created.display_name })
                void loadPlans()
                void loadOverview()
                return created
            } catch (err) {
                const message = err instanceof Error ? err.message : t('admin.membership.editor.toastCreateFailed')
                setError(message)
                setToast({ tone: 'error', title: t('admin.membership.editor.toastCreateFailed'), message })
                return null
            } finally {
                setSavingPlan(false)
            }
        },
        [isRoot, savingPlan, t, loadPlans, loadOverview],
    )

    const updatePlan = useCallback(
        async (planCode: string, body: MembershipPlanUpdateRequest): Promise<MembershipPlan | null> => {
            if (!isRoot || savingPlan) return null
            setSavingPlan(true)
            setError(null)
            try {
                const updated = await apiService.updateMembershipPlan(planCode, body)
                setPlans((current) => current.map((plan) => (plan.plan_code === planCode ? updated : plan)))
                setToast({ tone: 'success', title: t('admin.membership.editor.toastUpdated'), message: updated.display_name })
                void loadOverview()
                return updated
            } catch (err) {
                const message = err instanceof Error ? err.message : t('admin.membership.editor.toastUpdateFailed')
                setError(message)
                setToast({ tone: 'error', title: t('admin.membership.editor.toastUpdateFailed'), message })
                return null
            } finally {
                setSavingPlan(false)
            }
        },
        [isRoot, savingPlan, t, loadOverview],
    )

    const assignPlan = useCallback(
        async (body: MembershipAssignRequest): Promise<MembershipAssignResponse | null> => {
            if (!isRoot || assigning) return null
            setAssigning(true)
            setError(null)
            try {
                const result = await apiService.assignMembershipPlan(body)
                const plan = plans.find((candidate) => candidate.plan_code === result.plan_code)
                setMembers((current) =>
                    current.map((member) =>
                        member.user_id === result.user_id
                            ? {
                                  ...member,
                                  plan_code: result.plan_code,
                                  plan_display_name: plan?.display_name ?? result.membership.display_name,
                                  daily_credit_limit: plan?.daily_credit_limit ?? result.membership.credits.max,
                                  is_default_plan: plan?.is_default ?? member.is_default_plan,
                                  implicit_free: false,
                                  updated_at: result.changed ? new Date().toISOString() : member.updated_at,
                              }
                            : member,
                    ),
                )
                setToast({
                    tone: 'success',
                    title: result.changed ? t('admin.membership.assign.toastAssigned') : t('admin.membership.assign.toastUnchanged'),
                    message: `${result.username} → ${plan?.display_name ?? result.plan_code}`,
                })
                void loadPlans()
                void loadOverview()
                return result
            } catch (err) {
                const message = err instanceof Error ? err.message : t('admin.membership.assign.toastFailed')
                setError(message)
                setToast({ tone: 'error', title: t('admin.membership.assign.toastFailed'), message })
                return null
            } finally {
                setAssigning(false)
            }
        },
        [isRoot, assigning, plans, t, loadPlans, loadOverview],
    )

    const resetMembershipQuotas = useCallback(
        async (request: QuotaResetRequest): Promise<QuotaResetResponse | null> => {
            if (!isRoot || resettingQuotas) return null
            setResettingQuotas(true)
            setError(null)
            try {
                const result = await apiService.resetMembershipQuotas(request)
                setLastQuotaReset(result)
                const periods = result.periods
                    .map((period) => t(`admin.membership.quotaReset.periods.${period}`))
                    .join(', ')
                setToast({ tone: 'success', title: t('admin.membership.quotaReset.toastSuccess'), message: periods })
                void loadOverview()
                void loadMembers()
                return result
            } catch (err) {
                const message = err instanceof Error ? err.message : t('admin.membership.quotaReset.errors.reset')
                setError(message)
                setToast({ tone: 'error', title: t('admin.membership.quotaReset.toastFailed'), message })
                return null
            } finally {
                setResettingQuotas(false)
            }
        },
        [isRoot, resettingQuotas, t, loadOverview, loadMembers],
    )

    return {
        // overview + plans
        overview,
        overviewLoading,
        plans,
        operations,
        plansLoading,
        // member filters
        planFilter,
        setPlanFilter,
        searchInput,
        setSearchInput,
        sort,
        setSort,
        // member list
        members,
        membersLoading,
        loadingMore,
        hasMore: nextOffset != null,
        total,
        loadMore,
        reload,
        // mutations
        savingPlan,
        createPlan,
        updatePlan,
        assigning,
        assignPlan,
        resettingQuotas,
        lastQuotaReset,
        resetMembershipQuotas,
        // surfaces
        error,
        setError,
        toast,
        setToast,
    }
}
