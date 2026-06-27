import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Send } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { EmailCreditGrant } from '@/shared'
import { Button, Field, Icon, Input, Textarea } from '@/ui/primitives'
import type { StudioToast } from '../hooks/useCreditCodesStudio'
import { parseEmails, toIsoOrNull } from './formUtils'

interface CreateEmailCreditGrantsFormProps {
    onCreated: (grants: EmailCreditGrant[]) => void
    notify: (toast: StudioToast) => void
    setError: (message: string | null) => void
}

const MAX_EMAILS = 500

export function CreateEmailCreditGrantsForm({ onCreated, notify, setError }: CreateEmailCreditGrantsFormProps) {
    const { t } = useTranslation()
    const [emailsRaw, setEmailsRaw] = useState('')
    const [credits, setCredits] = useState('100')
    const [label, setLabel] = useState('')
    const [expiresAt, setExpiresAt] = useState('')
    const [reason, setReason] = useState('')
    const [sending, setSending] = useState(false)

    const emails = useMemo(() => parseEmails(emailsRaw), [emailsRaw])
    const creditsValue = Number(credits)
    const creditsValid = Number.isFinite(creditsValue) && creditsValue > 0
    const tooMany = emails.length > MAX_EMAILS
    const canSend = emails.length > 0 && !tooMany && creditsValid && !sending

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSend) return
        setSending(true)
        setError(null)
        try {
            const created = await apiService.createEmailCreditGrants({
                emails,
                credits: Math.floor(creditsValue),
                label: label.trim() || null,
                expires_at: toIsoOrNull(expiresAt),
                reason: reason.trim() || null,
            })
            setEmailsRaw('')
            setLabel('')
            setExpiresAt('')
            setReason('')
            notify({
                tone: 'success',
                title: t('admin.creditCodes.emailGrants.toastCreated'),
                message: t('admin.creditCodes.emailGrants.toastCreatedCount', { count: created.length }),
            })
            onCreated(created)
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.creditCodes.errors.createEmailGrants')
            setError(message)
            notify({ tone: 'error', title: t('admin.creditCodes.emailGrants.toastCreateFailed'), message })
        } finally {
            setSending(false)
        }
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
            <Field
                label={t('admin.creditCodes.emailGrants.emailsLabel')}
                error={tooMany ? t('admin.creditCodes.emailGrants.tooMany', { max: MAX_EMAILS }) : undefined}
                helper={t('admin.creditCodes.emailGrants.emailsHelper', { count: emails.length })}
            >
                <Textarea
                    value={emailsRaw}
                    onChange={(event) => setEmailsRaw(event.target.value)}
                    placeholder={t('admin.creditCodes.emailGrants.emailsPlaceholder')}
                />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('admin.creditCodes.fields.creditsLabel')} helper={t('admin.creditCodes.fields.creditsHelper')}>
                    <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={credits}
                        onChange={(event) => setCredits(event.target.value)}
                        placeholder="100"
                    />
                </Field>
                <Field label={t('admin.creditCodes.fields.expiresLabel')} helper={t('admin.creditCodes.fields.expiresHelper')}>
                    <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                </Field>
            </div>
            <Field label={t('admin.creditCodes.fields.labelLabel')} helper={t('admin.creditCodes.fields.labelHelper')}>
                <Input
                    value={label}
                    maxLength={120}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={t('admin.creditCodes.fields.labelPlaceholder')}
                />
            </Field>
            <Field label={t('admin.creditCodes.fields.reasonLabel')} helper={t('admin.creditCodes.fields.reasonHelper')}>
                <Input
                    value={reason}
                    maxLength={255}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t('admin.creditCodes.fields.reasonPlaceholder')}
                />
            </Field>
            <div className="flex justify-end">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={!canSend}
                    iconLeft={<Icon icon={sending ? Loader2 : Send} size={15} className={sending ? 'animate-spin' : undefined} />}
                >
                    {t('admin.creditCodes.emailGrants.create')}
                </Button>
            </div>
        </form>
    )
}
