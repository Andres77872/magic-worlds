import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Loader2, TriangleAlert } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { FreeCreditToken } from '@/shared'
import { Button, Eyebrow, Field, Icon, Input } from '@/ui/primitives'
import { CopyTextButton } from '@/ui/components'
import type { StudioToast } from '../hooks/useCreditCodesStudio'
import { toIsoOrNull } from './formUtils'

interface CreateCreditTokenFormProps {
    onCreated: (token: FreeCreditToken) => void
    notify: (toast: StudioToast) => void
    setError: (message: string | null) => void
}

export function CreateCreditTokenForm({ onCreated, notify, setError }: CreateCreditTokenFormProps) {
    const { t } = useTranslation()
    const [credits, setCredits] = useState('100')
    const [label, setLabel] = useState('')
    const [expiresAt, setExpiresAt] = useState('')
    const [reason, setReason] = useState('')
    const [creating, setCreating] = useState(false)
    const [created, setCreated] = useState<FreeCreditToken | null>(null)

    const creditsValue = Number(credits)
    const creditsValid = Number.isFinite(creditsValue) && creditsValue > 0
    const canCreate = creditsValid && !creating

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canCreate) return
        setCreating(true)
        setError(null)
        try {
            const token = await apiService.createFreeCreditToken({
                credits: Math.floor(creditsValue),
                label: label.trim() || null,
                expires_at: toIsoOrNull(expiresAt),
                reason: reason.trim() || null,
            })
            setCreated(token)
            setLabel('')
            setExpiresAt('')
            setReason('')
            notify({ tone: 'success', title: t('admin.creditCodes.tokens.toastCreated'), message: label.trim() || undefined })
            onCreated(token)
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin.creditCodes.errors.createToken')
            setError(message)
            notify({ tone: 'error', title: t('admin.creditCodes.tokens.toastCreateFailed'), message })
        } finally {
            setCreating(false)
        }
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
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
                    disabled={!canCreate}
                    iconLeft={<Icon icon={creating ? Loader2 : KeyRound} size={15} className={creating ? 'animate-spin' : undefined} />}
                >
                    {t('admin.creditCodes.tokens.create')}
                </Button>
            </div>

            {created?.token && (
                <div className="flex flex-col gap-2 rounded-lg border border-ember-500/30 bg-ember-500/[.08] px-4 py-3">
                    <Eyebrow tone="ember">{t('admin.creditCodes.tokens.revealTitle')}</Eyebrow>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md bg-ink-900/60 px-3 py-2 font-mono text-[13px] text-parchment-50">
                            {created.token}
                        </code>
                        <CopyTextButton text={created.token} size="md" />
                    </div>
                    <p className="flex items-start gap-1.5 font-ui text-[12px] text-parchment-300">
                        <Icon icon={TriangleAlert} size={13} className="mt-0.5 shrink-0 text-ember-300" />
                        {t('admin.creditCodes.tokens.revealHint')}
                    </p>
                </div>
            )}
        </form>
    )
}
