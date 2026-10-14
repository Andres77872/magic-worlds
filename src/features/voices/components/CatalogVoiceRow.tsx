/**
 * One catalog voice in the picker (R1-FE-01): name, description, gender and
 * age chips (05 §7.2), languages with the tiers each is accepted on (05 §7.4:
 * tier names from `languages[].accepted_models`, never model ids), derived
 * badges, a free sample (▶) and "Use". A locked voice stays visible but cannot
 * be picked: its "Use" is `aria-disabled` and names the reason; its badge names
 * the plan. No accent or works-in-calls information (taxonomy and S-15 are open).
 *
 * The sample button names the voice and the sample's language and toggles
 * `aria-pressed` while it plays (05 §10).
 */
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Play, Square } from 'lucide-react'
import type { CatalogVoice, NarrationTier } from '@/shared'
import { Avatar, Button, Icon, IconButton, Tag, cx } from '@/ui/primitives'
import { catalogBadges, catalogSampleUrl } from '../catalogBadges'
import { VoiceBadges, languageLabel } from './VoiceBadges'

const TIER_ORDER: readonly NarrationTier[] = ['standard', 'expressive']

/** The language of the row whose sample is `sampleUrl` (the one `catalogSampleUrl` chose), or null. */
function catalogSampleLanguage(item: CatalogVoice, sampleUrl: string | null | undefined): string | null {
    if (!sampleUrl) return null
    return item.languages.find((entry) => entry.sample_url === sampleUrl)?.language ?? null
}

/** One entry per language code, with the union of its accepted tiers in display order. */
export function languageTiers(item: CatalogVoice): { code: string; tiers: NarrationTier[] }[] {
    const byCode = new Map<string, Set<NarrationTier>>()
    for (const entry of item.languages) {
        const tiers = byCode.get(entry.language) ?? new Set<NarrationTier>()
        for (const tier of entry.accepted_models) tiers.add(tier)
        byCode.set(entry.language, tiers)
    }
    return [...byCode].map(([code, tiers]) => ({ code, tiers: TIER_ORDER.filter((tier) => tiers.has(tier)) }))
}

interface CatalogVoiceRowProps {
    item: CatalogVoice
    /** Card or story language: drives `not_tested_language` and which sample plays. */
    language?: string | null
    current?: boolean
    playing?: boolean
    sampleLoading?: boolean
    onPlay: (sampleUrl: string) => void
    onStop: () => void
    onPick: (item: CatalogVoice) => void
    pickLabel?: string
    /** Rendered under the row (the sample player). */
    children?: ReactNode
}

export function CatalogVoiceRow({
    item,
    language,
    current = false,
    playing = false,
    sampleLoading = false,
    onPlay,
    onStop,
    onPick,
    pickLabel,
    children,
}: CatalogVoiceRowProps) {
    const { t, i18n } = useTranslation()
    const hintId = useId()
    const sampleUrl = catalogSampleUrl(item, language)
    const sampleLanguage = catalogSampleLanguage(item, sampleUrl)
    const sampleLabel = sampleLanguage
        ? t('voices.catalog.playSampleIn', { name: item.display_name, language: languageLabel(sampleLanguage, i18n.language) })
        : t('voices.catalog.playSample', { name: item.display_name })
    const badges = catalogBadges(item, { language, isCurrent: current })
    const languages = languageTiers(item)
    return (
        <div
            className={cx('flex flex-col gap-2 border-l-2 py-3 pl-3', current ? 'border-l-ember-500 bg-ember-500/[.05]' : 'border-l-transparent')}
            data-testid="catalog-voice-row"
            data-voice-key={item.voice_key}
        >
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={item.display_name} size={36} ring={item.house_voice ? 'arcane' : 'none'} />
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-ui text-sm font-semibold text-parchment-50">{item.display_name}</p>
                        {item.description && <p className="font-ui text-xs text-parchment-300">{item.description}</p>}
                        {(item.gender || item.age) && (
                            <div className="flex flex-wrap gap-1" data-testid="catalog-voice-traits">
                                {item.gender && <Tag data-gender={item.gender}>{t(`voices.catalog.gender.${item.gender}`, { defaultValue: item.gender })}</Tag>}
                                {item.age && <Tag data-age={item.age}>{t(`voices.catalog.age.${item.age}`, { defaultValue: item.age })}</Tag>}
                            </div>
                        )}
                        {languages.length > 0 && (
                            <ul className="flex flex-wrap gap-1" aria-label={t('voices.catalog.languages')}>
                                {languages.map(({ code, tiers }) => {
                                    const name = languageLabel(code, i18n.language)
                                    const tierNames = tiers.map((tier) => t(`voices.tier.${tier}`))
                                    return (
                                        <li key={code} data-language={code} data-tiers={tiers.join(',')}>
                                            <Tag className="gap-1.5">
                                                <span aria-hidden={tiers.length > 0 || undefined}>{name}</span>
                                                {tierNames.map((tierName, index) => (
                                                    <span
                                                        key={tiers[index]}
                                                        aria-hidden="true"
                                                        data-tier={tiers[index]}
                                                        className={cx(
                                                            'rounded-full bg-ink-800/70 px-1.5 font-medium',
                                                            tiers[index] === 'expressive' ? 'text-ember-300' : 'text-parchment-300',
                                                        )}
                                                    >
                                                        {tierName}
                                                    </span>
                                                ))}
                                                {tiers.length > 0 && (
                                                    <span className="sr-only">
                                                        {t('voices.catalog.languageTiers', { language: name, tiers: tierNames.join(', ') })}
                                                    </span>
                                                )}
                                            </Tag>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                        <VoiceBadges
                            badges={badges}
                            context={{ date: item.disable_at, language, minPlan: item.min_plan }}
                        />
                        {item.locked && (
                            <p id={hintId} className="font-ui text-xs text-parchment-400">
                                {t('voices.badge.locked_hint')}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {sampleUrl && (
                        <IconButton
                            label={sampleLabel}
                            aria-pressed={playing}
                            size="sm"
                            onClick={() => (playing ? onStop() : onPlay(sampleUrl))}
                        >
                            <Icon icon={sampleLoading ? Loader2 : playing ? Square : Play} size={14} className={sampleLoading ? 'animate-spin' : undefined} />
                        </IconButton>
                    )}
                    <Button
                        variant={current ? 'secondary' : 'primary'}
                        size="sm"
                        aria-disabled={item.locked || undefined}
                        aria-describedby={item.locked ? hintId : undefined}
                        className={item.locked ? 'cursor-not-allowed opacity-50' : undefined}
                        iconLeft={current ? <Icon icon={Check} size={14} /> : undefined}
                        onClick={() => {
                            if (!item.locked) onPick(item)
                        }}
                    >
                        {current ? t('voices.picker.selected') : (pickLabel ?? t('voices.catalog.use'))}
                    </Button>
                </div>
            </div>
            {children}
        </div>
    )
}
