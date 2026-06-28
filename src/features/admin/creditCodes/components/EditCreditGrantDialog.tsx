/**
 * Inline edit dialog for an unclaimed credit token (code or email grant).
 * Adjusts credits / label / expiry / reason via the admin PATCH endpoints.
 * Claimed tokens are immutable server-side, so the console never opens this for
 * them.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil } from 'lucide-react'
import type { CreditCodeGrant, CreditGrantKind, EmailCreditGrant } from '@/shared'
import { Button, Field, Icon, Input, Modal } from '@/ui/primitives'
import type { GrantEditPatch } from '../hooks/useCreditCodesStudio'
import { toDateTimeLocal, toIsoOrNull } from './formUtils'

export type EditableGrant = CreditCodeGrant | EmailCreditGrant

interface EditCreditGrantDialogProps {
    open: boolean
    kind: CreditGrantKind
    grant: EditableGrant | null
    saving: boolean
    onSave: (patch: GrantEditPatch) => void
    onClose: () => void
}

/**
 * Seed the form from the opened grant. The parent remounts this component (via
 * a `key` keyed on the target) whenever a different grant is edited, so these
 * initialisers run fresh each time — no re-seeding effect required.
 */
export function EditCreditGrantDialog({ open, kind, grant, saving, onSave, onClose }: EditCreditGrantDialogProps) {
    const { t } = useTranslation()
    const [credits, setCredits] = useState(() => (grant ? String(grant.credits ?? '') : ''))
    const [label, setLabel] = useState(() => grant?.label ?? '')
    const [expiresAt, setExpiresAt] = useState(() => toDateTimeLocal(grant?.expires_at))
    const [reason, setReason] = useState(() => grant?.reason ?? '')

    const subject = grant
        ? kind === 'email'
            ? (grant as EmailCreditGrant).email
            : grant.label || t('admin.creditCodes.codes.untitled')
        : ''

    const creditsValue = Number(credits)
    const creditsValid = Number.isFinite(creditsValue) && creditsValue > 0
    const canSave = creditsValid && !saving

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSave) return
        onSave({
            credits: Math.floor(creditsValue),
            label: label.trim(),
            expires_at: toIsoOrNull(expiresAt),
            reason: reason.trim(),
        })
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="md"
            icon={<Icon icon={Pencil} size={18} className="text-ember-300" />}
            title={t('admin.creditCodes.editDialog.title')}
        >
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <p className="font-ui text-[13px] text-parchment-300">
                    {t('admin.creditCodes.editDialog.subject')}{' '}
                    <span className="font-semibold text-parchment-50">{subject}</span>
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label={t('admin.creditCodes.fields.creditsLabel')}
                        error={creditsValid ? undefined : t('admin.creditCodes.editDialog.creditsError')}
                    >
                        <Input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={credits}
                            onChange={(event) => setCredits(event.target.value)}
                        />
                    </Field>
                    <Field label={t('admin.creditCodes.fields.expiresLabel')} helper={t('admin.creditCodes.editDialog.expiresHelper')}>
                        <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                    </Field>
                </div>
                <Field label={t('admin.creditCodes.fields.labelLabel')} helper={t('admin.creditCodes.fields.labelHelper')}>
                    <Input value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} />
                </Field>
                <Field label={t('admin.creditCodes.fields.reasonLabel')} helper={t('admin.creditCodes.fields.reasonHelper')}>
                    <Input value={reason} maxLength={255} onChange={(event) => setReason(event.target.value)} />
                </Field>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                        {t('admin.common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!canSave}
                        iconLeft={saving ? <Icon icon={Loader2} size={15} className="animate-spin" /> : undefined}
                    >
                        {t('admin.creditCodes.editDialog.save')}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
