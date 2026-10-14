/**
 * The account narration tier setting (R1-FE-04): "Expressive narration" on or
 * off, saved to the user preferences (`narration_tier`, with
 * `preferred_language`, R-31).
 *
 * Shown to every signed-in account once the capabilities are read (a read
 * error hides it), locked when `tiers_allowed` lacks expressive. Mounted by the
 * Voice Studio V2 header.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { NarrationTier } from '@/shared/types'
import { SwitchRow } from '@/ui/primitives'
import { useNarrationTier } from '../useNarrationTier'

export interface NarrationTierSettingViewProps {
    tier: NarrationTier
    locked: boolean
    saving?: boolean
    error?: string | null
    onChange: (tier: NarrationTier) => void
}

/** The presentational row (stories and tests); `NarrationTierSetting` wires it to the account. */
export function NarrationTierSettingView({ tier, locked, saving = false, error = null, onChange }: NarrationTierSettingViewProps) {
    const { t } = useTranslation()
    const errorId = useId()
    return (
        <section aria-label={t('voices.tier.label')} className="flex min-w-0 flex-col gap-1.5" data-testid="narration-tier-setting">
            <SwitchRow
                label={t('voices.tier.expressive')}
                description={locked ? t('voices.tier.lockedHint') : t('voices.tier.expressiveDescription')}
                checked={tier === 'expressive' && !locked}
                disabled={locked || saving}
                onChange={(on) => onChange(on ? 'expressive' : 'standard')}
            />
            {error && (
                <p id={errorId} role="alert" className="font-ui text-xs leading-snug text-blood-300">
                    {error}
                </p>
            )}
        </section>
    )
}

export function NarrationTierSetting() {
    const state = useNarrationTier()
    if (!state.visible) return null
    return (
        <NarrationTierSettingView
            tier={state.tier}
            locked={state.locked}
            saving={state.saving}
            error={state.error}
            onChange={(tier) => void state.setTier(tier)}
        />
    )
}
