/**
 * One catalog voice in the picker (R1-FE-01): name, description, gender and
 * age chips (05 §7.2), languages with the tiers each is accepted on (05 §7.4:
 * tier names from `languages[].accepted_models`, never model ids), derived
 * badges, a free sample (▶) and "Use". A locked voice stays visible but cannot
 * be picked: its "Use" is `aria-disabled` and names the reason; its badge names
 * the plan, and "See plans" opens the plans page in a new tab (a draft behind
 * the picker survives). No accent or works-in-calls information (taxonomy and S-15 are open).
 *
 * The sample button names the voice and the sample's language and toggles
 * `aria-pressed` while it plays (05 §10).
 */
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Check, Loader2, Play, Settings2, Square } from 'lucide-react'
import type { CatalogVoice, NarrationTier } from '@/shared'
import { pageHash } from '@/features/gallery/galleryLinks'
import { Avatar, Button, ButtonLink, Icon, IconButton, Tag, cx } from '@/ui/primitives'
import { catalogBadges, catalogSampleUrl } from '../catalogBadges'
import { VoiceBadges, languageLabel } from './VoiceBadges'
import { VoiceProviderTag } from './VoiceProviderTag'

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
    unavailable?: boolean
    /** Root only: open this voice in the voice console. */
    onManage?: () => void
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
    unavailable = false,
    onManage,
    children,
}: CatalogVoiceRowProps) {
    const { t, i18n } = useTranslation()
    const hintId = useId()
    const sampleUrl = catalogSampleUrl(item, language)
    const sampleLanguage = catalogSampleLanguage(item, sampleUrl)
    const sampleLabel = playing ? t('voices.catalog.stopNamedSample', { name: item.display_name }) : sampleLanguage
        ? t('voices.catalog.listenSampleIn', { name: item.display_name, language: languageLabel(sampleLanguage, i18n.language) })
        : t('voices.catalog.listenSample', { name: item.display_name })
    const badges = catalogBadges(item, { language, isCurrent: current })
    const languages = languageTiers(item)
    const blocked = item.locked || unavailable
    return (
        <div
            className={cx('flex flex-col gap-2 border-l-2 py-3.5 pl-3 transition-colors', current ? 'border-l-ember-500 bg-ember-500/[.05]' : 'border-l-transparent hover:bg-parchment-50/[.02]')}
            data-testid="catalog-voice-row"
            data-voice-key={item.voice_key}
        >
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={item.display_name} size={40} ring={item.house_voice ? 'arcane' : 'none'} />
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="min-w-0 break-words font-ui text-body font-semibold text-parchment-50">{item.display_name}</p>
                                <VoiceProviderTag provider={item.provider} />
                            </div>
                            {item.description && <p className="break-words font-ui text-sm text-parchment-300">{item.description}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Tag>{t(item.call_eligible ? 'voices.catalog.forCalls' : 'voices.catalog.forNarration')}</Tag>
                            {(item.gender || item.age) && (
                                <span className="contents" data-testid="catalog-voice-traits">
                                    {item.gender && <Tag data-gender={item.gender}>{t(`voices.catalog.gender.${item.gender}`, { defaultValue: item.gender })}</Tag>}
                                    {item.age && <Tag data-age={item.age}>{t(`voices.catalog.age.${item.age}`, { defaultValue: item.age })}</Tag>}
                                </span>
                            )}
                        </div>
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
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p id={hintId} className="font-ui text-xs text-parchment-400">
                                    {t('voices.badge.locked_hint')}
                                </p>
                                <ButtonLink variant="ghost" size="xs" href={pageHash('billing')} target="_blank" rel="noopener noreferrer"
                                    aria-label={`${t('voices.catalog.seePlans')} ${t('voices.catalog.opensInNewTab')}`}
                                    iconRight={<Icon icon={ArrowUpRight} size={12} />}>
                                    {t('voices.catalog.seePlans')}
                                </ButtonLink>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                    {onManage && (
                        <IconButton label={t('voices.studio.v2.manageVoice', { name: item.display_name })} size="sm" onClick={onManage}>
                            <Icon icon={Settings2} size={15} />
                        </IconButton>
                    )}
                    {sampleUrl && (
                        <Button
                            variant="ghost"
                            aria-label={sampleLabel}
                            size="sm"
                            iconLeft={<Icon icon={sampleLoading ? Loader2 : playing ? Square : Play} size={14} className={sampleLoading ? 'animate-spin' : undefined} />}
                            onClick={() => (playing ? onStop() : onPlay(sampleUrl))}
                        >
                            {t(playing ? 'voices.catalog.stopSample' : 'voices.catalog.listen')}
                        </Button>
                    )}
                    <Button
                        // The voice already in use reads as a state ("✓ Selected"), not another call to action.
                        variant={current ? 'ghost' : 'secondary'}
                        size="sm"
                        aria-disabled={blocked || undefined}
                        aria-describedby={blocked ? hintId : undefined}
                        className={blocked ? 'cursor-not-allowed opacity-50' : undefined}
                        iconLeft={current ? <Icon icon={Check} size={14} /> : undefined}
                        onClick={() => {
                            if (!blocked) onPick(item)
                        }}
                    >
                        {current ? t('voices.picker.selected') : (pickLabel ?? t('voices.catalog.use'))}
                    </Button>
                </div>
            </div>
            {unavailable && !item.locked && <p id={hintId} className="pl-[52px] text-caption text-parchment-300">{t('voices.providers.unavailable')}</p>}
            {children && <div className="flex flex-col gap-1 sm:pl-[52px]">{children}</div>}
        </div>
    )
}
