/**
 * The ElevenLabs voice catalog as a picker (R1-FE-01): filters, a paged list
 * with "Load more", free samples and "Use". Shared by the voice picker dialog
 * and the V2 preset editor (base voice). `onPick` receives the catalog item;
 * the caller turns it into a stored voice (`voiceFromCatalog`) or a preset
 * base voice.
 *
 * Language (05 §7.3, §5.5): the filter starts on the card or story language
 * when the caller knows one, else on `user_preferences.preferred_language`
 * (never the interface locale); "Any" clears it. Badges and samples use the
 * same language, falling back to the interface language only when neither is known.
 *
 * Samples (D18): the picker plays them through `useCatalogSample`, or through
 * the host's `sample` when one is passed, so a host that also plays samples
 * elsewhere (the voice picker's current-voice row) keeps one sample at a time.
 */
import { useEffect, useMemo, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Loader2 } from 'lucide-react'
import type { CatalogVoice } from '@/shared'
import { SUPPORTED_LANGUAGE_OPTIONS } from '@/app/i18n/languages'
import { VoiceClipPlayer } from '@/ui/components/audio'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { Button, Callout, Icon } from '@/ui/primitives'
import { useCatalogSample } from '../useCatalogSample'
import { useCatalogBrowser, type CatalogRecommendationTarget } from '../hooks/useCatalogBrowser'
import { usePreferredLanguage } from '../hooks/usePreferredLanguage'
import { baseLanguageCode } from '../languageCode'
import { CatalogFilters } from './CatalogFilters'
import { CatalogVoiceRow } from './CatalogVoiceRow'

export interface CatalogVoicePickerProps {
    /** Card or story language (filter default, badges, sample language); else the preferred language. */
    language?: string | null
    /** A saved, non-persona character card: enables "Recommended for this character". */
    recommendedFor?: CatalogRecommendationTarget | null
    currentVoiceKey?: string | null
    onPick: (item: CatalogVoice) => void
    pickLabel?: string
    enabled?: boolean
    /** The host's sample player (one sample at a time across the host); else the picker's own. */
    sample?: CatalogSampleController
    /** The search input, for a host that sends the user to the catalog ("Choose a voice"). */
    searchRef?: Ref<HTMLInputElement>
}

/** What `useCatalogSample` returns: the clip, its loading and error state, `play` and `stop`. */
export type CatalogSampleController = ReturnType<typeof useCatalogSample>

export function CatalogVoicePicker({
    language,
    recommendedFor = null,
    currentVoiceKey = null,
    onPick,
    pickLabel,
    enabled = true,
    sample: hostSample,
    searchRef,
}: CatalogVoicePickerProps) {
    const { t, i18n } = useTranslation()
    const cardLanguage = baseLanguageCode(language)
    const preferred = usePreferredLanguage(enabled && !cardLanguage)
    const defaultLanguage = cardLanguage ?? preferred.language
    const effectiveLanguage = defaultLanguage ?? i18n.language.split('-')[0]
    const browser = useCatalogBrowser({
        enabled,
        recommendedFor,
        defaultLanguage,
        defaultsPending: !cardLanguage && preferred.pending,
    })
    const ownSample = useCatalogSample()
    const sample = hostSample ?? ownSample
    const stopSample = sample.stop

    // A closed picker stops its sample.
    useEffect(() => {
        if (!enabled) stopSample()
    }, [enabled, stopSample])

    const languages = useMemo(() => {
        const codes = SUPPORTED_LANGUAGE_OPTIONS.map((option) => option.code as string)
        const wanted = effectiveLanguage.toLowerCase()
        return wanted && !codes.includes(wanted) ? [...codes, wanted] : codes
    }, [effectiveLanguage])

    const tags = useMemo(() => [...new Set(browser.items.flatMap((item) => item.tags))].sort(), [browser.items])

    return (
        <div className="flex flex-col gap-4">
            <CatalogFilters
                filters={browser.filters}
                onChange={browser.setFilters}
                languages={languages}
                tags={tags}
                canRecommend={browser.canRecommend}
                recommended={browser.recommended}
                onRecommendedChange={browser.setRecommended}
                searchRef={searchRef}
            />
            <p className="font-ui text-caption text-fg-muted">{t('voices.notice.language_scope')}</p>

            {browser.error === 'failed' && browser.items.length === 0 ? (
                <Callout
                    tone="danger"
                    role="alert"
                    action={<Button variant="secondary" size="sm" onClick={browser.retry}>{t('voices.catalog.retry')}</Button>}
                >
                    {t('voices.catalog.unavailable')}
                </Callout>
            ) : browser.error === 'unavailable' ? (
                <p role="status" className="font-ui text-sm text-parchment-300">{t('voices.catalog.unavailable')}</p>
            ) : browser.loading ? (
                <div role="status" className="flex items-center gap-2 py-6 font-ui text-sm text-parchment-300">
                    <Icon icon={Loader2} size={16} className="animate-spin" />
                    {t('common.loading')}
                </div>
            ) : browser.items.length === 0 ? (
                <EmptyState icon={<Icon icon={AudioLines} size={36} />} message={t('voices.catalog.empty')} />
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col divide-y divide-line-faint">
                        {browser.items.map((item) => {
                            const playing = Boolean(sample.clip && item.languages.some((entry) => entry.sample_url === sample.clip?.sampleUrl))
                            const loading = Boolean(sample.loadingUrl && item.languages.some((entry) => entry.sample_url === sample.loadingUrl))
                            return (
                                <CatalogVoiceRow
                                    key={item.voice_key}
                                    item={item}
                                    language={effectiveLanguage}
                                    current={item.voice_key === currentVoiceKey}
                                    playing={playing}
                                    sampleLoading={loading}
                                    onPlay={(url) => void sample.play(url, null)}
                                    onStop={sample.stop}
                                    onPick={onPick}
                                    pickLabel={pickLabel}
                                >
                                    {playing && sample.clip && (
                                        <VoiceClipPlayer src={sample.clip.src} title={t('voices.catalog.playSample', { name: item.display_name })} />
                                    )}
                                </CatalogVoiceRow>
                            )
                        })}
                    </div>
                    {sample.error && <p role="alert" className="font-ui text-caption text-blood-300">{sample.error}</p>}
                    {browser.error === 'failed' && (
                        <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={browser.loadMore}>{t('voices.catalog.retry')}</Button>}>
                            {t('voices.catalog.unavailable')}
                        </Callout>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p role="status" aria-live="polite" className="font-ui text-caption text-fg-muted">
                            {t('voices.catalog.count', { count: browser.items.length })}
                        </p>
                        {browser.nextCursor && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={browser.loadingMore}
                                iconLeft={browser.loadingMore ? <Icon icon={Loader2} size={14} className="animate-spin" /> : undefined}
                                onClick={browser.loadMore}
                            >
                                {t('voices.catalog.loadMore')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
