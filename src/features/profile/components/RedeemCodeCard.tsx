/**
 * End-user "usage" side of the credit-code system: a small affordance in the
 * membership area that redeems a code via `POST /billing/credits/redeem` and
 * asks the profile to refresh so the wallet balance reflects the new credits.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, Loader2, Ticket } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import { Button, Card, Field, Icon, IconTile, Input, Modal, Toast } from '@/ui/primitives'

interface RedeemCodeCardProps {
    /** Called after a successful redeem so the container can re-fetch /user/me. */
    onRedeemed?: () => void
}

const FORM_ID = 'redeem-code-form'

export function RedeemCodeCard({ onRedeemed }: RedeemCodeCardProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<{ title: string; message?: string } | null>(null)

    const canSubmit = code.trim().length > 0 && !submitting

    const close = () => {
        if (submitting) return
        setOpen(false)
        setCode('')
        setError(null)
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit) return
        setSubmitting(true)
        setError(null)
        try {
            const result = await apiService.redeemCreditCode(code.trim())
            setOpen(false)
            setCode('')
            setToast({
                title: t('membership.redeem.successTitle'),
                message: t('membership.redeem.successBody', { count: result.credits_added }),
            })
            onRedeemed?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : t('membership.redeem.error'))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <IconTile icon={Ticket} tone="ember" size="sm" />
                    <div className="min-w-0">
                        <p className="font-ui text-sm font-semibold text-parchment-50">{t('membership.redeem.cardTitle')}</p>
                        <p className="font-ui text-[13px] text-parchment-400">{t('membership.redeem.cardBody')}</p>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    iconLeft={<Icon icon={Gift} size={15} />}
                    onClick={() => setOpen(true)}
                >
                    {t('membership.redeem.button')}
                </Button>
            </Card>

            <Modal
                open={open}
                onClose={close}
                title={t('membership.redeem.modalTitle')}
                icon={<Icon icon={Ticket} size={20} className="text-ember-400" />}
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={close} disabled={submitting}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form={FORM_ID}
                            variant="primary"
                            disabled={!canSubmit}
                            iconLeft={<Icon icon={submitting ? Loader2 : Gift} size={15} className={submitting ? 'animate-spin' : undefined} />}
                        >
                            {t('membership.redeem.submit')}
                        </Button>
                    </>
                }
            >
                <form id={FORM_ID} onSubmit={(event) => void handleSubmit(event)}>
                    <Field
                        label={t('membership.redeem.codeLabel')}
                        error={error ?? undefined}
                        helper={t('membership.redeem.codeHelper')}
                    >
                        <Input
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            placeholder={t('membership.redeem.codePlaceholder')}
                            autoFocus
                            autoComplete="off"
                            className="font-mono"
                        />
                    </Field>
                </form>
            </Modal>

            {toast && (
                <Toast
                    open
                    tone="success"
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                    autoCloseMs={4000}
                />
            )}
        </>
    )
}
