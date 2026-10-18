/**
 * Create / edit dialog for a membership plan. Owns the code, display name,
 * included daily credits, active flag, and the full per-operation limit table.
 *
 * Ownership rules mirror the backend: default plans cannot be deactivated and
 * billing-synced paid defaults keep their name and daily credits read-only
 * (they mirror api.auth's Stripe catalog). Custom plans are fully editable.
 * Image operations are priced per image profile, so their plan credit cost is
 * not offered here: the stored value rides along unchanged to keep the limit
 * row valid for the API.
 *
 * Voice operations also take a daily quantity cap (D24): narration characters
 * for `tts_generation`, call seconds for `voice_call`. Per 03 §5.16 I-2 it is
 * required (a whole number of 0 or more) for those two and null for every
 * other operation, so a plan can never be saved uncapped. The key is sent only
 * when the server's plans already carry it: older servers reject unknown
 * limit keys, so the column stays hidden for them.
 *
 * The parent remounts this component (via `key`) whenever a different plan is
 * opened, so the initial state is derived once and never re-seeded.
 */
import { useRef, useState, type FormEvent } from 'react'
import type { FeatureFlagDefinition } from '@/shared/featureFlagRuntime'
import { useTranslation } from 'react-i18next'
import { Layers, Loader2, Pencil } from 'lucide-react'
import type {
    MembershipPlan,
    MembershipPlanCreateRequest,
    MembershipPlanLimit,
    MembershipPlanUpdateRequest,
} from '@/shared'
import { Button, Callout, Field, Icon, Input, Modal, Select, SwitchRow, controlClass, cx, type SelectOption } from '@/ui/primitives'
import { isProfilePriced, operationName } from './membershipFormat'

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
    flags?: readonly FeatureFlagDefinition[]
    catalogRevision?: string
    saving: boolean
    onCreate: (body: MembershipPlanCreateRequest) => void
    onUpdate: (planCode: string, body: MembershipPlanUpdateRequest) => void
    onClose: () => void
}

type CountField = 'daily_request_limit' | 'max_in_flight' | 'credit_cost'
type LimitField = CountField | 'daily_quantity_limit'
type LimitDraft = Record<LimitField, string>
type LimitsDraft = Record<string, LimitDraft>
type QuantityUnit = 'characters' | 'seconds'

const PLAN_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/
const LIMIT_FIELDS: CountField[] = ['daily_request_limit', 'max_in_flight', 'credit_cost']
const LIMIT_MINIMUMS: Record<CountField, number> = { daily_request_limit: 0, max_in_flight: 1, credit_cost: 1 }
const EMPTY_DRAFT: LimitDraft = { daily_request_limit: '', max_in_flight: '1', credit_cost: '1', daily_quantity_limit: '' }
/** Operations whose daily quantity cap is enforced, and its unit (D24). */
const QUANTITY_UNITS: Record<string, QuantityUnit> = { tts_generation: 'characters', voice_call: 'seconds' }

/** True when the server's plans carry `daily_quantity_limit` (a server that accepts it). */
function serverHasQuantityLimits(plans: MembershipPlan[]): boolean {
    return plans.some((candidate) => Object.values(candidate.limits ?? {}).some((limit) => 'daily_quantity_limit' in limit))
}

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
                    daily_quantity_limit: limit?.daily_quantity_limit != null ? String(limit.daily_quantity_limit) : '',
                },
            ]
        }),
    )
}

/**
 * The daily quantity to send (I-2): a whole number of 0 or more for the capped
 * voice operations, where empty is invalid; null for every other operation.
 * Undefined when invalid.
 */
function parseQuantity(operation: string, raw: string): number | null | undefined {
    if (!QUANTITY_UNITS[operation]) return null
    if (raw.trim() === '') return undefined
    const value = Number(raw)
    return Number.isInteger(value) && value >= 0 ? value : undefined
}

function parseLimit(operation: string, draft: LimitDraft | undefined, withQuantity: boolean): MembershipPlanLimit | null {
    if (!draft) return null
    const parsed = {} as MembershipPlanLimit
    for (const field of LIMIT_FIELDS) {
        const raw = draft[field] ?? ''
        const value = Number(raw)
        if (raw.trim() === '' || !Number.isInteger(value) || value < LIMIT_MINIMUMS[field]) return null
        parsed[field] = value
    }
    if (withQuantity) {
        const quantity = parseQuantity(operation, draft.daily_quantity_limit ?? '')
        if (quantity === undefined) return null
        parsed.daily_quantity_limit = quantity
    }
    return parsed
}

function parseLimits(operations: string[], drafts: LimitsDraft, withQuantity: boolean): Record<string, MembershipPlanLimit> | null {
    const result: Record<string, MembershipPlanLimit> = {}
    for (const operation of operations) {
        const parsed = parseLimit(operation, drafts[operation], withQuantity)
        if (!parsed) return null
        result[operation] = parsed
    }
    return result
}

function limitsEqual(a: Record<string, MembershipPlanLimit>, b: Record<string, MembershipPlanLimit>, operations: string[], withQuantity: boolean) {
    return operations.every((operation) =>
        LIMIT_FIELDS.every((field) => a[operation]?.[field] === b[operation]?.[field])
        && (!withQuantity || (a[operation]?.daily_quantity_limit ?? null) === (b[operation]?.daily_quantity_limit ?? null)),
    )
}

export function PlanEditorDialog({
    open,
    mode,
    plan,
    plans,
    operations,
    saving,
    flags = [],
    catalogRevision,
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
    const [grants, setGrants] = useState<Record<string, boolean>>(() => Object.fromEntries(
        flags.map(flag => [flag.key, editing && plan.feature_flags?.[flag.key] === true]),
    ))
    const mutation = useRef({ input: '', id: '' })
    const withMutation = <T extends MembershipPlanCreateRequest | MembershipPlanUpdateRequest>(body: T): T => {
        const input = JSON.stringify(body)
        if (mutation.current.input !== input) mutation.current = { input, id: crypto.randomUUID() }
        return { ...body, mutation_id: mutation.current.id }
    }
    const toggleGrant = (key: string, value: boolean) => setGrants(current => {
        const next = { ...current, [key]: value }
        // Revoke dependent selections explicitly; never auto-grant a parent.
        for (let pass = 0; pass < flags.length; pass++) {
            for (const flag of flags) if (flag.requires.some(parent => next[parent] !== true)) next[flag.key] = false
        }
        return next
    })
    const [limits, setLimits] = useState<LimitsDraft>(() => {
        const defaults = plans.find((candidate) => candidate.is_default) ?? plans[0]
        const draft = draftFromLimits(operations, editing ? plan.limits : defaults?.limits)
        // New plans still require deliberate values for the visible rows. Hidden
        // rows retain the server's default limits, including voice quantity caps.
        if (!editing) for (const operation of operations) draft[operation] = { ...EMPTY_DRAFT }
        return draft
    })
    const [withQuantity] = useState(() => serverHasQuantityLimits(editing ? [plan, ...plans] : plans))

    const codeValid = editing || PLAN_CODE_PATTERN.test(code)
    const nameValid = name.trim().length > 0 && name.trim().length <= 64
    const creditsValue = Number(credits)
    const creditsValid = credits.trim() !== '' && Number.isInteger(creditsValue) && creditsValue >= 0
    const visibleOperations = operations
    const parsedLimits = parseLimits(operations, limits, withQuantity)
    const limitsValid = parsedLimits != null
    const canSubmit = codeValid && nameValid && creditsValid && limitsValid && !saving

    const presetOptions: SelectOption[] = plans
        .filter((candidate) => !editing || candidate.plan_code !== plan.plan_code)
        .map((candidate) => ({ value: candidate.plan_code, label: candidate.display_name, description: candidate.plan_code }))

    const applyPreset = (planCode: string) => {
        setPreset(planCode)
        const source = plans.find((candidate) => candidate.plan_code === planCode)
        if (!source) return
        setGrants(Object.fromEntries(flags.map(flag => [flag.key, source.feature_flags?.[flag.key] === true])))
        setLimits((current) => {
            const next = draftFromLimits(operations, source.limits)
            for (const operation of operations) {
                if (isProfilePriced(operation) && current[operation]) next[operation].credit_cost = current[operation].credit_cost
            }
            return next
        })
    }

    const updateLimit = (operation: string, field: LimitField, value: string) => {
        setLimits((current) => ({
            ...current,
            [operation]: {
                ...(current[operation] ?? EMPTY_DRAFT),
                [field]: value,
            },
        }))
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canSubmit || !parsedLimits) return
        if (!editing) {
            const body: MembershipPlanCreateRequest = {
                plan_code: code.trim(),
                display_name: name.trim(),
                daily_credit_limit: creditsValue,
                is_active: active,
                limits: parsedLimits,
            }
            if (flags.length && catalogRevision) {
                body.feature_flags = grants
                body.catalog_revision = catalogRevision
            }
            onCreate(withMutation(body))
            return
        }
        const body: MembershipPlanUpdateRequest = {}
        if (!billingSynced && name.trim() !== plan.display_name) body.display_name = name.trim()
        if (!billingSynced && creditsValue !== plan.daily_credit_limit) body.daily_credit_limit = creditsValue
        if (!isDefault && active !== plan.is_active) body.is_active = active
        if (!limitsEqual(parsedLimits, plan.limits, operations, withQuantity)) body.limits = parsedLimits
        if (flags.some(flag => grants[flag.key] !== (plan.feature_flags?.[flag.key] === true))) {
            body.feature_flags = grants
            body.catalog_revision = catalogRevision
        }
        if (Object.keys(body).length === 0) {
            onClose()
            return
        }
        if (plan.version) body.expected_version = plan.version
        onUpdate(plan.plan_code, withMutation(body))
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

                {flags.length > 0 && catalogRevision && (
                    <section className="flex flex-col gap-3 border-t border-line-faint pt-4" aria-labelledby="plan-features-heading">
                        <h4 id="plan-features-heading" className="font-ui text-label font-semibold text-parchment-50">
                            {t('admin.membership.editor.featuresTitle')}
                        </h4>
                        <p className="font-ui text-caption text-parchment-300">{t('admin.membership.editor.featuresDescription')}</p>
                        {flags.map(flag => (
                            <SwitchRow key={flag.key} variant="plain"
                                label={t(`featureFlags.labels.${flag.key}`, { defaultValue: flag.key })}
                                description={flag.requires.length ? t('admin.membership.editor.featureRequires', {
                                    features: flag.requires.map(key => t(`featureFlags.labels.${key}`, { defaultValue: key })).join(', '),
                                }) : undefined}
                                checked={grants[flag.key] === true}
                                disabled={saving || flag.requires.some(parent => grants[parent] !== true)}
                                onChange={value => toggleGrant(flag.key, value)} />
                        ))}
                    </section>
                )}

                <section className="flex flex-col gap-2 border-t border-line-faint pt-4" aria-labelledby="plan-limits-heading">
                    <div>
                        <h4 id="plan-limits-heading" className="font-ui text-sm font-semibold text-parchment-50">
                            {t('admin.membership.editor.limitsTitle')}
                        </h4>
                        <p className="font-ui text-[12px] text-parchment-300">{t('admin.membership.editor.limitsDescription')}</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className={cx('w-full border-separate border-spacing-y-1 font-ui text-sm', withQuantity ? 'min-w-[640px]' : 'min-w-[520px]')}>
                            <thead>
                                <tr className="text-left font-ui text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                                    <th scope="col" className="pb-1 pr-2 font-semibold">{t('admin.membership.editor.columns.operation')}</th>
                                    <th scope="col" className="pb-1 pr-2 font-semibold">{t('admin.membership.editor.columns.dailyLimit')}</th>
                                    <th scope="col" className="pb-1 pr-2 font-semibold">{t('admin.membership.editor.columns.maxInFlight')}</th>
                                    <th scope="col" className={cx('pb-1 font-semibold', withQuantity && 'pr-2')}>{t('admin.membership.editor.columns.creditCost')}</th>
                                    {withQuantity && (
                                        <th scope="col" className="pb-1 font-semibold">{t('admin.membership.editor.columns.dailyQuantity')}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleOperations.map((operation) => {
                                    const draft: LimitDraft = limits[operation] ?? EMPTY_DRAFT
                                    const rowValid = parseLimit(operation, draft, withQuantity) != null
                                    const quantityUnit = QUANTITY_UNITS[operation]
                                    const label = operationName(operation, t)
                                    return (
                                        <tr key={operation}>
                                            <th scope="row" className="pr-2 text-left font-semibold text-parchment-100">
                                                <span className="block truncate">{label}</span>
                                                <span className="block font-mono text-[10px] font-normal text-parchment-500">{operation}</span>
                                            </th>
                                            {LIMIT_FIELDS.map((field) => (
                                                <td key={field} className={cx('pr-2', field === 'credit_cost' && !withQuantity && 'pr-0')}>
                                                    {field === 'credit_cost' && isProfilePriced(operation) ? (
                                                        <span className="block min-w-[84px] px-2.5 py-1.5 font-ui text-[12px] text-parchment-400">
                                                            {t('admin.membership.imagePricing.perProfile')}
                                                        </span>
                                                    ) : (
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
                                                    )}
                                                </td>
                                            ))}
                                            {withQuantity && (
                                                <td>
                                                    {quantityUnit ? (
                                                        <div className="flex min-w-[112px] items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                inputMode="numeric"
                                                                min={0}
                                                                step={1}
                                                                value={draft.daily_quantity_limit}
                                                                onChange={(event) => updateLimit(operation, 'daily_quantity_limit', event.target.value)}
                                                                disabled={saving}
                                                                aria-label={`${label} · ${t('admin.membership.editor.columns.dailyQuantity')} (${t(`admin.membership.editor.quantityUnits.${quantityUnit}`)})`}
                                                                aria-required="true"
                                                                aria-invalid={parseQuantity(operation, draft.daily_quantity_limit) === undefined || undefined}
                                                                className={cx(controlClass, 'w-full min-w-[84px] px-2.5 py-1.5 text-sm')}
                                                            />
                                                            <span className="shrink-0 font-ui text-[11px] text-parchment-400">
                                                                {t(`admin.membership.editor.quantityUnits.${quantityUnit}`)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="block min-w-[84px] px-2.5 py-1.5 font-ui text-[12px] text-parchment-400">
                                                            {t('admin.membership.editor.quantityNotApplicable')}
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {operations.some(isProfilePriced) && (
                        <p className="font-ui text-[12px] text-parchment-300">{t('admin.membership.imagePricing.note')}</p>
                    )}
                    {withQuantity && (
                        <p className="font-ui text-[12px] text-parchment-300">{t('admin.membership.editor.quantityHelper')}</p>
                    )}
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

function fieldColumnKey(field: CountField): 'dailyLimit' | 'maxInFlight' | 'creditCost' {
    if (field === 'daily_request_limit') return 'dailyLimit'
    if (field === 'max_in_flight') return 'maxInFlight'
    return 'creditCost'
}
