/**
 * Orchestration hook for the unified Credit Tokens console. Owns the active
 * inventory (one of credit codes / email grants at a time), the shared
 * filter/search/sort/pagination state, the KPI summary, and the create /
 * disable / edit / CSV-export flows. Search/filter/sort/pagination are all
 * resolved server-side so the console scales to any number of tokens.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type {
    CreditCodeGrant,
    CreditGrantKind,
    CreditGrantListParams,
    CreditGrantListSort,
    CreditGrantListStatus,
    CreditGrantSummaryResponse,
    EmailCreditGrant,
    QuotaResetRequest,
    QuotaResetResponse,
} from '@/shared'
import { downloadCreditGrantsCsv } from '../components/creditCodeCsv'

export interface StudioToast {
    tone: 'success' | 'error'
    title: string
    message?: string
}

/** Identifies which row a pending disable confirmation refers to. */
export interface PendingDisable {
    kind: CreditGrantKind
    id: number
    label: string
}

/** Status filter as shown in the toolbar; `all` clears the server filter. */
export type StatusFilter = CreditGrantListStatus | 'all'

/** Editable fields shared by both grant kinds. */
export interface GrantEditPatch {
    credits?: number | null
    label?: string | null
    expires_at?: string | null
    reason?: string | null
}

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300
const EXPORT_PAGE = 200
const EXPORT_CAP = 1000

export function useCreditCodesStudio(isRoot: boolean) {
    const { t } = useTranslation()

    // Filters (shared across both inventories).
    const [activeType, setActiveType] = useState<CreditGrantKind>('code')
    const [status, setStatus] = useState<StatusFilter>('active')
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<CreditGrantListSort>('recent')

    // Active inventory.
    const [codeGrants, setCodeGrants] = useState<CreditCodeGrant[]>([])
    const [emailGrants, setEmailGrants] = useState<EmailCreditGrant[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [nextOffset, setNextOffset] = useState<number | null>(null)
    const [total, setTotal] = useState<number | null>(null)

    // Cross-cutting surfaces.
    const [summary, setSummary] = useState<CreditGrantSummaryResponse | null>(null)
    const [pendingDisable, setPendingDisable] = useState<PendingDisable | null>(null)
    const [mutatingId, setMutatingId] = useState<number | null>(null)
    const [exporting, setExporting] = useState(false)
    const [resettingQuotas, setResettingQuotas] = useState(false)
    const [lastQuotaReset, setLastQuotaReset] = useState<QuotaResetResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<StudioToast | null>(null)

    // Guards against out-of-order responses overwriting a newer request.
    const requestSeq = useRef(0)

    // Debounce the search box into the server-facing `search` term.
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [searchInput])

    const buildParams = useCallback(
        (offset: number): CreditGrantListParams => ({
            status: status === 'all' ? undefined : status,
            search: search || undefined,
            sort,
            limit: PAGE_SIZE,
            offset,
        }),
        [status, search, sort],
    )

    const refreshSummary = useCallback(async () => {
        if (!isRoot) return
        try {
            setSummary(await apiService.getCreditGrantsSummary())
        } catch {
            // KPI tiles are non-critical; leave the previous snapshot in place.
        }
    }, [isRoot])

    const loadFirstPage = useCallback(async () => {
        if (!isRoot) return
        const seq = ++requestSeq.current
        setLoading(true)
        setError(null)
        try {
            const params = buildParams(0)
            if (activeType === 'code') {
                const res = await apiService.listCreditCodeGrants(params)
                if (seq !== requestSeq.current) return
                setCodeGrants(res.items)
                setNextOffset(res.next_offset)
                setTotal(res.total ?? res.items.length)
            } else {
                const res = await apiService.listEmailCreditGrants(params)
                if (seq !== requestSeq.current) return
                setEmailGrants(res.items)
                setNextOffset(res.next_offset)
                setTotal(res.total ?? res.items.length)
            }
        } catch (err) {
            if (seq !== requestSeq.current) return
            setError(err instanceof Error ? err.message : t('admin.creditCodes.errors.loadCodeGrants'))
        } finally {
            if (seq === requestSeq.current) setLoading(false)
        }
    }, [isRoot, activeType, buildParams, t])

    // Refetch the active inventory whenever the type or any filter changes.
    useEffect(() => {
        if (!isRoot) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadFirstPage()
    }, [isRoot, loadFirstPage])

    // KPI summary on mount.
    useEffect(() => {
        if (!isRoot) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void refreshSummary()
    }, [isRoot, refreshSummary])

    const loadMore = useCallback(async () => {
        if (nextOffset == null || loadingMore) return
        setLoadingMore(true)
        setError(null)
        try {
            const params = buildParams(nextOffset)
            if (activeType === 'code') {
                const res = await apiService.listCreditCodeGrants(params)
                setCodeGrants((current) => [...current, ...res.items])
                setNextOffset(res.next_offset)
            } else {
                const res = await apiService.listEmailCreditGrants(params)
                setEmailGrants((current) => [...current, ...res.items])
                setNextOffset(res.next_offset)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.creditCodes.errors.loadCodeGrants'))
        } finally {
            setLoadingMore(false)
        }
    }, [nextOffset, loadingMore, activeType, buildParams, t])

    /** Re-sync the active inventory + KPI tiles after a create. */
    const handleCreated = useCallback(() => {
        void loadFirstPage()
        void refreshSummary()
    }, [loadFirstPage, refreshSummary])

    const resetMembershipQuotas = useCallback(
        async (request: QuotaResetRequest): Promise<QuotaResetResponse | null> => {
            if (!isRoot || resettingQuotas) return null
            setResettingQuotas(true)
            setError(null)
            try {
                const result = await apiService.resetMembershipQuotas(request)
                setLastQuotaReset(result)
                const periods = result.periods
                    .map((period) => t(`admin.creditCodes.quotaReset.periods.${period}`))
                    .join(', ')
                setToast({ tone: 'success', title: t('admin.creditCodes.quotaReset.toastSuccess'), message: periods })
                return result
            } catch (err) {
                const message = err instanceof Error ? err.message : t('admin.creditCodes.quotaReset.errors.reset')
                setError(message)
                setToast({ tone: 'error', title: t('admin.creditCodes.quotaReset.toastFailed'), message })
                return null
            } finally {
                setResettingQuotas(false)
            }
        },
        [isRoot, resettingQuotas, t],
    )

    const confirmDisable = useCallback(async () => {
        const target = pendingDisable
        setPendingDisable(null)
        if (!target) return
        setMutatingId(target.id)
        setError(null)
        try {
            if (target.kind === 'code') {
                const updated = await apiService.disableCreditCodeGrant(target.id)
                setCodeGrants((current) => current.map((row) => (row.code_id === target.id ? updated : row)))
            } else {
                const updated = await apiService.disableEmailCreditGrant(target.id)
                setEmailGrants((current) => current.map((row) => (row.grant_id === target.id ? updated : row)))
            }
            setToast({ tone: 'success', title: t('admin.creditCodes.toasts.disabled'), message: target.label })
            void refreshSummary()
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.creditCodes.errors.disable')
            setError(message)
            setToast({ tone: 'error', title: t('admin.creditCodes.toasts.disableFailed'), message })
        } finally {
            setMutatingId(null)
        }
    }, [pendingDisable, t, refreshSummary])

    const editGrant = useCallback(
        async (kind: CreditGrantKind, id: number, patch: GrantEditPatch): Promise<boolean> => {
            setMutatingId(id)
            setError(null)
            try {
                if (kind === 'code') {
                    const updated = await apiService.updateCreditCodeGrant(id, patch)
                    setCodeGrants((current) => current.map((row) => (row.code_id === id ? updated : row)))
                } else {
                    const updated = await apiService.updateEmailCreditGrant(id, patch)
                    setEmailGrants((current) => current.map((row) => (row.grant_id === id ? updated : row)))
                }
                setToast({ tone: 'success', title: t('admin.creditCodes.toasts.updated') })
                void refreshSummary()
                return true
            } catch (err) {
                const message = err instanceof Error ? err.message : t('admin.creditCodes.errors.update')
                setError(message)
                setToast({ tone: 'error', title: t('admin.creditCodes.toasts.updateFailed'), message })
                return false
            } finally {
                setMutatingId(null)
            }
        },
        [t, refreshSummary],
    )

    /** Fetch the full filtered set (capped) and download it as CSV. */
    const exportCsv = useCallback(async () => {
        if (!isRoot || exporting) return
        setExporting(true)
        setError(null)
        try {
            const codeRows: CreditCodeGrant[] = []
            const emailRows: EmailCreditGrant[] = []
            for (let offset = 0; offset < EXPORT_CAP; offset += EXPORT_PAGE) {
                const params: CreditGrantListParams = {
                    status: status === 'all' ? undefined : status,
                    search: search || undefined,
                    sort,
                    limit: EXPORT_PAGE,
                    offset,
                }
                if (activeType === 'code') {
                    const res = await apiService.listCreditCodeGrants(params)
                    codeRows.push(...res.items)
                    if (res.items.length < EXPORT_PAGE) break
                } else {
                    const res = await apiService.listEmailCreditGrants(params)
                    emailRows.push(...res.items)
                    if (res.items.length < EXPORT_PAGE) break
                }
            }
            const count = activeType === 'code' ? codeRows.length : emailRows.length
            downloadCreditGrantsCsv(activeType, activeType === 'code' ? codeRows : emailRows)
            setToast({ tone: 'success', title: t('admin.creditCodes.export.done', { count }) })
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.creditCodes.export.failed')
            setError(message)
            setToast({ tone: 'error', title: t('admin.creditCodes.export.failed'), message })
        } finally {
            setExporting(false)
        }
    }, [isRoot, exporting, activeType, status, search, sort, t])

    return {
        // filters
        activeType,
        setActiveType,
        status,
        setStatus,
        searchInput,
        setSearchInput,
        sort,
        setSort,
        // inventory
        codeGrants,
        emailGrants,
        loading,
        loadingMore,
        hasMore: nextOffset != null,
        total,
        loadMore,
        reload: loadFirstPage,
        // summary
        summary,
        // mutations
        pendingDisable,
        setPendingDisable,
        mutatingId,
        confirmDisable,
        editGrant,
        handleCreated,
        resettingQuotas,
        lastQuotaReset,
        resetMembershipQuotas,
        // export
        exporting,
        exportCsv,
        // surfaces
        error,
        setError,
        toast,
        setToast,
    }
}
