import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AtSign, Loader2, Mail, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'
import { apiService, ApiError } from '@/infrastructure/api'
import type { UserEmail } from '@/shared/types/auth.types'
import { Badge, Button, Card, Icon, IconButton, Input, SectionHeader, Toast } from '@/ui/primitives'

interface Notice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

function isActivated(email: UserEmail): boolean {
    return email.status === 'activated'
}

/**
 * Email-address manager (list / add / resend activation / remove / set primary).
 * Self-fetches via apiService like ProfileSharingSection. Adding an email enqueues
 * an activation link; verifying it (via the emailed link → EmailVerifyPage) is what
 * makes the address usable as a login identifier and for password recovery.
 */
export function EmailSection() {
    const { t } = useTranslation()
    const [emails, setEmails] = useState<UserEmail[] | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [adding, setAdding] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)

    const refresh = async () => {
        try {
            const res = await apiService.listEmails()
            setEmails(res.emails ?? [])
            setLoadError(false)
        } catch {
            setLoadError(true)
        }
    }

    useEffect(() => {
        void refresh()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const email = newEmail.trim()
        if (!email) return
        setAdding(true)
        try {
            await apiService.addEmail(email)
            setNewEmail('')
            setNotice({ tone: 'success', title: t('profile.emails.checkInbox') })
            await refresh()
        } catch (err) {
            setNotice({
                tone: 'error',
                title: t('profile.emails.addError'),
                message: err instanceof ApiError ? err.message : undefined,
            })
        } finally {
            setAdding(false)
        }
    }

    const runAction = async (id: string, action: () => Promise<unknown>, successTitle?: string) => {
        setBusyId(id)
        try {
            await action()
            if (successTitle) setNotice({ tone: 'success', title: successTitle })
            await refresh()
        } catch (err) {
            setNotice({
                tone: 'error',
                title: t('profile.emails.actionError'),
                message: err instanceof ApiError ? err.message : undefined,
            })
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader icon={Mail} title={t('profile.emails.title')} />
            <Card className="flex flex-col gap-4 px-5 py-5">
                <p className="font-ui text-[13px] text-parchment-400">{t('profile.emails.subtitle')}</p>

                {/* Add email */}
                <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Icon icon={AtSign} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400" />
                        <Input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder={t('profile.emails.addPlaceholder')}
                            autoComplete="email"
                            className="pl-10"
                        />
                    </div>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={adding || !newEmail.trim()}
                        iconLeft={adding ? <Loader2 size={15} className="animate-spin" /> : <Icon icon={Plus} size={15} />}
                    >
                        {adding ? t('profile.emails.adding') : t('profile.emails.add')}
                    </Button>
                </form>

                {/* List */}
                {emails === null && !loadError && (
                    <div className="flex items-center gap-2 py-2 text-parchment-400">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="font-ui text-[13px]">{t('common.loading')}</span>
                    </div>
                )}

                {loadError && (
                    <p className="font-ui text-[13px] text-blood-500">{t('profile.emails.loadError')}</p>
                )}

                {emails && emails.length === 0 && (
                    <p className="font-ui text-[13px] text-parchment-400">{t('profile.emails.empty')}</p>
                )}

                {emails && emails.length > 0 && (
                    <ul className="flex flex-col divide-y divide-parchment-50/[.08]">
                        {emails.map((email) => {
                            const busy = busyId === email.id
                            return (
                                <li key={email.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-ui text-[14px] text-parchment-100">
                                            {email.email_masked || email.email || email.id}
                                        </span>
                                        {email.is_primary && (
                                            <Badge tone="ember" icon={<Icon icon={Star} size={11} />}>{t('profile.emails.primaryBadge')}</Badge>
                                        )}
                                        <Badge tone={isActivated(email) ? 'live' : 'neutral'}>
                                            {isActivated(email) ? t('profile.emails.verifiedBadge') : t('profile.emails.pendingBadge')}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        {!isActivated(email) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={busy}
                                                iconLeft={<Icon icon={RefreshCw} size={14} />}
                                                onClick={() => runAction(email.id, () => apiService.resendEmailActivation(email.id), t('profile.emails.checkInbox'))}
                                            >
                                                {t('profile.emails.resend')}
                                            </Button>
                                        )}
                                        {isActivated(email) && !email.is_primary && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={busy}
                                                iconLeft={<Icon icon={Star} size={14} />}
                                                onClick={() => runAction(email.id, () => apiService.setPrimaryEmail(email.id), t('profile.emails.primaryChanged'))}
                                            >
                                                {t('profile.emails.makePrimary')}
                                            </Button>
                                        )}
                                        <IconButton
                                            label={t('profile.emails.remove')}
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => runAction(email.id, () => apiService.removeEmail(email.id), t('profile.emails.removed'))}
                                        >
                                            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                        </IconButton>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </Card>

            <Toast
                open={Boolean(notice)}
                tone={notice?.tone ?? 'success'}
                title={notice?.title ?? ''}
                message={notice?.message}
                onClose={() => setNotice(null)}
                autoCloseMs={notice?.tone === 'success' ? 4000 : undefined}
            />
        </section>
    )
}
