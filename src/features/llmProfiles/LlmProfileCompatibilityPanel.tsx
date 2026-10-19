import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isLlmFeatureEnabled } from '@/shared/featureFlags'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleSlash } from 'lucide-react'
import type { LlmCompatibilityIssue, LlmProfileCompatibility } from '@/shared/types/llmProfile.types'
import { Callout, Icon } from '@/ui/primitives'

export type LlmCompatibilityState =
    | { status: 'checking'; report: null }
    | { status: 'ready'; report: LlmProfileCompatibility }
    | { status: 'unavailable'; report: null }

const KNOWN_REASONS = new Set(['PROFILE_INCOMPATIBLE', 'MODEL_CONTEXT_INSUFFICIENT', 'PROVIDER_MODEL_UNAVAILABLE', 'PROFILE_ENDPOINT_UNSUPPORTED',
    'PROFILE_PARAMETER_UNSUPPORTED', 'PLATFORM_CONNECTION_UNAVAILABLE', 'PROFILE_CREDENTIAL_MODE_INVALID', 'FEATURE_BYOK_DISABLED'])

/**
 * Server-computed compatibility of the configuration being edited, as
 * "Works for: …" and "Not available for: … (reason)". Verdant marks what
 * works; blood names the role that blocks a feature.
 */
export function LlmProfileCompatibilityPanel({ state, custom = false }: { state: LlmCompatibilityState; custom?: boolean }) {
    useFeatureFlags()
    const { t } = useTranslation()
    const id = useId()
    const reason = (issue: LlmCompatibilityIssue) => {
        const role = issue.role ? t(`llmProfiles.roles.${issue.role}`) : t('llmProfiles.compatibility.configuration')
        return KNOWN_REASONS.has(issue.code)
            ? t(`llmProfiles.compatibility.reasons.${issue.code}`, { role })
            : t('llmProfiles.compatibility.reasons.other', { code: issue.code })
    }
    const works = state.status === 'ready' ? state.report.features.filter(row => isLlmFeatureEnabled(row.feature) && row.compatible) : []
    const blocked = state.status === 'ready' ? state.report.features.filter(row => isLlmFeatureEnabled(row.feature) && !row.compatible) : []
    return <section className="flex flex-col gap-3" role="group" aria-labelledby={`${id}-title`}>
        <div className="flex flex-col gap-0.5">
            <h3 id={`${id}-title`} className="font-ui text-sm font-semibold text-parchment-50">{t(custom ? 'llmProfiles.custom.availability' : 'llmProfiles.compatibility.title')}</h3>
            <p className="font-ui text-caption text-parchment-300">{t(custom ? 'llmProfiles.custom.availabilityHint' : 'llmProfiles.compatibility.description')}</p>
        </div>
        {state.status === 'checking' && <p role="status" className="font-ui text-label text-parchment-300">{t('llmProfiles.compatibility.checking')}</p>}
        {state.status === 'unavailable' && <p role="status" className="font-ui text-label text-parchment-300">{t('llmProfiles.compatibility.unavailable')}</p>}
        {state.status === 'ready' && state.report.configuration_issue && <Callout tone="danger" role="alert">
            {t('llmProfiles.compatibility.invalid', { reason: reason(state.report.configuration_issue) })}</Callout>}
        {state.status === 'ready' && (works.length > 0 || blocked.length > 0) && <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <h4 id={`${id}-works`} className="flex items-center gap-1.5 font-ui text-label font-semibold text-verdant-500">
                    <Icon icon={CircleCheck} size={14} />{t(custom ? 'llmProfiles.custom.allowedFor' : 'llmProfiles.compatibility.worksFor')}
                </h4>
                {works.length === 0 ? <p className="font-ui text-caption text-parchment-300">{t('llmProfiles.compatibility.worksForNone')}</p>
                    : <ul aria-labelledby={`${id}-works`} className="flex flex-wrap gap-1.5">
                        {works.map(row => <li key={row.feature} title={row.roles.map(role => t(`llmProfiles.roles.${role}`)).join(' · ')}
                            className="inline-flex items-center rounded-full bg-verdant-500/10 px-2.5 py-1 font-ui text-meta font-semibold text-parchment-100">
                            {t(`llmProfiles.features.${row.feature}`)}
                        </li>)}
                    </ul>}
            </div>
            {blocked.length > 0 && <div className="flex flex-col gap-1.5">
                <h4 id={`${id}-blocked`} className="flex items-center gap-1.5 font-ui text-label font-semibold text-blood-300">
                    <Icon icon={CircleSlash} size={14} />{t('llmProfiles.compatibility.notAvailableFor')}
                </h4>
                <ul aria-labelledby={`${id}-blocked`} className="flex flex-col divide-y divide-line-faint rounded-md border border-line-faint">
                    {blocked.map(row => <li key={row.feature} className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
                        <span className="font-ui text-label font-semibold text-parchment-100">{t(`llmProfiles.features.${row.feature}`)}</span>
                        {row.issue && <span className="font-ui text-caption text-blood-300">{reason(row.issue)}</span>}
                        <span className="font-ui text-caption text-parchment-400">{row.roles.map(role => t(`llmProfiles.roles.${role}`)).join(' · ')}</span>
                    </li>)}
                </ul>
            </div>}
        </div>}
    </section>
}
