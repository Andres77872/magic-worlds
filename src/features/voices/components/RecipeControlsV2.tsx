/**
 * The ElevenLabs recipe controls (R1-FE-02, D13): stability, similarity and,
 * where the tier supports it, speed. Ranges, steps and defaults come from the
 * capabilities `surface` only; a control the server does not mark
 * user-editable, or sends without a range, is not rendered. `style` and
 * `use_speaker_boost` are never shown.
 *
 * On a tier without speed (Expressive) the speed slider is hidden with a note,
 * and the stored speed value is kept in every change; on Expressive,
 * `onShowStandard` adds the 05 §5.1 "Show Standard controls" link that
 * switches the preview tier. On
 * Expressive the controls carry the `expressive_only` badge (03 §5.12, AC-P8).
 * A slider at its default shows the "Voice default" tag (05 §5.1); stability
 * and similarity carry their end labels, and speed reads "1.05×" (05 §5.1,
 * §9.3). "Use voice defaults" emits null. Without capabilities the recipe
 * shows as read-only chips with a retry.
 *
 * Every slider shows exactly what a save writes (05 §5.1): a stored value off
 * the 0.05 grid shows snapped, as the save stores it, with no flag.
 * AC-E2: a stored value outside the range a save clamps to (`writeControls`,
 * else the surface's own controls) is never adjusted silently. Its slider
 * shows the clamped value with a flag saying what the save will store; a
 * flagged value with no slider here (speed on Expressive, or the read-only
 * recipe) gets the same flag below. Nothing is written until the user saves or
 * moves that slider.
 */
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import type { VoiceControlKey, VoiceControlSpec, VoiceSettingsV2, VoiceSurfaceCapabilities } from '@/shared'
import { Badge, Button, Callout, Icon, cx } from '@/ui/primitives'
import { formatControlValue, outOfRangeSettings, quantizeSetting, settingsChips, writtenSetting, type OutOfRangeSetting } from '../recipeV2'
import { ControlSlider } from './ControlSlider'
import { VoiceBadges } from './VoiceBadges'

const LABEL_KEYS: Partial<Record<VoiceControlKey, string>> = {
    stability: 'voices.recipe.stability',
    similarity_boost: 'voices.recipe.similarity',
    speed: 'voices.recipe.speed',
}

/** 05 §5.1 / §9.3: the low ↔ high end labels of a slider. */
const END_KEYS: Partial<Record<VoiceControlKey, readonly [string, string]>> = {
    stability: ['voices.recipe.stabilityLow', 'voices.recipe.stabilityHigh'],
    similarity_boost: ['voices.recipe.similarityLow', 'voices.recipe.similarityHigh'],
}

const SHOWN: ReadonlySet<VoiceControlKey> = new Set<VoiceControlKey>(['stability', 'similarity_boost', 'speed'])

/** The sliders a surface offers, in its order. */
export function visibleControls(surface: VoiceSurfaceCapabilities | null | undefined): VoiceControlSpec[] {
    if (!surface) return []
    return surface.controls.filter((spec) =>
        spec.user_editable
        && SHOWN.has(spec.key)
        && (spec.key !== 'speed' || surface.supports_speed)
        && typeof spec.default === 'number'
        && typeof spec.min === 'number'
        && typeof spec.max === 'number',
    )
}

function controlLabel(key: VoiceControlKey, t: TFunction): string {
    return t(LABEL_KEYS[key] ?? key)
}

/**
 * The spoken value (05 §10): "Speed 1.05 times"; stability and similarity
 * name the end they lean to ("Stability 0.40, more expressive").
 */
function spokenValue(spec: VoiceControlSpec, value: number, label: string, t: TFunction, locale: string): string {
    if (spec.key === 'speed') return t('voices.recipe.speedValueText', { label, value: value.toFixed(2) })
    const spoken = `${label} ${formatControlValue(spec.key, value)}`
    const ends = END_KEYS[spec.key]
    if (!ends || typeof spec.min !== 'number' || typeof spec.max !== 'number') return spoken
    const middle = (spec.min + spec.max) / 2
    if (Math.abs(value - middle) < 1e-3) return spoken
    return `${spoken}, ${t(value < middle ? ends[0] : ends[1]).toLocaleLowerCase(locale)}`
}

/** AC-E2: the flag of one out-of-range value, saying what the save stores. */
function OutOfRangeNotice({ flag, shown, t }: { flag: OutOfRangeSetting; shown: boolean; t: TFunction }) {
    return (
        <Callout tone="warning" role="note" icon={<Icon icon={TriangleAlert} size={14} />} data-testid="recipe-out-of-range" data-key={flag.key}>
            <span className="text-caption">
                {t(shown ? 'voices.recipe.outOfRange' : 'voices.recipe.outOfRangeHidden', {
                    label: controlLabel(flag.key, t),
                    stored: formatControlValue(flag.key, flag.stored),
                    adjusted: formatControlValue(flag.key, flag.adjusted),
                })}
            </span>
        </Callout>
    )
}

interface RecipeControlsV2Props {
    surface: VoiceSurfaceCapabilities | null
    settings: VoiceSettingsV2 | null
    onChange: (next: VoiceSettingsV2 | null) => void
    disabled?: boolean
    /** Re-read the capabilities (shown when `surface` is null). */
    onRetry?: () => void
    /** Switch the preview to Standard, where speed is shown (the link on a tier without speed). */
    onShowStandard?: () => void
    /**
     * The ranges a save clamps to (the editor's write controls). Defaults to
     * the surface's own controls; every value they would clamp is flagged (AC-E2).
     */
    writeControls?: readonly VoiceControlSpec[]
    className?: string
}

export function RecipeControlsV2({ surface, settings, onChange, disabled = false, onRetry, onShowStandard, writeControls, className }: RecipeControlsV2Props) {
    const { t, i18n } = useTranslation()
    const written = writeControls ?? surface?.controls ?? []
    const flags = outOfRangeSettings(settings, written)

    if (!surface) {
        return (
            <div className={cx('flex flex-col gap-2', className)} data-testid="recipe-controls-readonly">
                <div className="flex flex-wrap gap-1.5">
                    {settingsChips(settings, t).map((chip) => (
                        <Badge key={chip} tone="glass">{chip}</Badge>
                    ))}
                </div>
                {flags.map((flag) => <OutOfRangeNotice key={flag.key} flag={flag} shown={false} t={t} />)}
                {onRetry && (
                    <Button variant="secondary" size="sm" className="self-start" iconLeft={<Icon icon={RefreshCw} size={14} />} onClick={onRetry}>
                        {t('voices.catalog.retry')}
                    </Button>
                )}
            </div>
        )
    }

    const controls = visibleControls(surface)
    const speedHidden = !surface.supports_speed
    const flagOf = (key: VoiceControlKey) => flags.find((flag) => flag.key === key)
    const hiddenFlags = flags.filter((flag) => !controls.some((spec) => spec.key === flag.key))
    const change = (spec: VoiceControlSpec, raw: number) => {
        const value = quantizeSetting(raw, spec)
        // Spread the current settings: a hidden value (speed on Expressive) is never dropped.
        onChange({ ...(settings ?? {}), [spec.key]: value })
    }

    return (
        <div className={cx('flex flex-col gap-4', className)} data-testid="recipe-controls-v2">
            {surface.tier === 'expressive' && <VoiceBadges badges={['expressive_only']} className="self-start" />}
            {controls.map((spec) => {
                const stored = settings?.[spec.key as keyof VoiceSettingsV2]
                const fallback = spec.default as number
                const flag = flagOf(spec.key)
                // 05 §5.1, AC-E2: the slider shows what a save writes, on the 0.05 grid; an
                // out-of-range value shows clamped, with its flag. Display only: nothing is emitted.
                const value = typeof stored === 'number' && Number.isFinite(stored) ? writtenSetting(spec.key, stored, written) : fallback
                const label = controlLabel(spec.key, t)
                const ends = END_KEYS[spec.key]
                return (
                    <ControlSlider
                        key={spec.key}
                        label={label}
                        value={value}
                        min={spec.min as number}
                        max={spec.max as number}
                        step={spec.step && spec.step > 0 ? spec.step : 0.05}
                        defaultValue={fallback}
                        defaultTag={t('voices.recipe.defaultTag')}
                        lowLabel={ends ? t(ends[0]) : undefined}
                        highLabel={ends ? t(ends[1]) : undefined}
                        notice={flag ? <OutOfRangeNotice flag={flag} shown t={t} /> : undefined}
                        disabled={disabled}
                        format={(next) => formatControlValue(spec.key, next)}
                        valueText={(next) => spokenValue(spec, next, label, t, i18n.language)}
                        onChange={(next) => change(spec, next)}
                    />
                )
            })}
            {speedHidden && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-ui text-caption text-fg-muted">{t('voices.recipe.speedExpressiveNote')}</p>
                    {/* 05 §5.1: the link lives on Expressive; on any other surface it would switch to the tier already shown. */}
                    {onShowStandard && surface.tier === 'expressive' && (
                        <Button variant="ghost" size="sm" disabled={disabled} onClick={onShowStandard}>
                            {t('voices.recipe.showStandardControls')}
                        </Button>
                    )}
                </div>
            )}
            {hiddenFlags.map((flag) => <OutOfRangeNotice key={flag.key} flag={flag} shown={false} t={t} />)}
            <Button variant="ghost" size="sm" className="self-start" disabled={disabled || settings === null} onClick={() => onChange(null)}>
                {t('voices.recipe.useDefaults')}
            </Button>
        </div>
    )
}
