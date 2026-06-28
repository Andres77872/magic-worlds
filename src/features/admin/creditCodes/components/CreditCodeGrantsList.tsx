import { useTranslation } from 'react-i18next'
import { Ban, Coins, KeyRound, Loader2, Pencil } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { CreditCodeGrant } from '@/shared'
import { Badge, Button, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { formatStamp, statusLabel, statusTone, viewStatus } from './creditCodeFormat'

interface CreditCodeGrantsListProps {
    grants: CreditCodeGrant[]
    loading: boolean
    mutatingId: number | null
    onDisable: (grant: CreditCodeGrant) => void
    onEdit: (grant: CreditCodeGrant) => void
    hasMore: boolean
    loadingMore: boolean
    onLoadMore: () => void
}

export function CreditCodeGrantsList({
    grants,
    loading,
    mutatingId,
    onDisable,
    onEdit,
    hasMore,
    loadingMore,
    onLoadMore,
}: CreditCodeGrantsListProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()

    if (grants.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={KeyRound} size={36} />}
                message={loading ? t('admin.creditCodes.codes.loading') : t('admin.creditCodes.codes.empty')}
                secondaryText={loading ? undefined : t('admin.creditCodes.codes.emptyHint')}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
                {grants.map((grant) => {
                    const view = viewStatus(grant)
                    const expiry = formatStamp(grant.expires_at, intlLocale)
                    const claimed = formatStamp(grant.claimed_at, intlLocale)
                    const created = formatStamp(grant.created_at, intlLocale)
                    const busy = mutatingId === grant.code_id
                    return (
                        <li
                            key={grant.code_id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3"
                        >
                            <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate font-ui text-sm font-semibold text-parchment-50">
                                        {grant.label || t('admin.creditCodes.codes.untitled')}
                                    </span>
                                    <Badge tone={statusTone(view)}>{statusLabel(view, t)}</Badge>
                                    <span className="font-mono text-[11px] text-parchment-500">#{grant.code_id}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[12px] text-parchment-400">
                                    <span className="inline-flex items-center gap-1 text-ember-300">
                                        <Icon icon={Coins} size={13} />
                                        {t('admin.creditCodes.creditsAmount', { count: grant.credits })}
                                    </span>
                                    {expiry && <span>{t('admin.creditCodes.expiresOn', { date: expiry })}</span>}
                                    {claimed && (
                                        <span>
                                            {t('admin.creditCodes.claimedOn', { date: claimed })}
                                            {grant.claimed_by_user_id != null &&
                                                ` · ${t('admin.creditCodes.claimedBy', { id: grant.claimed_by_user_id })}`}
                                        </span>
                                    )}
                                    {created && <span>{t('admin.creditCodes.createdOn', { date: created })}</span>}
                                    {grant.reason && <span className="truncate italic">{grant.reason}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {grant.status !== 'claimed' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={<Icon icon={Pencil} size={14} />}
                                        disabled={busy}
                                        onClick={() => onEdit(grant)}
                                    >
                                        {t('admin.creditCodes.edit')}
                                    </Button>
                                )}
                                {grant.status === 'active' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={<Icon icon={Ban} size={14} />}
                                        disabled={busy}
                                        onClick={() => onDisable(grant)}
                                    >
                                        {t('admin.creditCodes.disable')}
                                    </Button>
                                )}
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
                        {t('admin.creditCodes.loadMore')}
                    </Button>
                </div>
            )}
        </div>
    )
}
