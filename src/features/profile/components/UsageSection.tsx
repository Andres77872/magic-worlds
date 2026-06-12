/**
 * "Today's usage" profile section — progress meters for the included daily
 * credits and each operation's daily limit. Reads the live top-level
 * membership.credits/limits (not profile_cards), so it renders even for API
 * responses that omit the membership cards payload.
 */
import { Gauge } from 'lucide-react'
import type { UserProfile } from '@/shared'
import { Card, Eyebrow, SectionHeader } from '@/ui/primitives'
import { cx } from '@/ui/primitives/cx'
import { formatNumber, operationLabel, orderedLimitEntries } from './membership.helpers'

interface UsageSectionProps {
    profile: UserProfile
}

export function UsageSection({ profile }: UsageSectionProps) {
    const membership = profile.membership
    if (!membership) {
        return null
    }

    const operations = orderedLimitEntries(membership.limits ?? {})

    return (
        <section className="flex flex-col gap-4" aria-labelledby="usage-heading">
            <SectionHeader icon={Gauge} title={<span id="usage-heading">Today's usage</span>} />
            <Card className="flex flex-col gap-5 p-5">
                <div className="flex flex-col gap-1.5">
                    <UsageMeter
                        label="Included credits"
                        used={membership.credits.used}
                        max={membership.credits.max}
                        ariaLabel="Included daily credits used"
                        prominent
                    />
                    <span className="font-ui text-[12px] text-parchment-400">
                        {formatNumber(membership.credits.remaining)} remaining today
                    </span>
                </div>

                {operations.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                        <Eyebrow tone="muted">Per operation</Eyebrow>
                        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                            {operations.map(([operation, limit]) => (
                                <UsageMeter
                                    key={operation}
                                    label={operationLabel(operation)}
                                    used={limit.used_today}
                                    max={limit.daily_limit}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        </section>
    )
}

interface UsageMeterProps {
    label: string
    used: number
    max: number
    ariaLabel?: string
    prominent?: boolean
}

function UsageMeter({ label, used, max, ariaLabel, prominent = false }: UsageMeterProps) {
    const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((used / max) * 100))) : 0

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
                {prominent ? (
                    <Eyebrow tone="muted">{label}</Eyebrow>
                ) : (
                    <span className="truncate font-ui text-[12px] font-semibold text-parchment-100">{label}</span>
                )}
                <span className="shrink-0 font-ui text-[11px] text-parchment-400">
                    {formatNumber(used)} of {formatNumber(max)}
                </span>
            </div>
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={Math.max(0, Math.min(used, max))}
                aria-label={ariaLabel ?? `${label} usage today`}
                className={cx('overflow-hidden rounded-full bg-ink-600', prominent ? 'h-2' : 'h-1.5')}
            >
                <div className={cx('h-full rounded-full', fillTone(used, max))} style={{ width: `${percent}%` }} />
            </div>
        </div>
    )
}

/** Ember normally, amber from 80% of the limit, blood once the limit is hit. */
function fillTone(used: number, max: number) {
    if (max <= 0) return 'bg-ember-500'
    if (used >= max) return 'bg-blood-500'
    if (used / max >= 0.8) return 'bg-amber-500'
    return 'bg-ember-500'
}
