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
import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import type { VoiceAgeBucket, VoiceGender } from '@/shared'
import { Chip, Icon, Input, SwitchRow } from '@/ui/primitives'
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
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
            {offered.map((value) => {
                const active = selected === value
                return (
                    <Chip key={value} active={active} aria-pressed={active} data-value={value} onClick={() => onSelect(active ? undefined : value)}>
                        {labelOf(value)}
                    </Chip>
                )
            })}
        </div>
    )
}

export function CatalogFilters({ filters, onChange, languages, tags, canRecommend = false, recommended = false, onRecommendedChange, searchRef }: CatalogFiltersProps) {
    const { t, i18n } = useTranslation()
    const selectedTags = filters.tags ?? []
    const toggleTag = (tag: string) => {
        const next = selectedTags.includes(tag) ? selectedTags.filter((value) => value !== tag) : [...selectedTags, tag]
        onChange({ tags: next.slice(0, CATALOG_MAX_TAGS) })
    }
    const offeredTags = [...new Set([...selectedTags, ...tags])]
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
            {languages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('voices.catalog.filters.language')}>
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
                </div>
            )}
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
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('voices.catalog.tags')}>
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
                </div>
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
    )
}
