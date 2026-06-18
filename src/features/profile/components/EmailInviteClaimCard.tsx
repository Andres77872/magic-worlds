import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, Loader2, MailCheck } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { EmailCreditInvite } from '@/shared'
import { Badge, Button, Card, Icon, IconTile, Toast } from '@/ui/primitives'

interface EmailInviteClaimCardProps {
    autoClaim?: boolean
    onClaimed?: () => void
}

interface Notice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

export function EmailInviteClaimCard({ autoClaim = false, onClaimed }: EmailInviteClaimCardProps) {
    const { t } = useTranslation()
    const [invites, setInvites] = useState<EmailCreditInvite[]>([])
    const [totalCredits, setTotalCredits] = useState(0)
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)
    const autoClaimed = useRef(false)

    const refresh = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await apiService.listEmailCreditInvites()
            setInvites(response.items ?? [])
            setTotalCredits(response.total_credits ?? 0)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('membership.emailInvites.loadError'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const claim = async () => {
        if (claiming) return
        setClaiming(true)
        setError(null)
        try {
            const result = await apiService.claimEmailCreditInvites()
            setNotice({
                tone: 'success',
                title: result.credits_added > 0
                    ? t('membership.emailInvites.claimedTitle')
                    : t('membership.emailInvites.noneTitle'),
                message: result.credits_added > 0
                    ? t('membership.emailInvites.claimedBody', { count: result.credits_added })
                    : t('membership.emailInvites.noneBody'),
            })
            await refresh()
            if (result.credits_added > 0) onClaimed?.()
        } catch (err) {
            const message = err instanceof Error ? err.message : t('membership.emailInvites.claimError')
            setError(message)
            setNotice({ tone: 'error', title: t('membership.emailInvites.claimFailed'), message })
        } finally {
            setClaiming(false)
        }
    }

    useEffect(() => {
        if (!autoClaim || autoClaimed.current || loading || invites.length === 0) return
        autoClaimed.current = true
        void claim()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoClaim, loading, invites.length])

    const visibleInvites = useMemo(() => invites.slice(0, 3), [invites])
    const hiddenCount = Math.max(0, invites.length - visibleInvites.length)
    const showCard = loading || error || invites.length > 0

    return (
        <>
            {showCard && (
                <Card className="flex flex-col gap-3 border-ember-500/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                        <IconTile icon={MailCheck} tone="ember" size="sm" />
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-ui text-sm font-semibold text-parchment-50">
                                    {t('membership.emailInvites.cardTitle')}
                                </p>
                                {totalCredits > 0 && (
                                    <Badge tone="ember">{t('membership.emailInvites.creditBadge', { count: totalCredits })}</Badge>
                                )}
                            </div>
                            {loading ? (
                                <span className="flex items-center gap-2 font-ui text-[13px] text-parchment-400">
                                    <Icon icon={Loader2} size={14} className="animate-spin" />
                                    {t('membership.emailInvites.loading')}
                                </span>
                            ) : error ? (
                                <span className="font-ui text-[13px] text-blood-500">{error}</span>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    <p className="font-ui text-[13px] text-parchment-300">
                                        {t('membership.emailInvites.cardBody', { count: invites.length })}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {visibleInvites.map((invite) => (
                                            <span
                                                key={invite.invite_id}
                                                className="rounded-md border border-parchment-50/[.08] bg-ink-800/70 px-2 py-1 font-ui text-[12px] text-parchment-300"
                                            >
                                                {invite.email_masked || t('membership.emailInvites.yourEmail')} - {t('membership.emailInvites.creditCount', { count: invite.credits })}
                                            </span>
                                        ))}
                                        {hiddenCount > 0 && (
                                            <span className="rounded-md border border-parchment-50/[.08] bg-ink-800/70 px-2 py-1 font-ui text-[12px] text-parchment-400">
                                                {t('membership.emailInvites.more', { count: hiddenCount })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        className="shrink-0"
                        disabled={loading || claiming || invites.length === 0}
                        iconLeft={<Icon icon={claiming ? Loader2 : Gift} size={15} className={claiming ? 'animate-spin' : undefined} />}
                        onClick={() => void claim()}
                    >
                        {claiming ? t('membership.emailInvites.claiming') : t('membership.emailInvites.claim')}
                    </Button>
                </Card>
            )}

            <Toast
                open={Boolean(notice)}
                tone={notice?.tone ?? 'success'}
                title={notice?.title ?? ''}
                message={notice?.message}
                onClose={() => setNotice(null)}
                autoCloseMs={notice?.tone === 'success' ? 4000 : undefined}
            />
        </>
    )
}
