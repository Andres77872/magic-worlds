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
}

/** A labelled on-brand range row with a mono readout and reset-to-default. */
export function ControlSlider({ label, value, min, max, step, defaultValue, onChange, format }: ControlSliderProps) {
    const { t } = useTranslation()
    const display = format ? format(value) : String(value)
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <span className="font-ui text-sm text-parchment-200">{label}</span>
                <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-parchment-300">{display}</span>
                    {value !== defaultValue && (
                        <IconButton label={t('admin.voices.synth.reset', { label })} size="sm" onClick={() => onChange(defaultValue)}>
                            <Icon icon={RotateCcw} size={13} />
                        </IconButton>
                    )}
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                aria-label={label}
                aria-valuetext={display}
                onChange={(event) => onChange(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-600 accent-ember-500"
            />
        </div>
    )
}
