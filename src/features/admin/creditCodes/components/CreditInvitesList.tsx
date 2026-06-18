import { useTranslation } from 'react-i18next'
import { Ban, Coins, Mail } from 'lucide-react'
import { useLanguage } from '@/app/hooks'
import type { FreeCreditInvite } from '@/shared'
import { Badge, Button, Icon } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { formatStamp, statusLabel, statusTone } from './creditCodeFormat'

interface CreditInvitesListProps {
    invites: FreeCreditInvite[]
    loading: boolean
    disablingId: number | null
    onDisable: (invite: FreeCreditInvite) => void
}

export function CreditInvitesList({ invites, loading, disablingId, onDisable }: CreditInvitesListProps) {
    const { t } = useTranslation()
    const { intlLocale } = useLanguage()

    if (invites.length === 0) {
        return (
            <EmptyState
                icon={<Icon icon={Mail} size={36} />}
                message={loading ? t('admin.creditCodes.invites.loading') : t('admin.creditCodes.invites.empty')}
                secondaryText={loading ? undefined : t('admin.creditCodes.invites.emptyHint')}
            />
        )
    }

    return (
        <ul className="flex flex-col gap-2">
            {invites.map((invite) => {
                const expiry = formatStamp(invite.expires_at, intlLocale)
                const redeemed = formatStamp(invite.redeemed_at, intlLocale)
                return (
                    <li
                        key={invite.invite_id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3"
                    >
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-ui text-sm font-semibold text-parchment-50">{invite.email}</span>
                                <Badge tone={statusTone(invite.status)}>{statusLabel(invite.status, t)}</Badge>
                                {invite.claim_status && (
                                    <Badge tone={invite.claim_status === 'redeemed' ? 'live' : invite.claim_status === 'disabled' ? 'neutral' : 'ember'}>
                                        {t(`admin.creditCodes.invites.claimStatus.${invite.claim_status}`, { defaultValue: invite.claim_status })}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[12px] text-parchment-400">
                                <span className="inline-flex items-center gap-1 text-ember-300">
                                    <Icon icon={Coins} size={13} />
                                    {t('admin.creditCodes.creditsAmount', { count: invite.credits })}
                                </span>
                                {invite.label && <span className="truncate">{invite.label}</span>}
                                {expiry && <span>{t('admin.creditCodes.expiresOn', { date: expiry })}</span>}
                                {redeemed && <span>{t('admin.creditCodes.redeemedOn', { date: redeemed })}</span>}
                                {invite.email_delivery_status && (
                                    <span>
                                        {t('admin.creditCodes.invites.deliveryStatus', {
                                            status: t(`admin.creditCodes.invites.delivery.${invite.email_delivery_status}`, {
                                                defaultValue: invite.email_delivery_status,
                                            }),
                                        })}
                                    </span>
                                )}
                            </div>
                        </div>
                        {invite.status === 'active' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={<Icon icon={Ban} size={14} />}
                                disabled={disablingId === invite.invite_id}
                                onClick={() => onDisable(invite)}
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
