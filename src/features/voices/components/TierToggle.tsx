/**
 * Standard / Expressive for a recipe preview (R1-FE-02, D05). A radiogroup over
 * the plan's `tiers_allowed`; it renders nothing unless Expressive is allowed
 * (a Free plan may get the upsell caption instead). Local to the preview: it
 * never writes the narration preference.
 *
 * The Expressive option carries the `expressive_only` badge "Expressive" as its
 * label (05 §5.1, AC-P8; 03 §5.12 shows it to Plus/Pro only, which is who sees
 * the toggle). Same look and keyboard model as `SegmentedControl`
 * (arrow keys move and select, roving tab stop), which has no badge slot.
 */
import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Volume2 } from 'lucide-react'
import type { NarrationTier, VoiceCapabilities } from '@/shared'
import { Badge, Icon, cx } from '@/ui/primitives'
import { BADGE_TONES } from './VoiceBadges'

/** The preview tier to start from: the stored preference, when the plan allows it. */
export function defaultPreviewTier(capabilities: VoiceCapabilities | null | undefined): NarrationTier {
    const tier = capabilities?.narration_tier ?? 'standard'
    return capabilities?.tiers_allowed.includes(tier) ? tier : 'standard'
}

interface TierToggleProps {
    capabilities: VoiceCapabilities | null | undefined
    value: NarrationTier
    onChange: (tier: NarrationTier) => void
    /** Show the Expressive upsell caption when the plan lacks it. */
    showUpsell?: boolean
    className?: string
}

export function TierToggle({ capabilities, value, onChange, showUpsell = false, className }: TierToggleProps) {
    const { t } = useTranslation()
    const refs = useRef<(HTMLButtonElement | null)[]>([])
    const allowed = capabilities?.tiers_allowed ?? []
    if (!allowed.includes('expressive')) {
        // The upsell needs a capabilities read: a failed one shows nothing (fail closed).
        return showUpsell && capabilities
            ? <p className={cx('font-ui text-caption text-fg-muted', className)}>{t('voices.tier.expressiveUpsell')}</p>
            : null
    }
    const tiers = (['standard', 'expressive'] as const).filter((tier) => allowed.includes(tier))

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        if (!forward && !back) return
        event.preventDefault()
        const next = (index + (forward ? 1 : -1) + tiers.length) % tiers.length
        onChange(tiers[next])
        refs.current[next]?.focus()
    }

    return (
        <div className={cx('flex flex-col gap-2', className)}>
            <p aria-hidden="true" className="font-ui text-label font-semibold text-fg">{t('voices.tier.label')}</p>
            <div
                role="radiogroup"
                aria-label={t('voices.tier.label')}
                className="inline-flex flex-wrap items-center gap-0.5 self-start rounded-lg border border-line-faint bg-surface-raised p-1"
            >
                {tiers.map((tier, index) => {
                    const selected = tier === value
                    return (
                        <button
                            key={tier}
                            ref={(node) => {
                                refs.current[index] = node
                            }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            tabIndex={selected ? 0 : -1}
                            data-tier={tier}
                            onClick={() => onChange(tier)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={cx(
                                'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 font-ui text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400',
                                selected ? 'bg-ember-500/10 text-ember-300' : 'text-parchment-300 hover:bg-parchment-50/[.04] hover:text-parchment-100',
                            )}
                        >
                            <span aria-hidden="true" className="shrink-0">
                                <Icon icon={tier === 'expressive' ? Sparkles : Volume2} size={14} />
                            </span>
                            {tier === 'expressive' ? (
                                <Badge tone={BADGE_TONES.expressive_only} data-badge="expressive_only">
                                    {t('voices.badge.expressive_only')}
                                </Badge>
                            ) : (
                                <span>{t('voices.tier.standard')}</span>
                            )}
                        </button>
                    )
                })}
            </div>
            {value === 'expressive' && <p className="font-ui text-caption text-fg-muted">{t('voices.tier.expressiveDescription')}</p>}
        </div>
    )
}
