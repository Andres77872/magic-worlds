/**
 * Server-side catalog filters (R1-FE-01): search, language, gender, age and
 * tags, "Show locked" (`include_locked`, 05 §7.2-§7.3), plus "Recommended for
 * this character" when the picker serves a saved character card. Chips toggle
 * (none selected = all); the language group starts on the picker's default
 * (05 §7.3) and "Any" clears it. Gender and age offer the catalog's fixed
 * enums (05 §7.3: `male|female|neutral`, `young|middle_aged|old`; BFF
 * `VoiceGender` / `VoiceAgeBucket`) with their `voices.catalog.gender.*` /
 * `age.*` labels, whatever the loaded page carries. The curated archetype list
 * (04 taxonomy) does not exist yet, so tag chips offer the slugs seen in the
 * loaded results. Use case is not offered: the catalog items carry no use-case
 * value to offer. Accent and works-in-calls are not offered (04 curation, S-15).
 */
import { useId, useState, type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { VoiceAgeBucket, VoiceGender } from '@/shared'
import { Badge, Button, Chip, Icon, Input, SwitchRow } from '@/ui/primitives'
import { CATALOG_MAX_TAGS, type CatalogFilters as CatalogFilterValues } from '../hooks/useCatalogBrowser'
import { languageLabel } from './VoiceBadges'

interface CatalogFiltersProps {
    filters: CatalogFilterValues
    onChange: (patch: Partial<CatalogFilterValues>) => void
    /** Language codes offered as filter chips (the app languages plus the card's). */
    languages: readonly string[]
    /** Tag slugs seen in the loaded results. */
    tags: readonly string[]
    canRecommend?: boolean
    recommended?: boolean
    onRecommendedChange?: (value: boolean) => void
    /** The search input, for a host that sends the user there ("Choose a voice"). */
    searchRef?: Ref<HTMLInputElement>
    /** A note under the language chips (the language-scope notice). */
    languageNote?: ReactNode
    /** Shown at the end of the filter toolbar (the result count). */
    summary?: ReactNode
}

/** The catalog's gender enum, in the 05 §7.3 order. */
const CATALOG_GENDERS: readonly VoiceGender[] = ['male', 'female', 'neutral']
/** The catalog's age-bucket enum, in the 05 §7.3 order. */
const CATALOG_AGES: readonly VoiceAgeBucket[] = ['young', 'middle_aged', 'old']

/**
 * One single-choice facet over a fixed enum. A selected value outside it (an
 * `initialFilters` value) stays offered, labelled by its slug, so it can be cleared.
 */
function FacetChips({ label, values, labelOf, selected, onSelect }: {
    label: string
    values: readonly string[]
    labelOf: (value: string) => string
    selected: string | undefined
    onSelect: (value: string | undefined) => void
}) {
    const offered = selected && !values.includes(selected) ? [...values, selected] : values
    return (
        <FilterRow label={label}>
            {offered.map((value) => {
                const active = selected === value
                return (
                    <Chip key={value} active={active} aria-pressed={active} data-value={value} onClick={() => onSelect(active ? undefined : value)}>
                        {labelOf(value)}
                    </Chip>
                )
            })}
        </FilterRow>
    )
}

/** One filter group: a visible label that names the chip group, then its chips. */
function FilterRow({ label, children }: { label: string; children: ReactNode }) {
    const labelId = useId()
    return (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span id={labelId} className="shrink-0 font-ui text-caption font-semibold text-parchment-300 sm:w-20">{label}</span>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={labelId}>
                {children}
            </div>
        </div>
    )
}

export function CatalogFilters({ filters, onChange, languages, tags, canRecommend = false, recommended = false, onRecommendedChange, searchRef, languageNote, summary }: CatalogFiltersProps) {
    const { t, i18n } = useTranslation()
    const selectedTags = filters.tags ?? []
    const [expanded, setExpanded] = useState(() => Boolean(filters.gender || filters.age || selectedTags.length || filters.include_locked === false))
    const detailsId = useId()
    const toggleTag = (tag: string) => {
        const next = selectedTags.includes(tag) ? selectedTags.filter((value) => value !== tag) : [...selectedTags, tag]
        onChange({ tags: next.slice(0, CATALOG_MAX_TAGS) })
    }
    const offeredTags = [...new Set([...selectedTags, ...tags])]
    // The filters folded under "More filters" that narrow the list, so a closed panel still says so.
    const hiddenActive = [filters.gender, filters.age, filters.include_locked === false, recommended].filter(Boolean).length + selectedTags.length
    // "Clear filters" resets everything but the language, which keeps its own "Any" chip.
    const narrowed = hiddenActive > 0 || Boolean(filters.q?.trim()) || Boolean(filters.provider)
    const toggleLabel = t(expanded ? 'voices.catalog.hideFilters' : 'voices.catalog.moreFilters')
    const clear = () => {
        onChange({ q: '', provider: undefined, gender: undefined, age: undefined, tags: [], include_locked: undefined })
        if (recommended) onRecommendedChange?.(false)
    }
    return (
        <div className="flex flex-col gap-3">
            <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 z-[1] flex items-center text-parchment-400">
                    <Icon icon={Search} size={16} />
                </span>
                <Input
                    ref={searchRef}
                    type="search"
                    value={filters.q ?? ''}
                    onChange={(event) => onChange({ q: event.target.value })}
                    placeholder={t('voices.catalog.search')}
                    aria-label={t('voices.catalog.search')}
                    className="pl-10"
                />
            </div>
            <FilterRow label={t('voices.catalog.filters.provider')}>
                <Chip active={!filters.provider} aria-pressed={!filters.provider} onClick={() => onChange({ provider: undefined })}>
                    {t('voices.providers.all')}
                </Chip>
                {(['elevenlabs', 'fish_audio'] as const).map((provider) => (
                    <Chip key={provider} active={filters.provider === provider} aria-pressed={filters.provider === provider}
                        onClick={() => onChange({ provider: filters.provider === provider ? undefined : provider })}>
                        {provider === 'fish_audio' ? 'Fish Audio' : 'ElevenLabs'}
                    </Chip>
                ))}
            </FilterRow>
            {languages.length > 0 && (
                <FilterRow label={t('voices.catalog.filters.language')}>
                    <Chip active={!filters.language} aria-pressed={!filters.language} onClick={() => onChange({ language: undefined })}>
                        {t('voices.catalog.filters.any')}
                    </Chip>
                    {languages.map((code) => (
                        <Chip
                            key={code}
                            active={filters.language === code}
                            aria-pressed={filters.language === code}
                            onClick={() => onChange({ language: filters.language === code ? undefined : code })}
                        >
                            {languageLabel(code, i18n.language)}
                        </Chip>
                    ))}
                </FilterRow>
            )}
            {languageNote && <div className="sm:pl-[92px]">{languageNote}</div>}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-faint pt-2">
                <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={detailsId}
                    aria-label={hiddenActive > 0 ? `${toggleLabel} ${t('voices.catalog.activeFilters', { count: hiddenActive })}` : undefined}
                    iconLeft={<Icon icon={SlidersHorizontal} size={14} />}
                    onClick={() => setExpanded((value) => !value)}>
                    {toggleLabel}
                    {hiddenActive > 0 && <Badge tone="ember" aria-hidden="true" className="ml-1">{hiddenActive}</Badge>}
                </Button>
                {narrowed && (
                    <Button variant="ghost" size="sm" iconLeft={<Icon icon={X} size={14} />} onClick={clear}>
                        {t('voices.catalog.clearFilters')}
                    </Button>
                )}
                {summary && <div className="ml-auto">{summary}</div>}
            </div>
            <div id={detailsId} hidden={!expanded} className="flex flex-col gap-3">
                    <FacetChips
                        label={t('voices.catalog.filters.gender')}
                        values={CATALOG_GENDERS}
                        labelOf={(value) => t(`voices.catalog.gender.${value}`, { defaultValue: value })}
                        selected={filters.gender}
                        onSelect={(gender) => onChange({ gender })}
                    />
                    <FacetChips
                        label={t('voices.catalog.filters.age')}
                        values={CATALOG_AGES}
                        labelOf={(value) => t(`voices.catalog.age.${value}`, { defaultValue: value })}
                        selected={filters.age}
                        onSelect={(age) => onChange({ age })}
                    />
                    {offeredTags.length > 0 && (
                        <FilterRow label={t('voices.catalog.tags')}>
                            {offeredTags.map((tag) => {
                                const active = selectedTags.includes(tag)
                                return (
                                    <Chip
                                        key={tag}
                                        active={active}
                                        aria-pressed={active}
                                        disabled={!active && selectedTags.length >= CATALOG_MAX_TAGS}
                                        onClick={() => toggleTag(tag)}
                                    >
                                        {tag}
                                    </Chip>
                                )
                            })}
                        </FilterRow>
                    )}
                    {canRecommend && onRecommendedChange && (
                        <SwitchRow variant="plain" label={t('voices.catalog.recommended')} checked={recommended} onChange={onRecommendedChange} />
                    )}
                    {/* 05 §7.3: `include_locked` defaults to true, so only "off" is sent. */}
                    <SwitchRow
                        variant="plain"
                        label={t('voices.catalog.filters.showLocked')}
                        checked={filters.include_locked !== false}
                        onChange={(checked) => onChange({ include_locked: checked ? undefined : false })}
                    />
            </div>
        </div>
    )
}
