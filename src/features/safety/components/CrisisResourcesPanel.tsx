/**
 * Shown when voice is paused after a self-harm signal (R2-BE-01 FE; 13 §2.7):
 * in the chat's pause notice and on the call screen (`voice_safety_pause`).
 *
 * It renders the approved generic lines only: voice is paused (with when it
 * comes back, when the server says) and "contact your local emergency
 * services". Named crisis lines come from {@link shippableCrisisResources},
 * which stays empty until counsel signs them (CN-7), so a pending placeholder
 * can never render.
 */
import { useTranslation } from 'react-i18next'
import { LifeBuoy } from 'lucide-react'
import { legalLanguage } from '@/features/legal/documents'
import { Icon } from '@/ui/primitives'
import { shippableCrisisResources } from '../crisisResources'

export interface CrisisResourcesPanelProps {
    /** Seconds until voice resumes, when the server reports it. */
    retryAfterSeconds?: number | null
    /** Replaces the default layout classes of the panel's root. */
    className?: string
}

export function CrisisResourcesPanel({ retryAfterSeconds = null, className }: CrisisResourcesPanelProps) {
    const { t, i18n } = useTranslation()
    const resources = shippableCrisisResources(legalLanguage(i18n.resolvedLanguage ?? i18n.language))
    const minutes = typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.ceil(retryAfterSeconds / 60)
        : null

    return (
        <div className={className ?? 'flex flex-col gap-3'} data-testid="crisis-resources">
            <div>
                <p className="m-0 font-ui text-body text-parchment-100">{t('voiceSafety.paused')}</p>
                {minutes !== null && (
                    <p className="mt-1 mb-0 font-ui text-sm text-parchment-300">{t('voiceSafety.pausedRetry', { count: minutes })}</p>
                )}
            </div>
            <p className="m-0 flex items-start gap-2 font-ui text-sm font-semibold text-ember-300">
                <Icon icon={LifeBuoy} size={16} className="mt-0.5 shrink-0" />
                <span>{t('voiceSafety.emergency')}</span>
            </p>
            {resources.length > 0 && (
                <section aria-label={t('voiceSafety.resourcesTitle')} className="flex flex-col gap-1.5">
                    <h3 className="m-0 font-ui text-label font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t('voiceSafety.resourcesTitle')}</h3>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {resources.map((resource) => (
                            <li key={resource.id} className="font-ui text-sm text-parchment-200">
                                <span className="font-semibold text-parchment-50">{resource.name}</span>
                                {' · '}
                                <span>{resource.contact}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}
