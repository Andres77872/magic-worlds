/**
 * Create / edit dialog for a membership plan. Owns the code, display name,
 * included daily credits, active flag, and the full per-operation limit table.
 *
 * Ownership rules mirror the backend: default plans cannot be deactivated and
 * billing-synced paid defaults keep their name and daily credits read-only
 * (they mirror api.auth's Stripe catalog). Custom plans are fully editable.
 *
 * The parent remounts this component (via `key`) whenever a different plan is
 * opened, so the initial state is derived once and never re-seeded.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, Loader2, Pencil } from 'lucide-react'
import type {
    MembershipPlan,
    MembershipPlanCreateRequest,
    MembershipPlanLimit,
    MembershipPlanUpdateRequest,
} from '@/shared'
import { Button, Callout, Field, Icon, Input, Modal, Select, SwitchRow, controlClass, cx, type SelectOption } from '@/ui/primitives'
import { operationName } from './membershipFormat'

export type PlanEditorMode = 'create' | 'edit'

interface PlanEditorDialogProps {
    open: boolean
    mode: PlanEditorMode
    /** The plan being edited (edit mode). Ignored in create mode. */
    plan: MembershipPlan | null
    /** Whole catalog, used for the "start from" limit presets. */
    plans: MembershipPlan[]
    /** Every runtime operation a plan must define a limit for, in display order. */
    operations: string[]
    saving: boolean
    onCreate: (body: MembershipPlanCreateRequest) => void
    onUpdate: (planCode: string, body: MembershipPlanUpdateRequest) => void
    onClose: () => void
}

type LimitField = keyof MembershipPlanLimit
type LimitDraft = Record<LimitField, string>
type LimitsDraft = Record<string, LimitDraft>

const PLAN_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/
const LIMIT_FIELDS: LimitField[] = ['daily_request_limit', 'max_in_flight', 'credit_cost']
const LIMIT_MINIMUMS: Record<LimitField, number> = { daily_request_limit: 0, max_in_flight: 1, credit_cost: 1 }

function draftFromLimits(operations: string[], limits: Record<string, MembershipPlanLimit> | undefined): LimitsDraft {
    return Object.fromEntries(
        operations.map((operation) => {
            const limit = limits?.[operation]
            return [
                operation,
                {
                    daily_request_limit: limit ? String(limit.daily_request_limit) : '',
                    max_in_flight: limit ? String(limit.max_in_flight) : '1',
                    credit_cost: limit ? String(limit.credit_cost) : '1',
                },
            ]
        }),
    )
}

function parseLimit(draft: LimitDraft | undefined): MembershipPlanLimit | null {
    if (!draft) return null
    const parsed = {} as MembershipPlanLimit
    for (const field of LIMIT_FIELDS) {
        const raw = draft[field] ?? ''
        const value = Number(raw)
        if (raw.trim() === '' || !Number.isInteger(value) || value < LIMIT_MINIMUMS[field]) return null
        parsed[field] = value
    }
    return parsed
}

function parseLimits(operations: string[], drafts: LimitsDraft): Record<string, MembershipPlanLimit> | null {
    const result: Record<string, MembershipPlanLimit> = {}
    for (const operation of operations) {
        const parsed = parseLimit(drafts[operation])
        if (!parsed) return null
        result[operation] = parsed
    }
    return result
}

function limitsEqual(a: Record<string, MembershipPlanLimit>, b: Record<string, MembershipPlanLimit>, operations: string[]) {
    return operations.every((operation) =>
        LIMIT_FIELDS.every((field) => a[operation]?.[field] === b[operation]?.[field]),
    )
}

export function PlanEditorDialog({
    open,
    mode,
    plan,
    plans,
    operations,
    saving,
    onCreate,
    onUpdate,
    onClose,
}: PlanEditorDialogProps) {
    const { t } = useTranslation()
    const editing = mode === 'edit' && plan != null
    const isDefault = editing && plan.is_default
    const billingSynced = editing && plan.is_billing_synced

    const [code, setCode] = useState(() => (editing ? plan.plan_code : ''))
    const [name, setName] = useState(() => (editing ? plan.display_name : ''))
    const [credits, setCredits] = useState(() => (editing ? String(plan.daily_credit_limit) : ''))
    const [active, setActive] = useState(() => (editing ? plan.is_active : true))
    const [preset, setPreset] = useState('')
    const [limits, setLimits] = useState<LimitsDraft>(() => draftFromLimits(operations, editing ? plan.limits : undefined))

    const codeValid = editing || PLAN_CODE_PATTERN.test(code)
    const nameValid = name.trim().length > 0 && name.trim().length <= 64
    const creditsValue = Number(credits)
    const creditsValid = credits.trim() !== '' && Number.isInteger(creditsValue) && creditsValue >= 0
    const parsedLimits = parseLimits(operations, limits)
    const limitsValid = parsedLimits != null
    const canSubmit = codeValid && nameValid && creditsValid && limitsValid && !saving

    const presetOptions: SelectOption[] = plans
        .filter((candidate) => !editing || candidate.plan_code !== plan.plan_code)
        .map((candidate) => ({ value: candidate.plan_code, label: candidate.display_name, description: candidate.plan_code }))

    const applyPreset = (planCode: string) => {
        setPreset(planCode)
        const source = plans.find((candidate) => candidate.plan_code === planCode)
        if (source) setLimits(draftFromLimits(operations, source.limits))
    }

    const updateLimit = (operation: string, field: LimitField, value: string) => {
        setLimits((current) => ({
            ...current,
            [operation]: {
                ...(current[operation] ?? { daily_request_limit: '', max_in_flight: '1', credit_cost: '1' }),
                [field]: value,
            },
        }))
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit || !parsedLimits) return
        if (!editing) {
            onCreate({
                plan_code: code.trim(),
                display_name: name.trim(),
                daily_credit_limit: creditsValue,
                is_active: active,
                limits: parsedLimits,
            })
            return
        }
        const body: MembershipPlanUpdateRequest = {}
        if (!billingSynced && name.trim() !== plan.display_name) body.display_name = name.trim()
        if (!billingSynced && creditsValue !== plan.daily_credit_limit) body.daily_credit_limit = creditsValue
        if (!isDefault && active !== plan.is_active) body.is_active = active
        if (!limitsEqual(parsedLimits, plan.limits, operations)) body.limits = parsedLimits
        if (Object.keys(body).length === 0) {
            onClose()
            return
        }
        onUpdate(plan.plan_code, body)
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            icon={<Icon icon={editing ? Pencil : Layers} size={18} className="text-ember-300" />}
            title={editing ? t('admin.membership.editor.editTitle') : t('admin.membership.editor.createTitle')}
        >
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label={t('admin.membership.editor.codeLabel')}
                        helper={t('admin.membership.editor.codeHelper')}
                        error={code && !codeValid ? t('admin.membership.editor.codeError') : undefined}
                    >
                        <Input
                            value={code}
                            onChange={(event) => setCode(event.target.value.toLowerCase())}
                            placeholder={t('admin.membership.editor.codePlaceholder')}
                            maxLength={32}
                            disabled={editing || saving}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </Field>
                    <Field
                        label={t('admin.membership.editor.nameLabel')}
                        helper={billingSynced ? t('admin.membership.editor.billingSyncedHelper') : undefined}
                        error={name && !nameValid ? t('admin.membership.editor.nameError') : undefined}
                    >
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t('admin.membership.editor.namePlaceholder')}
                            maxLength={64}
                            disabled={billingSynced || saving}
                        />
                    </Field>
                    <Field
                        label={t('admin.membership.editor.creditsLabel')}
                        helper={billingSynced ? t('admin.membership.editor.billingSyncedHelper') : t('admin.membership.editor.creditsHelper')}
                        error={credits && !creditsValid ? t('admin.membership.editor.creditsError') : undefined}
                    >
                        <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={credits}
                            onChange={(event) => setCredits(event.target.value)}
                            disabled={billingSynced || saving}
                        />
                    </Field>
                    <Field label={t('admin.membership.editor.copyFromLabel')}>
                        <Select
                            size="sm"
                            options={presetOptions}
                            value={preset || null}
                            onChange={applyPreset}
                            placeholder={t('admin.membership.editor.copyFromPlaceholder')}
                            disabled={saving}
                        />
                    </Field>
                </div>

                <SwitchRow
                    variant="plain"
                    label={t('admin.membership.editor.activeLabel')}
                    description={
                        isDefault ? t('admin.membership.editor.defaultActiveDescription') : t('admin.membership.editor.activeDescription')
                    }
                    checked={active}
                    onChange={setActive}
                    disabled={isDefault || saving}
                />

                <section className="flex flex-col gap-2 border-t border-line-faint pt-4" aria-labelledby="plan-limits-heading">
                    <div>
                        <h4 id="plan-limits-heading" className="font-ui text-sm font-semibold text-parchment-50">
                            {t('admin.membership.editor.limitsTitle')}
                        </h4>
                        <p className="font-ui text-[12px] text-parchment-300">{t('admin.membership.editor.limitsDescription')}</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] border-separate border-spacing-y-1 font-ui text-sm">
                            <thead>
                                <tr className="text-left font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                                    <th scope="col" className="pb-1 pr-2 font-semibold">{t('admin.membership.editor.columns.operation')}</th>
                                    <th scope="col" className="pb-1 pr-2 font-semibold">{t('admin.membership.editor.columns.dailyLimit')}</th>
                                    <th scope="col" className="pb-1 pr-2 font-semibold">{t('admin.membership.editor.columns.maxInFlight')}</th>
                                    <th scope="col" className="pb-1 font-semibold">{t('admin.membership.editor.columns.creditCost')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operations.map((operation) => {
                                    const draft: LimitDraft = limits[operation] ?? { daily_request_limit: '', max_in_flight: '1', credit_cost: '1' }
                                    const rowValid = parseLimit(draft) != null
                                    const label = operationName(operation, t)
                                    return (
                                        <tr key={operation}>
                                            <th scope="row" className="pr-2 text-left font-semibold text-parchment-100">
                                                <span className="block truncate">{label}</span>
                                                <span className="block font-mono text-[10px] font-normal text-parchment-500">{operation}</span>
                                            </th>
                                            {LIMIT_FIELDS.map((field) => (
                                                <td key={field} className={cx('pr-2', field === 'credit_cost' && 'pr-0')}>
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={LIMIT_MINIMUMS[field]}
                                                        step={1}
                                                        value={draft[field]}
                                                        onChange={(event) => updateLimit(operation, field, event.target.value)}
                                                        disabled={saving}
                                                        aria-label={`${label} · ${t(`admin.membership.editor.columns.${fieldColumnKey(field)}`)}`}
                                                        aria-invalid={!rowValid || undefined}
                                                        className={cx(controlClass, 'w-full min-w-[84px] px-2.5 py-1.5 text-sm')}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {!limitsValid && (
                        <Callout tone="danger" role="alert" className="py-2">
                            {t('admin.membership.editor.limitsError')}
                        </Callout>
                    )}
                </section>

                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                        {t('admin.common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!canSubmit}
                        iconLeft={saving ? <Icon icon={Loader2} size={15} className="animate-spin" /> : undefined}
                    >
                        {editing ? t('admin.membership.editor.save') : t('admin.membership.editor.create')}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

function fieldColumnKey(field: LimitField): 'dailyLimit' | 'maxInFlight' | 'creditCost' {
    if (field === 'daily_request_limit') return 'dailyLimit'
    if (field === 'max_in_flight') return 'maxInFlight'
    return 'creditCost'
}
