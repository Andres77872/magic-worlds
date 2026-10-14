import { cx } from '@/ui/primitives'

interface UsageMeterProps {
    label: string
    /** Visible value text, e.g. "48 / 660", or "Unknown" when a count is missing. */
    valueText: string
    /** Null when the provider did not report the count: no meter value is claimed. */
    value: number | null
    max: number | null
    alert?: boolean
    hint?: string
}

const known = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * A labelled meter bar; the value is always shown as text too. With an unknown
 * value or limit it renders only the label, the text and an empty track (no
 * `meter` role, so nothing claims a number the server did not send).
 */
export function UsageMeter({ label, valueText, value, max, alert = false, hint }: UsageMeterProps) {
    const measured = known(value) && known(max)
    const ratio = measured && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <span className="font-ui text-label font-semibold text-fg">{label}</span>
                <span className={cx('font-mono text-xs tabular-nums', alert ? 'text-blood-300' : 'text-parchment-300')}>{valueText}</span>
            </div>
            {measured ? (
                <div
                    role="meter"
                    aria-label={label}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={Math.min(value, max)}
                    aria-valuetext={valueText}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600"
                >
                    <div className={cx('h-full rounded-full', alert ? 'bg-blood-500' : 'bg-ember-500')} style={{ width: `${ratio * 100}%` }} />
                </div>
            ) : (
                <div aria-hidden="true" className="h-1.5 w-full rounded-full bg-ink-600" data-testid="usage-meter-unknown" />
            )}
            {hint && <span className={cx('font-ui text-caption', alert ? 'text-blood-300' : 'text-fg-muted')}>{hint}</span>}
        </div>
    )
}
