import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { Icon, IconButton } from '@/ui/primitives'

interface ControlSliderProps {
    label: string
    value: number
    min: number
    max: number
    step: number
    defaultValue: number
    onChange: (value: number) => void
    format?: (value: number) => string
    /** Spoken value (05 §10), e.g. "Speed 1.05 times"; defaults to the formatted readout. */
    valueText?: (value: number) => string
    disabled?: boolean
    /**
     * Opt-in tag shown while the value equals `defaultValue` (05 §5.1 "Voice
     * default"); hosts that do not pass it render exactly as before.
     */
    defaultTag?: string
    /**
     * Opt-in end labels under the track (05 §5.1, e.g. "More expressive" ↔
     * "More consistent"); hosts that pass neither render exactly as before.
     */
    lowLabel?: string
    highLabel?: string
    /**
     * Opt-in note under the row (e.g. the AC-E2 out-of-range flag), wired to
     * the input through `aria-describedby`.
     */
    notice?: ReactNode
    /**
     * PageUp/PageDown step (05 §10 Sliders: ±0.25 on the 0.05 grid), clamped
     * and snapped to `step`. Defaults to `PAGE_STEP` when `step` divides it
     * into two or more steps (0.05, 0.01); on any other grid (a coarse 0.1 or
     * 1 step), or with null, the browser's own page step stands.
     */
    pageStep?: number | null
}

/** 05 §10 Sliders: PageUp/PageDown move ±0.25. */
const PAGE_STEP = 0.25

/** `PAGE_STEP` when it is a whole number (two or more) of `step`s, else null (the browser's page step). */
function defaultPageStep(step: number): number | null {
    if (!(step > 0) || step >= PAGE_STEP) return null
    const steps = PAGE_STEP / step
    return Math.abs(steps - Math.round(steps)) < 1e-9 ? PAGE_STEP : null
}

function decimalsOf(value: number): number {
    const text = String(value)
    const exponent = /e-(\d+)$/.exec(text)
    if (exponent) return Number(exponent[1])
    return text.includes('.') ? text.split('.')[1].length : 0
}

/**
 * `value` moved by `delta`, clamped to [min, max] and snapped to the slider's
 * grid (`min + k × step`, never past `max`), without float noise.
 */
function pagedValue(value: number, delta: number, min: number, max: number, step: number): number {
    const target = Math.min(max, Math.max(min, value + delta))
    const lastStep = Math.floor((max - min) / step + 1e-9)
    const steps = Math.min(lastStep, Math.max(0, Math.round((target - min) / step)))
    return Number((min + steps * step).toFixed(Math.max(decimalsOf(step), decimalsOf(min))))
}

/** Equal on the slider grid: float noise below a thousandth never hides the tag. */
function sameValue(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-3
}

/** A labelled on-brand range row with a mono readout and reset-to-default. */
export function ControlSlider({ label, value, min, max, step, defaultValue, onChange, format, valueText, disabled, defaultTag, lowLabel, highLabel, notice, pageStep }: ControlSliderProps) {
    const { t } = useTranslation()
    const id = useId()
    const noticeId = `${id}-notice`
    const display = format ? format(value) : String(value)
    const atDefault = Boolean(defaultTag) && sameValue(value, defaultValue)
    const page = pageStep === undefined ? defaultPageStep(step) : pageStep
    // Without a page step the input keeps no key handler: the browser's own keys, exactly as before.
    const onPageKey = page && page > 0 && !disabled
        ? (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key !== 'PageUp' && event.key !== 'PageDown') return
            event.preventDefault()
            const next = pagedValue(value, event.key === 'PageUp' ? page : -page, min, max, step)
            if (next !== value) onChange(next)
        }
        : undefined
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label htmlFor={id} className="font-ui text-sm text-parchment-200">
                    {label}
                </label>
                <div className="flex items-center gap-1">
                    {atDefault && (
                        <span className="mr-1 rounded-full bg-ink-600 px-2 py-0.5 font-ui text-caption text-parchment-300" data-testid="control-default-tag">
                            {defaultTag}
                        </span>
                    )}
                    <span className="font-mono text-xs text-parchment-300">{display}</span>
                    {value !== defaultValue && !disabled && (
                        <IconButton label={t('admin.voices.controls.reset', { label })} size="sm" onClick={() => onChange(defaultValue)}>
                            <Icon icon={RotateCcw} size={13} />
                        </IconButton>
                    )}
                </div>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                aria-valuetext={`${valueText ? valueText(value) : display}${atDefault ? `, ${defaultTag}` : ''}`}
                aria-describedby={notice ? noticeId : undefined}
                onChange={(event) => onChange(Number(event.target.value))}
                onKeyDown={onPageKey}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-600 accent-ember-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {(lowLabel || highLabel) && (
                <div className="flex items-start justify-between gap-3 font-ui text-caption text-fg-muted" data-testid="control-ends">
                    <span>{lowLabel}</span>
                    <span className="text-right">{highLabel}</span>
                </div>
            )}
            {notice && <div id={noticeId}>{notice}</div>}
        </div>
    )
}
