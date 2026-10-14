/**
 * One preset in the Voice studio (R1-FE-02). Shows the name and
 * description, the voice (with its effective projection and catalog badges),
 * the recipe chips, and the actions its kind allows:
 *
 * - user V2: Preview, Edit, Delete, and the 05 §7.8 owner prompts next to its
 *   badges (`leaving` → "Switch to {replacement}", `needs_reselect` → "Choose
 *   a voice" / "Keep for now", `retired` → "Pick another");
 * - user V1: "Update for new voices" (its conversion draft; disabled without
 *   one), Delete;
 * - global V1 or V2: read-only, with Duplicate (and Preview for V2).
 *
 * A V1 card names the voice its projection plays
 * (`effective_voice.display_name`, AC-S1, D35, U-04), never the legacy
 * `base_voice_name` it was saved with; without a projection it keeps that
 * stored name. An untuned preset whose preview is the voice's free catalog
 * sample says "Free: voice sample" by its Preview button (AC-P2, 05 §6.3).
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
import { Copy, Loader2, Pencil, Play, RefreshCw, Square, Trash2 } from 'lucide-react'
import type { CatalogVoice, VoicePresetRow, VoicePresetV2, VoiceReviewFlag } from '@/shared'
import { isPresetV2 } from '@/shared'
import { isElevenLabsProjection, voiceDisplayName } from '@/shared/voice'
import { Badge, Button, Icon, IconButton } from '@/ui/primitives'
import { baseLanguageCode } from '../languageCode'
import {
    conversionDraftOf,
    emotionLabel,
    isDefaultRecipe,
    presetRowBadges,
    previewSampleUrl,
    previewableLanguages,
    studioPreviewLanguage,
    v2FieldsOf,
} from '../presetRowsV2'
import { previewLanguage } from '../previewTexts'
import { settingsChips } from '../recipeV2'
import { voiceFromPreset } from '../voiceFromPreset'
import { EffectiveVoiceLabel } from './EffectiveVoiceLabel'
import { VoiceBadges, languageLabel } from './VoiceBadges'
import { VoiceOwnerPrompts, type VoiceReplacement } from './VoiceOwnerPrompts'

/**
 * The language a V2 card's preview is heard in, or null when the card cannot
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
    row: VoicePresetRow
    /** The catalog entry of the row's voice (lookup; a V1 row's effective voice, `presetCatalogKey`), when known. */
    catalogItem?: CatalogVoice | null
    /** The open review flag on this preset (`$`), if any: a `review` badge (the notice itself is in the studio's flag list). */
    reviewFlag?: VoiceReviewFlag | null
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
    onUpdate?: () => void
    onDuplicate?: () => void
    onDelete?: () => void
}

export function PresetCardV2({
    row,
    catalogItem = null,
    reviewFlag = null,
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
    onUpdate,
    onDuplicate,
    onDelete,
}: PresetCardV2Props) {
    const { t, i18n } = useTranslation()
    const v2 = isPresetV2(row)
    const draft = conversionDraftOf(row)
    const fields = v2FieldsOf(row)
    const chips = v2 ? settingsChips(row.settings, t) : []
    // A V1 row's catalog item is the voice its projection plays: it adds only the language check.
    const badges = presetRowBadges(row, catalogItem, Boolean(reviewFlag), language)
    const owner = v2 && !row.is_global
    const canDuplicate = row.is_global && Boolean(fields)
    // AC-S1 / D35: a V1 row plays as its projection's voice, not the legacy one it was saved with.
    const heardName = !v2 && isElevenLabsProjection(row.effective_voice) ? row.effective_voice.display_name.trim() : ''
    const freeHintId = useId()
    const showFreeHint = v2 && Boolean(onPreview) && previewFree && !previewing
    const paidLabel = `${t('voices.studio.v2.preview')} · ${t('voices.preview.costsCredit')}`
    const previewName = (() => {
        if (!v2) return undefined
        if (previewing) return t('voices.studio.v2.stopNamed', { name: row.name })
        const voice = voiceDisplayName(voiceFromPreset(row)) ?? t('voices.display.fallbackName')
        const heard = cardPreviewLanguage(row, catalogItem, language, previewLanguage(i18n.resolvedLanguage ?? i18n.language))
        const values = { name: row.name, voice, label: paidLabel, ...(heard ? { language: languageLabel(heard, i18n.language) } : {}) }
        // WCAG 2.5.3: the paid name starts with the visible "Preview · 1 credit".
        if (previewCostsCredit) return t(heard ? 'voices.studio.v2.previewNamedCredit' : 'voices.studio.v2.previewNamedVoiceCredit', values)
        return t(heard ? 'voices.studio.v2.previewNamed' : 'voices.studio.v2.previewNamedVoice', values)
    })()
    return (
        <article data-testid="preset-card-v2" data-preset-id={row.preset_id} data-kind={v2 ? 'v2' : 'v1'}>
            <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-ui text-sm font-semibold text-parchment-50">{row.name}</p>
                        {row.is_global && <Badge tone="arcane">{t('voices.studio.defaultBadge')}</Badge>}
                        {!v2 && <Badge tone="warning">{t('voices.studio.v2.needsUpdate')}</Badge>}
                    </div>
                    {v2 ? (
                        <EffectiveVoiceLabel
                            stored={voiceFromPreset(row)}
                            effective={row.effective_voice}
                            showBadges={false}
                            nameClassName="truncate font-ui text-xs text-parchment-400"
                        />
                    ) : (
                        // The voice it plays now, else the stored name; never the raw legacy id (D35, 09 §3.3).
                        <p className="font-ui text-xs text-parchment-400" data-testid="preset-card-voice">
                            {heardName || row.base_voice_name || t('voices.display.fallbackName')}
                        </p>
                    )}
                    {row.description && <p className="font-ui text-sm text-parchment-300">{row.description}</p>}
                    {(chips.length > 0 || (v2 && row.emotion)) && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {chips.map((chip) => (
                                <Badge key={chip} tone="glass">{chip}</Badge>
                            ))}
                            {v2 && row.emotion && <Badge tone="glass">{emotionLabel(row.emotion, t)}</Badge>}
                        </div>
                    )}
                    {badges.length > 0 && (
                        <VoiceBadges
                            badges={badges}
                            context={{
                                date: catalogItem?.disable_at ?? null,
                                minPlan: catalogItem?.min_plan ?? null,
                                original: fields?.voice_name ?? null,
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
                    {!v2 && !row.is_global && !draft && (
                        <p className="font-ui text-caption text-fg-muted">{t('voices.studio.v2.conversionUnavailable')}</p>
                    )}
                    {row.is_global && <p className="font-ui text-caption text-fg-muted">{t('voices.studio.v2.readOnlyGlobal')}</p>}
                    {children}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex flex-wrap justify-end gap-2">
                        {v2 && onPreview && (
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
                        {!row.is_global && !v2 && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!draft || !onUpdate}
                                iconLeft={<Icon icon={RefreshCw} size={14} />}
                                onClick={onUpdate}
                            >
                                {t('voices.studio.v2.update')}
                            </Button>
                        )}
                        {row.is_global && (
                            <IconButton
                                label={t('voices.studio.duplicateLabel', { name: row.name })}
                                size="sm"
                                disabled={!canDuplicate || !onDuplicate}
                                onClick={onDuplicate}
                            >
                                <Icon icon={Copy} size={15} />
                            </IconButton>
                        )}
                        {!row.is_global && v2 && onEdit && (
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
