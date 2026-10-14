/**
 * Metrics module (R0-OPS-07; 11 §8.1/§8.3, 08 §8.3): the root views over
 * `GET /admin/voices/metrics/{narration,calls,provider,moderation,spend}`. Each
 * area shows its alert rules (threshold and state, firing ones with the
 * server's values), the database aggregates for the chosen window, and the
 * serving process's live metrics. Read only. Root only: the console mounts
 * for root alone (AC-R1) and the BFF answers 403 to anyone else.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, RefreshCw } from 'lucide-react'
import { ApiError, apiService } from '@/infrastructure/api'
import type { AdminVoiceMetricsArea, AdminVoiceMetricsResponse } from '@/shared'
import { Badge, Button, Callout, Icon, Select, TabPanel, Tabs, type TabOption } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { formatDateTime } from '../../format'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { isMetricsEnvelopeEmpty, metricsRuleStatuses } from '../../metricsRules'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { AlertRuleTable } from './AlertRuleTable'
import { CallMetricsView } from './CallMetricsView'
import { MetricsPanel } from './MetricsTable'
import { ModerationMetricsView } from './ModerationMetricsView'
import { NarrationMetricsView } from './NarrationMetricsView'
import { ProviderMetricsView } from './ProviderMetricsView'
import { SpendMetricsView } from './SpendMetricsView'

const AREAS: readonly AdminVoiceMetricsArea[] = ['narration', 'calls', 'provider', 'moderation', 'spend']
/** `hours` choices (the BFF takes 1–720; 24 is its default). */
const HOUR_WINDOWS = [1, 6, 24, 168, 720] as const
/** `days` choices for spend (the BFF takes 1–90; 7 is its default). */
const DAY_WINDOWS = [1, 7, 30, 90] as const
const DEFAULT_HOURS = 24
const DEFAULT_DAYS = 7
const ID_BASE = 'admin-voice-metrics'

export function MetricsModule() {
    const { t } = useTranslation()
    const { locale } = useVoiceConsole()
    const [area, setArea] = useState<AdminVoiceMetricsArea>('narration')
    const [hours, setHours] = useState<number>(DEFAULT_HOURS)
    const [days, setDays] = useState<number>(DEFAULT_DAYS)
    const spend = area === 'spend'
    const load = useAbortableLoad<AdminVoiceMetricsResponse>(
        (signal) => apiService.getAdminVoiceMetrics(area, spend ? { days } : { hours }, signal),
        `${area}:${spend ? `d${days}` : `h${hours}`}`,
    )
    const loadMessage = useLoadErrorMessage(load.error)
    // A 503 is the BFF's "metrics unavailable" (a database read failed): say so plainly.
    const errorMessage = load.error ? (load.error instanceof ApiError && load.error.status === 503 ? t('admin.voices.metrics.unavailable') : loadMessage) : null
    // The loader keeps the last answer while the next one loads: never show another area's envelope.
    const envelope = load.data && load.data.surface === area ? load.data : null

    const tabs: TabOption<AdminVoiceMetricsArea>[] = AREAS.map((value) => ({ value, label: t(`admin.voices.metrics.areas.${value}`) }))
    const windowOptions = spend
        ? DAY_WINDOWS.map((value) => ({ value: `d${value}`, label: t(`admin.voices.metrics.windows.d${value}`) }))
        : HOUR_WINDOWS.map((value) => ({ value: `h${value}`, label: t(`admin.voices.metrics.windows.h${value}`) }))
    const setWindow = (value: string) => {
        const amount = Number.parseInt(value.slice(1), 10)
        if (!Number.isFinite(amount)) return
        if (value.startsWith('d')) setDays(amount)
        else setHours(amount)
    }

    return (
        <ConsoleSection
            icon={Activity}
            title={t('admin.voices.metrics.title')}
            description={t('admin.voices.metrics.description')}
            right={
                <div className="flex flex-wrap items-end gap-2">
                    <Select
                        size="sm"
                        aria-label={t('admin.voices.metrics.window')}
                        options={windowOptions}
                        value={spend ? `d${days}` : `h${hours}`}
                        onChange={setWindow}
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={14} className={load.loading ? 'animate-spin' : undefined} />}
                        onClick={load.reload}
                        aria-busy={load.loading}
                    >
                        {t('admin.voices.metrics.refresh')}
                    </Button>
                </div>
            }
        >
            <Tabs options={tabs} value={area} onChange={setArea} idBase={ID_BASE} aria-label={t('admin.voices.metrics.areasAria')} size="sm" />

            {AREAS.map((value) => (
                <TabPanel key={value} value={value} idBase={ID_BASE} active={area} className="flex flex-col gap-6">
                    {value === area && (
                        <>
                            <p aria-live="polite" className="font-ui text-caption text-fg-muted">
                                {load.loading
                                    ? t('admin.voices.metrics.loading')
                                    : envelope
                                      ? t('admin.voices.metrics.updated', {
                                            time: formatDateTime(envelope.generated_at, locale),
                                            since: formatDateTime(envelope.window?.since, locale),
                                            until: formatDateTime(envelope.window?.until, locale),
                                        })
                                      : null}
                            </p>

                            {errorMessage && (
                                <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={load.reload}>{t('admin.voices.common.retry')}</Button>}>
                                    {errorMessage}
                                </Callout>
                            )}

                            {envelope && <MetricsArea envelope={envelope} locale={locale} />}
                        </>
                    )}
                </TabPanel>
            ))}
        </ConsoleSection>
    )
}

function MetricsArea({ envelope, locale }: { envelope: AdminVoiceMetricsResponse; locale: string }) {
    const { t } = useTranslation()
    const statuses = metricsRuleStatuses(envelope)
    const firing = statuses.filter((status) => status.state === 'firing').length
    const areaLabel = t(`admin.voices.metrics.areas.${envelope.surface}`)

    return (
        <>
            <MetricsPanel
                title={t('admin.voices.metrics.rules.title')}
                hint={t('admin.voices.metrics.rules.hint')}
                right={
                    statuses.length > 0 && (
                        <Badge tone={firing > 0 ? 'danger' : 'live'} data-testid="metrics-firing-count">
                            {firing > 0 ? t('admin.voices.metrics.rules.firing', { count: firing }) : t('admin.voices.metrics.rules.allQuiet')}
                        </Badge>
                    )
                }
            >
                {statuses.length === 0 ? (
                    <p className="font-ui text-sm text-fg-muted">{t('admin.voices.metrics.rules.none')}</p>
                ) : (
                    <AlertRuleTable caption={t('admin.voices.metrics.rules.caption', { area: areaLabel })} statuses={statuses} locale={locale} />
                )}
            </MetricsPanel>

            {isMetricsEnvelopeEmpty(envelope) ? (
                <EmptyState
                    icon={<Icon icon={Activity} size={36} />}
                    message={t('admin.voices.metrics.empty')}
                    secondaryText={t('admin.voices.metrics.emptyHint', {
                        since: formatDateTime(envelope.window?.since, locale),
                        until: formatDateTime(envelope.window?.until, locale),
                    })}
                />
            ) : (
                <AreaView envelope={envelope} locale={locale} />
            )}
        </>
    )
}

function AreaView({ envelope, locale }: { envelope: AdminVoiceMetricsResponse; locale: string }) {
    switch (envelope.surface) {
        case 'narration':
            return <NarrationMetricsView envelope={envelope} locale={locale} />
        case 'calls':
            return <CallMetricsView envelope={envelope} locale={locale} />
        case 'provider':
            return <ProviderMetricsView envelope={envelope} locale={locale} />
        case 'moderation':
            return <ModerationMetricsView envelope={envelope} locale={locale} />
        case 'spend':
            return <SpendMetricsView envelope={envelope} locale={locale} />
        default:
            return null
    }
}
