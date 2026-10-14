/**
 * One preset in the Voice studio (R1-FE-02). Shows the name and
 * description, the voice (with its effective projection and catalog badges),
 * the recipe chips, and the actions its kind allows:
 *
 * - user: Preview, Edit, Delete, and the 05 §7.8 owner prompts next to its
 *   badges (`leaving` → "Switch to {replacement}", `needs_reselect` → "Choose
 *   a voice" / "Keep for now", `retired` → "Pick another");
 * - global: read-only, with Preview and Duplicate.
 *
 * An untuned preset whose preview is the voice's free catalog sample says
 * "Free: voice sample" by its Preview button (AC-P2, 05 §6.3).
 *
 * `not_tested_language` shows when `language` (the preset's, else the
 * preferred one) has no accepted row for the voice (05 §5.5, §7.7).
 *
 * 05 §10 audio controls: the Preview button names the preset, the voice and
 * (when the card can tell, `cardPreviewLanguage`) the language heard. Its name
 * starts with its visible text (WCAG 2.5.3): "Preview · 1 credit: {name}, …"
 * when it shows the credit. While its render is in flight it is a "Stop"
 * action (05 §6.3) named "Stop the preview of {name}", so it is not a toggle
 * (`aria-pressed` with a changing name gives two contradictory signals,
 * WAI-ARIA APG): the clip's own play button (`VoiceClipPlayer`) carries
 * `aria-pressed` while the preview plays. The picker's preset rows match.
 */
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Loader2, Pencil, Play, Square, Trash2 } from 'lucide-react'
import type { CatalogVoice, VoicePresetV2 } from '@/shared'
import { voiceDisplayName } from '@/shared/voice'
import { Badge, Button, Icon, IconButton } from '@/ui/primitives'
import { baseLanguageCode } from '../languageCode'
import {
    emotionLabel,
    isDefaultRecipe,
    presetRowBadges,
    previewSampleUrl,
    previewableLanguages,
    studioPreviewLanguage,
} from '../presetRowsV2'
import { previewLanguage } from '../previewTexts'
import { settingsChips } from '../recipeV2'
import { voiceFromPreset } from '../voiceFromPreset'
import { EffectiveVoiceLabel } from './EffectiveVoiceLabel'
import { VoiceBadges, languageLabel } from './VoiceBadges'
import { VoiceOwnerPrompts, type VoiceReplacement } from './VoiceOwnerPrompts'

/**
 * The language a card's preview is heard in, or null when the card cannot
 * tell. It follows the Studio's rule (`studioPreviewLanguage`: the preset's
 * language, the voice's primary one, then the preferred one, keeping the first
 * the voice previews in; `language` is the preset's, else the preferred one),
 * and an untuned recipe plays the voice's catalog sample, which may be in its
 * primary language. The card is told neither the preferred language beside a
 * preset's own nor the preview tier, so it says null where either could change
 * the answer.
 */
function cardPreviewLanguage(row: VoicePresetV2, item: CatalogVoice | null, language: string | null, appLanguage: string): string | null {
    const own = row.language_code?.trim() || null
    if (own && item) {
        const accepted = previewableLanguages(item)
        // Neither previews: the Studio falls back to the preferred language, which this card is not told.
        if (![own, item.primary_language].some((code) => accepted.includes(baseLanguageCode(code) ?? ''))) return null
    }
    const text = studioPreviewLanguage(item, { languageCode: own, preferredLanguage: language, fallback: appLanguage })
    if (!item || !isDefaultRecipe(row.settings, row.emotion)) return text
    // The sample served on each tier (none: a render in the text language); they must agree.
    const [standard, expressive] = (['standard', 'expressive'] as const).map((tier) => {
        const url = previewSampleUrl(item, text, tier)
        return url === null ? text : item.languages.find((entry) => entry.sample_url === url)?.language ?? text
    })
    return baseLanguageCode(standard) === baseLanguageCode(expressive) ? standard : null
}

interface PresetCardV2Props {
    row: VoicePresetV2
    /** The catalog entry of the row's voice (lookup), when known. */
    catalogItem?: CatalogVoice | null
    /** The language the voice is checked against for `not_tested_language`. */
    language?: string | null
    /** Owner prompt: write the leaving voice's replacement. */
    onSwitchVoice?: (replacement: VoiceReplacement) => void
    /** Owner prompt: open the editor on the voice picker. */
    onChooseVoice?: () => void
    /** The replacement is being written. */
    switching?: boolean
    previewing?: boolean
    previewDisabled?: boolean
    /** The preview is past the free renders: the button reads "Preview · 1 credit" (AC-P5, 05 §6.3). */
    previewCostsCredit?: boolean
    /** The preview is the voice's free catalog sample: "Free: voice sample" by the button (AC-P2, 05 §6.3). */
    previewFree?: boolean
    deleting?: boolean
    /** The preview player and its error, rendered under the card. */
    children?: ReactNode
    onPreview?: () => void
    onEdit?: () => void
    onDuplicate?: () => void
    onDelete?: () => void
}

export function PresetCardV2({
    row,
    catalogItem = null,
    language = null,
    onSwitchVoice,
    onChooseVoice,
    switching = false,
    previewing = false,
    previewDisabled = false,
    previewCostsCredit = false,
    previewFree = false,
    deleting = false,
    children,
    onPreview,
    onEdit,
    onDuplicate,
    onDelete,
}: PresetCardV2Props) {
    const { t, i18n } = useTranslation()
    const chips = settingsChips(row.settings, t)
    const badges = presetRowBadges(row, catalogItem, language)
    const owner = !row.is_global
    const freeHintId = useId()
    const showFreeHint = Boolean(onPreview) && previewFree && !previewing
    const paidLabel = `${t('voices.studio.v2.preview')} · ${t('voices.preview.costsCredit')}`
    const previewName = (() => {
        if (previewing) return t('voices.studio.v2.stopNamed', { name: row.name })
        const voice = voiceDisplayName(voiceFromPreset(row)) ?? t('voices.display.fallbackName')
        const heard = cardPreviewLanguage(row, catalogItem, language, previewLanguage(i18n.resolvedLanguage ?? i18n.language))
        const values = { name: row.name, voice, label: paidLabel, ...(heard ? { language: languageLabel(heard, i18n.language) } : {}) }
        // WCAG 2.5.3: the paid name starts with the visible "Preview · 1 credit".
        if (previewCostsCredit) return t(heard ? 'voices.studio.v2.previewNamedCredit' : 'voices.studio.v2.previewNamedVoiceCredit', values)
        return t(heard ? 'voices.studio.v2.previewNamed' : 'voices.studio.v2.previewNamedVoice', values)
    })()
    return (
        <article data-testid="preset-card-v2" data-preset-id={row.preset_id}>
            <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-ui text-sm font-semibold text-parchment-50">{row.name}</p>
                        {row.is_global && <Badge tone="arcane">{t('voices.studio.defaultBadge')}</Badge>}
                    </div>
                    <EffectiveVoiceLabel
                        stored={voiceFromPreset(row)}
                        effective={row.effective_voice}
                        showBadges={false}
                        nameClassName="truncate font-ui text-xs text-parchment-400"
                    />
                    {row.description && <p className="font-ui text-sm text-parchment-300">{row.description}</p>}
                    {(chips.length > 0 || row.emotion) && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {chips.map((chip) => (
                                <Badge key={chip} tone="glass">{chip}</Badge>
                            ))}
                            {row.emotion && <Badge tone="glass">{emotionLabel(row.emotion, t)}</Badge>}
                        </div>
                    )}
                    {badges.length > 0 && (
                        <VoiceBadges
                            badges={badges}
                            context={{
                                date: catalogItem?.disable_at ?? null,
                                minPlan: catalogItem?.min_plan ?? null,
                                original: row.voice_name ?? null,
                                name: catalogItem?.replacement?.display_name ?? null,
                                language,
                            }}
                        />
                    )}
                    {owner && badges.length > 0 && (
                        <VoiceOwnerPrompts
                            className="mt-1"
                            badges={badges}
                            replacement={catalogItem?.replacement ?? null}
                            onSwitch={onSwitchVoice}
                            onChoose={onChooseVoice}
                            busy={switching}
                        />
                    )}
                    {row.is_global && <p className="font-ui text-caption text-fg-muted">{t('voices.studio.v2.readOnlyGlobal')}</p>}
                    {children}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-2">
                        {onPreview && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={previewDisabled && !previewing}
                                iconLeft={<Icon icon={previewing ? Square : Play} size={14} />}
                                aria-label={previewName}
                                aria-describedby={showFreeHint ? freeHintId : undefined}
                                onClick={onPreview}
                            >
                                {previewing
                                    ? t('voices.preview.stop')
                                    : previewCostsCredit
                                      ? paidLabel
                                      : t('voices.studio.v2.preview')}
                            </Button>
                        )}
                        {row.is_global && (
                            <IconButton
                                label={t('voices.studio.duplicateLabel', { name: row.name })}
                                size="sm"
                                disabled={!onDuplicate}
                                onClick={onDuplicate}
                            >
                                <Icon icon={Copy} size={15} />
                            </IconButton>
                        )}
                        {!row.is_global && onEdit && (
                            <IconButton label={t('voices.studio.editLabel', { name: row.name })} size="sm" onClick={onEdit}>
                                <Icon icon={Pencil} size={15} />
                            </IconButton>
                        )}
                        {!row.is_global && onDelete && (
                            <IconButton
                                label={t('voices.studio.deleteLabel', { name: row.name })}
                                size="sm"
                                tone="danger"
                                disabled={deleting}
                                onClick={onDelete}
                            >
                                <Icon icon={deleting ? Loader2 : Trash2} size={15} className={deleting ? 'animate-spin' : undefined} />
                            </IconButton>
                        )}
                    </div>
                    {showFreeHint && (
                        <p id={freeHintId} className="font-ui text-caption text-fg-muted" data-testid="preset-card-free-sample">
                            {t('voices.preview.freeSample')}
                        </p>
                    )}
                </div>
            </div>
        </article>
    )
}
