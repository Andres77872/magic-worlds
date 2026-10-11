/**
 * Root-only, secondary: the approved model catalog (with a refresh action) and
 * the recent audit trail of app-profile changes. Collapsed by default.
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import type { LlmAuditEvent, LlmProfileSummary } from '@/shared/types/llmProfile.types'
import { Button, Icon } from '@/ui/primitives'
import { Disclosure } from './Disclosure'

const KNOWN_EVENTS = new Set(['profile_created', 'draft_updated', 'draft_tested', 'profile_published', 'profile_rollback', 'profile_archived',
    'profile_saved', 'system_policy_changed', 'system_catalog_synced', 'user_preferences_changed'])

interface CatalogActivityProps {
    modelCount: number
    audit: LlmAuditEvent[]
    profiles: LlmProfileSummary[]
    busy?: boolean
    onSync: () => void
    defaultOpen?: boolean
}

export function CatalogActivity({ modelCount, audit, profiles, busy = false, onSync, defaultOpen = false }: CatalogActivityProps) {
    const { t, i18n } = useTranslation()
    const profileName = (id: string | null) => id ? profiles.find(profile => profile.profile_id === id)?.name ?? id.slice(0, 8) : '—'
    return <Disclosure as="h2" title={t('llmProfiles.activity.title')} hint={t('llmProfiles.activity.hint')} defaultOpen={defaultOpen}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
                <h3 className="font-ui text-label font-semibold text-parchment-50">{t('llmProfiles.activity.catalog')}</h3>
                <p className="font-ui text-caption text-parchment-300">{t('llmProfiles.activity.catalogCount', { n: modelCount })}</p>
            </div>
            <Button variant="secondary" size="sm" disabled={busy} onClick={onSync}
                iconLeft={<Icon icon={RefreshCw} size={14} className={busy ? 'animate-spin' : undefined} />}>{t('llmProfiles.sync')}</Button>
        </div>
        <div className="flex flex-col gap-2">
            <h3 className="font-ui text-label font-semibold text-parchment-50">{t('llmProfiles.activity.recent')}</h3>
            {audit.length === 0 ? <p className="font-ui text-caption text-parchment-300">{t('llmProfiles.activity.empty')}</p>
                : <ul className="flex flex-col divide-y divide-line-faint">
                    {audit.map(event => <li key={event.event_id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                        <span className="min-w-0 font-ui text-label text-parchment-100">
                            <span className="font-semibold">{KNOWN_EVENTS.has(event.event_type) ? t(`llmProfiles.activity.events.${event.event_type}`) : event.event_type}</span>
                            {event.profile_id && <span className="text-parchment-300"> · {profileName(event.profile_id)}</span>}
                        </span>
                        <time dateTime={event.created_at} className="shrink-0 font-mono text-meta text-parchment-400">
                            {new Date(event.created_at).toLocaleString(i18n.resolvedLanguage)}
                        </time>
                    </li>)}
                </ul>}
        </div>
    </Disclosure>
}
