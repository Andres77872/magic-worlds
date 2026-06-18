import { useTranslation } from 'react-i18next'
import { Ban, Coins, KeyRound } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { FreeCreditToken } from '@/shared'
import { Badge, Button, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { formatStamp, statusLabel, statusTone } from './creditCodeFormat'

interface CreditTokensListProps {
    tokens: FreeCreditToken[]
    loading: boolean
    disablingId: number | null
    onDisable: (token: FreeCreditToken) => void
}

export function CreditTokensList({ tokens, loading, disablingId, onDisable }: CreditTokensListProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()

    if (tokens.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={KeyRound} size={36} />}
                message={loading ? t('admin.creditCodes.tokens.loading') : t('admin.creditCodes.tokens.empty')}
                secondaryText={loading ? undefined : t('admin.creditCodes.tokens.emptyHint')}
            />
        )
    }

    return (
        <ul className="flex flex-col gap-2">
            {tokens.map((token) => {
                const expiry = formatStamp(token.expires_at, intlLocale)
                const redeemed = formatStamp(token.redeemed_at, intlLocale)
                return (
                    <li
                        key={token.token_id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3"
                    >
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-ui text-sm font-semibold text-parchment-50">
                                    {token.label || t('admin.creditCodes.tokens.untitled')}
                                </span>
                                <Badge tone={statusTone(token.status)}>{statusLabel(token.status, t)}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[12px] text-parchment-400">
                                <span className="inline-flex items-center gap-1 text-ember-300">
                                    <Icon icon={Coins} size={13} />
                                    {t('admin.creditCodes.creditsAmount', { count: token.credits })}
                                </span>
                                {expiry && <span>{t('admin.creditCodes.expiresOn', { date: expiry })}</span>}
                                {redeemed && <span>{t('admin.creditCodes.redeemedOn', { date: redeemed })}</span>}
                            </div>
                        </div>
                        {token.status === 'active' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={<Icon icon={Ban} size={14} />}
                                disabled={disablingId === token.token_id}
                                onClick={() => onDisable(token)}
                            >
                                {t('admin.creditCodes.disable')}
                            </Button>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
