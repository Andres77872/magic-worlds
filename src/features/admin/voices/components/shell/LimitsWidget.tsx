/**
 * Limits widget (05 §8.13, AC-R12): a compact header trigger with a details
 * drawer. Every value is live (Job C, `voice_spend_daily`, sync logs); nothing
 * about the plan is hard-coded. The console can only raise the daily budget.
 * Runtime switches are read only and explained as `env AND db` (I-12).
 */
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Gauge } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminVoiceLimits, VoiceRuntimeSettingsResponse } from '@/shared'
import { Badge, Button, Callout, Drawer, Field, Icon, Input, SectionHeader } from '@/ui/primitives'
import { DAILY_BUDGET_SETTING_KEY } from '../../constants'
import { formatDate, formatDateTime, formatNumber, percent } from '../../format'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { knownCount, runtimeGateState, summarizeLimits } from './limitsMath'
import { UsageMeter } from './UsageMeter'
import { useLoadErrorMessage, useVoiceConsole } from './VoiceConsoleContext'

const loadRuntimeSettings = (signal: AbortSignal) => apiService.getRuntimeSettings(signal)

export function LimitsWidget() {
    const { t } = useTranslation()
    const { limits } = useVoiceConsole()
    const [open, setOpen] = useState(false)
    const summary = summarizeLimits(limits.data)
    const alert = summary.slotsAlert || summary.opsLow || summary.syncAlert || summary.budgetStatus === 'paused95' || summary.budgetStatus === 'stopped100'

    const label =
        summary.slotsUsed !== null && summary.slotLimit !== null && summary.opsLeft !== null
            ? t('admin.voices.limits.triggerValue', { used: summary.slotsUsed, limit: summary.slotLimit, ops: summary.opsLeft })
            : t('admin.voices.limits.triggerUnknown')

    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                aria-haspopup="dialog"
                aria-label={`${t('admin.voices.limits.trigger')}: ${label}`}
                iconLeft={<Icon icon={alert ? AlertTriangle : Gauge} size={15} className={alert ? 'text-blood-300' : undefined} />}
                onClick={() => setOpen(true)}
            >
                <span className="font-mono text-xs tabular-nums">{label}</span>
            </Button>
            <Drawer
                open={open}
                onClose={() => setOpen(false)}
                eyebrow={t('admin.voices.limits.eyebrow')}
                title={t('admin.voices.limits.title')}
                size="lg"
            >
                {open && <LimitsDetails limits={limits.data} loading={limits.loading} error={limits.error} onReload={limits.reload} />}
            </Drawer>
        </>
    )
}

interface LimitsDetailsProps {
    limits: AdminVoiceLimits | null
    loading: boolean
    error: unknown
    onReload: () => void
}

export function LimitsDetails({ limits, loading, error, onReload }: LimitsDetailsProps) {
    const { t } = useTranslation()
    const { locale } = useVoiceConsole()
    const errorMessage = useLoadErrorMessage(error)
    const summary = summarizeLimits(limits)
    const subscription = limits?.subscription ?? null
    const settings = useAbortableLoad<VoiceRuntimeSettingsResponse>(loadRuntimeSettings, 'runtime-settings')
    // A count the BFF sent as null reads "Unknown"; it never becomes a meter value.
    const pairText = (used: number | null, limit: number | null) =>
        used === null || limit === null ? t('admin.voices.common.unknown') : `${formatNumber(used, locale)} / ${formatNumber(limit, locale)}`
    const slotsUsed = knownCount(subscription?.voice_slots_used)
    const slotLimit = knownCount(subscription?.voice_limit)
    const opsUsed = knownCount(subscription?.voice_add_edit_counter)
    const opsMax = knownCount(subscription?.max_voice_add_edits)
    const characters = knownCount(subscription?.character_count)
    const characterLimit = knownCount(subscription?.character_limit)

    if (loading && !limits) return <p role="status" className="font-ui text-sm text-fg-muted">{t('admin.voices.common.loading')}</p>
    if (error && !limits) {
        return (
            <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={onReload}>{t('admin.voices.common.retry')}</Button>}>
                {errorMessage}
            </Callout>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {subscription ? (
                <section className="flex flex-col gap-4" aria-label={t('admin.voices.limits.title')}>
                    <UsageMeter
                        label={t('admin.voices.limits.slots')}
                        valueText={pairText(slotsUsed, slotLimit)}
                        value={slotsUsed}
                        max={slotLimit}
                        alert={summary.slotsAlert}
                    />
                    <UsageMeter
                        label={t('admin.voices.limits.ops')}
                        valueText={pairText(opsUsed, opsMax)}
                        value={opsUsed}
                        max={opsMax}
                        alert={summary.opsLow}
                        hint={summary.opsLow ? t('admin.voices.limits.opsLow') : summary.opsLeft !== null ? t('admin.voices.limits.opsLeft', { count: summary.opsLeft }) : undefined}
                    />
                    <UsageMeter
                        label={t('admin.voices.limits.characters')}
                        valueText={pairText(characters, characterLimit)}
                        value={characters}
                        max={characterLimit}
                        hint={
                            subscription.next_character_count_reset_at
                                ? t('admin.voices.limits.resetsOn', { date: formatDate(subscription.next_character_count_reset_at, locale) })
                                : undefined
                        }
                    />
                    {subscription.fetched_at && (
                        <p className="font-ui text-caption text-fg-muted">{t('admin.voices.limits.fetchedAt', { date: formatDateTime(subscription.fetched_at, locale) })}</p>
                    )}
                </section>
            ) : (
                <Callout tone="warning" role="status">{t('admin.voices.limits.triggerUnknown')}</Callout>
            )}

            <BudgetSection limits={limits} onRaised={onReload} />

            <section className="flex flex-col gap-2">
                <SectionHeader as="h3" title={t('admin.voices.limits.perKey')} />
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-ui text-sm">
                        <caption className="sr-only">{t('admin.voices.limits.perKeyCaption')}</caption>
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.voices.limits.key')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 text-right font-semibold">{t('admin.voices.limits.usage')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(limits?.per_key ?? []).map((row) => (
                                <tr key={row.key_name}>
                                    <th scope="row" className="border-b border-line-faint py-2 pr-3 text-left font-mono text-xs font-normal text-parchment-100">{row.key_name}</th>
                                    <td className="border-b border-line-faint py-2 text-right tabular-nums text-parchment-200">
                                        {formatNumber(row.usage, locale)} / {formatNumber(row.limit, locale)}{' '}
                                        <span className="text-caption text-fg-muted">{row.unit ?? t('admin.voices.limits.unknownUnit')}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeader as="h3" title={t('admin.voices.limits.syncRuns')} />
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-ui text-sm">
                        <caption className="sr-only">{t('admin.voices.limits.syncCaption')}</caption>
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.voices.limits.job')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.voices.limits.runStatus')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 font-semibold">{t('admin.voices.limits.finished')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(limits?.sync_runs ?? []).map((run, index) => {
                                const bad = run.mass_miss_abort || run.status === 'failed' || run.status === 'aborted'
                                return (
                                    <tr key={`${run.job}-${run.started_at ?? index}`}>
                                        <th scope="row" className="border-b border-line-faint py-2 pr-3 text-left font-mono text-xs font-normal text-parchment-100">{run.job}</th>
                                        <td className="border-b border-line-faint py-2 pr-3">
                                            <span className="flex flex-wrap gap-1.5">
                                                <Badge tone={bad ? 'danger' : run.status === 'running' ? 'arcane' : 'live'}>{t(`admin.voices.limits.runStatuses.${run.status}`)}</Badge>
                                                {run.mass_miss_abort && <Badge tone="danger">{t('admin.voices.limits.massMissAbort')}</Badge>}
                                            </span>
                                        </td>
                                        <td className="border-b border-line-faint py-2 text-parchment-300">{formatDateTime(run.finished_at, locale)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {settings.data && settings.data.items.length > 0 && (
                <section className="flex flex-col gap-2" aria-label={t('admin.voices.limits.runtimeSettings')}>
                    <SectionHeader as="h3" title={t('admin.voices.limits.runtimeSettings')} />
                    <p className="max-w-[70ch] font-ui text-caption text-fg-muted">{t('admin.voices.limits.runtimeNote')}</p>
                    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 font-ui text-sm">
                        {settings.data.items.map((item) => {
                            const gate = runtimeGateState(item.setting_key, item.value_json)
                            return (
                                <div key={item.setting_key} className="contents">
                                    <dt className="font-mono text-xs text-parchment-300">{item.setting_key}</dt>
                                    <dd className="text-right font-mono text-xs text-parchment-100">
                                        {JSON.stringify(item.value_json)}
                                        {gate && (
                                            <span className="block font-ui text-caption text-fg-muted">
                                                {gate.dbOn ? t('admin.voices.limits.runtimeGate.on', { env: gate.env }) : t('admin.voices.limits.runtimeGate.off')}
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            )
                        })}
                    </dl>
                </section>
            )}
        </div>
    )
}

function BudgetSection({ limits, onRaised }: { limits: AdminVoiceLimits | null; onRaised: () => void }) {
    const { t } = useTranslation()
    const { locale, notify, reportError } = useVoiceConsole()
    const summary = summarizeLimits(limits)
    const inputId = useId()
    const [draft, setDraft] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const budget = summary.budget
    const stateTone = summary.budgetStatus === 'stopped100' || summary.budgetStatus === 'paused95' ? 'danger' : summary.budgetStatus === 'ok' ? 'live' : 'warning'

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        const value = Number.parseInt(draft, 10)
        if (!Number.isFinite(value) || value <= (budget ?? 0)) {
            setError(t('admin.voices.limits.raiseInvalid'))
            return
        }
        setSaving(true)
        setError(null)
        try {
            await apiService.putRuntimeSetting(DAILY_BUDGET_SETTING_KEY, value)
            notify(t('admin.voices.toasts.budgetRaised'))
            setDraft('')
            onRaised()
        } catch (caught) {
            setError(reportError(caught))
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="flex flex-col gap-3">
            <SectionHeader as="h3" title={t('admin.voices.limits.spend')} right={<Badge tone={stateTone}>{t(`admin.voices.limits.budgetStates.${summary.budgetStatus}`)}</Badge>} />
            <div className="overflow-x-auto">
                <table className="w-full border-collapse font-ui text-sm">
                    <caption className="sr-only">{t('admin.voices.limits.spendCaption')}</caption>
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                            <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.voices.limits.surface')}</th>
                            <th scope="col" className="border-b border-line-faint pb-2 text-right font-semibold">{t('admin.voices.limits.characters')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(limits?.spend_today ?? []).map((row) => (
                            <tr key={row.surface}>
                                <th scope="row" className="border-b border-line-faint py-2 pr-3 text-left font-normal text-parchment-100">{t(`admin.voices.limits.surfaces.${row.surface}`)}</th>
                                <td className="border-b border-line-faint py-2 text-right tabular-nums text-parchment-200">{formatNumber(row.chars, locale)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {budget ? (
                <UsageMeter
                    label={t('admin.voices.limits.budget')}
                    valueText={t('admin.voices.limits.budgetValue', {
                        used: formatNumber(summary.spentToday, locale),
                        budget: formatNumber(budget, locale),
                        percent: percent(summary.spentToday, budget),
                    })}
                    value={summary.spentToday}
                    max={budget}
                    alert={stateTone === 'danger'}
                />
            ) : (
                <p className="font-ui text-sm text-fg-muted">{t('admin.voices.limits.budgetUnset')}</p>
            )}
            <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={submit} noValidate>
                <Field label={t('admin.voices.limits.newBudget')} htmlFor={inputId} helper={t('admin.voices.limits.raiseHelp')} error={error ?? undefined} className="flex-1">
                    <Input type="number" inputMode="numeric" min={(budget ?? 0) + 1} value={draft} onChange={(event) => setDraft(event.target.value)} />
                </Field>
                <Button type="submit" variant="primary" size="md" disabled={saving || !draft} className="sm:mb-6">
                    {saving ? t('admin.voices.common.saving') : t('admin.voices.limits.raiseBudget')}
                </Button>
            </form>
        </section>
    )
}
