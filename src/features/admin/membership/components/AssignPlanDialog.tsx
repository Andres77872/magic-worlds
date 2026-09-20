/**
 * "Change plan" dialog for one member. Offers every active plan and explains
 * the ownership consequence of the choice: billing-synced defaults get
 * re-synced from Stripe / Patreon on the next reconcile, custom plans stick.
 *
 * The parent remounts this component (via `key`) per member, so the initial
 * selection is derived once.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Loader2, ShieldAlert, UserRoundCog } from 'lucide-react'
import type { MembershipMember, MembershipPlan } from '@/shared'
import { Badge, Button, Callout, Field, Icon, Input, Modal, Select, type SelectOption } from '@/ui/primitives'

interface AssignPlanDialogProps {
    open: boolean
    member: MembershipMember | null
    plans: MembershipPlan[]
    assigning: boolean
    onConfirm: (planCode: string, reason: string | null) => void
    onClose: () => void
}

export function AssignPlanDialog({ open, member, plans, assigning, onConfirm, onClose }: AssignPlanDialogProps) {
    const { t } = useTranslation()
    const activePlans = plans.filter((plan) => plan.is_active)
    const [planCode, setPlanCode] = useState<string>(() => member?.plan_code ?? '')
    const [reason, setReason] = useState('')

    const selected = activePlans.find((plan) => plan.plan_code === planCode) ?? null
    const unchanged = member != null && planCode === member.plan_code && !member.implicit_free
    const canSubmit = selected != null && !unchanged && !assigning

    const options: SelectOption[] = activePlans.map((plan) => ({
        value: plan.plan_code,
        label: plan.display_name,
        description: plan.plan_code,
    }))

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit || !selected) return
        onConfirm(selected.plan_code, reason.trim() || null)
    }

    const name = member ? member.display_name || member.username : ''

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="md"
            icon={<Icon icon={UserRoundCog} size={18} className="text-ember-300" />}
            title={t('admin.membership.assign.title')}
        >
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {member && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-parchment-50/[.08] bg-ink-700/60 px-3.5 py-3">
                        <div className="min-w-0">
                            <p className="font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-500">
                                {t('admin.membership.assign.subject')}
                            </p>
                            <p className="truncate font-ui text-sm font-semibold text-parchment-50">
                                {name} <span className="font-mono text-meta font-normal text-parchment-400">@{member.username}</span>
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-500">
                                {t('admin.membership.assign.currentPlan')}
                            </span>
                            <Badge tone="neutral">{member.plan_display_name}</Badge>
                        </div>
                    </div>
                )}

                <Field label={t('admin.membership.assign.planLabel')}>
                    <Select
                        options={options}
                        value={planCode || null}
                        onChange={setPlanCode}
                        placeholder={t('admin.membership.assign.planPlaceholder')}
                        disabled={assigning}
                    />
                </Field>

                <Field label={t('admin.membership.assign.reasonLabel')} helper={t('admin.membership.assign.reasonHelper')}>
                    <Input
                        value={reason}
                        maxLength={255}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={t('admin.membership.assign.reasonPlaceholder')}
                        disabled={assigning}
                    />
                </Field>

                {selected && !unchanged && (
                    selected.is_billing_synced ? (
                        <Callout tone="warning" icon={<Icon icon={ShieldAlert} size={16} />} role="note">
                            {t('admin.membership.assign.billingSyncedWarning')}
                        </Callout>
                    ) : selected.is_default ? null : (
                        <Callout tone="info" icon={<Icon icon={Info} size={16} />} role="note">
                            {t('admin.membership.assign.customNote')}
                        </Callout>
                    )
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={assigning}>
                        {t('admin.common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!canSubmit}
                        iconLeft={assigning ? <Icon icon={Loader2} size={15} className="animate-spin" /> : undefined}
                    >
                        {t('admin.membership.assign.confirm')}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
