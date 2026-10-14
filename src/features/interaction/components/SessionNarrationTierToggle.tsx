/**
 * Per-session narration tier override (R1-FE-04, EP-1): Default / Standard /
 * Expressive for one adventure session or character chat.
 *
 * Shown to every signed-in caller; it renders nothing while the reads are
 * pending or after one failed. Requests ride `api`, the session's
 * `withWorkspace(id)` client, so X-Workspace-Id is sent.
 *
 * The options are a labelled radio group with the SegmentedControl look; it is
 * built here because Expressive must be disabled on its own when the plan does
 * not allow it, which the primitive does not offer.
 */
import { useId, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiService } from '@/infrastructure/api'
import type { NarrationTier } from '@/shared/types'
import type { SessionVoiceSettings, VoiceSessionBasePath } from '@/shared/types/sessionVoice.types'
import { cx } from '@/ui/primitives/cx'
import { useSessionNarrationTier } from '../hooks/useSessionNarrationTier'

export interface SessionNarrationTierToggleProps {
    /** The session's workspace-scoped client (`config.api` / `apiService.withWorkspace(id)`). */
    api: ApiService
    basePath: VoiceSessionBasePath
    sessionId: number
    /** Archived workspace or another read-only state: the control is shown disabled. */
    readOnly?: boolean
}

type OptionValue = 'default' | NarrationTier

export interface SessionNarrationTierViewProps {
    settings: SessionVoiceSettings
    /** The account tier the Default option follows. */
    accountTier: NarrationTier
    readOnly?: boolean
    saving?: boolean
    error?: string | null
    onChange: (tier: NarrationTier | null) => void
}

const toValue = (tier: NarrationTier | null): OptionValue => tier ?? 'default'
const toTier = (value: OptionValue): NarrationTier | null => (value === 'default' ? null : value)

/** The presentational control (stories and tests). */
export function SessionNarrationTierView({ settings, accountTier, readOnly = false, saving = false, error = null, onChange }: SessionNarrationTierViewProps) {
    const { t } = useTranslation()
    const labelId = useId()
    const hintId = useId()
    const refs = useRef<(HTMLButtonElement | null)[]>([])
    const expressiveAllowed = settings.tiers_allowed.includes('expressive')
    const selected = toValue(settings.tier_override)
    const options: { value: OptionValue; label: string; disabled: boolean }[] = [
        { value: 'default', label: t('voices.sessionTier.default', { tier: t(`voices.tier.${accountTier}`) }), disabled: false },
        { value: 'standard', label: t('voices.tier.standard'), disabled: false },
        { value: 'expressive', label: t('voices.tier.expressive'), disabled: !expressiveAllowed && selected !== 'expressive' },
    ]
    const locked = readOnly || saving
    const enabled = options.filter((option) => !option.disabled)

    const choose = (value: OptionValue) => {
        if (locked || value === selected) return
        onChange(toTier(value))
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, value: OptionValue) => {
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        if (!forward && !back) return
        event.preventDefault()
        const index = enabled.findIndex((option) => option.value === value)
        const next = enabled[(index + (forward ? 1 : -1) + enabled.length) % enabled.length]
        choose(next.value)
        refs.current[options.indexOf(next)]?.focus()
    }

    const fallback = settings.tier_fallback_reason === 'plan'
        ? t('voices.tier.expressiveUpsell')
        : settings.tier_fallback_reason === 'unhealthy'
            ? t('voices.badge.standard_fallback_tooltip')
            : null

    return (
        <section className="flex min-w-0 flex-col gap-2" data-testid="session-narration-tier">
            <span id={labelId} className="font-ui text-sm font-semibold text-parchment-50">
                {t('voices.sessionTier.label')}
            </span>
            <div
                role="radiogroup"
                aria-labelledby={labelId}
                aria-describedby={hintId}
                aria-disabled={locked || undefined}
                className="inline-flex max-w-full flex-wrap items-center gap-0.5 self-start rounded-lg border border-line-faint bg-surface-raised p-1"
            >
                {options.map((option, index) => {
                    const checked = option.value === selected
                    return (
                        <button
                            key={option.value}
                            ref={(node) => {
                                refs.current[index] = node
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            tabIndex={checked ? 0 : -1}
                            disabled={option.disabled || (locked && !checked)}
                            aria-disabled={locked || option.disabled || undefined}
                            title={option.value === 'expressive' && !expressiveAllowed ? t('voices.tier.lockedHint') : undefined}
                            onClick={() => choose(option.value)}
                            onKeyDown={(event) => handleKeyDown(event, option.value)}
                            className={cx(
                                'inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 font-ui text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                                checked ? 'bg-ember-500/10 text-ember-300' : 'text-parchment-300 enabled:hover:bg-parchment-50/[.04] enabled:hover:text-parchment-100',
                            )}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>
            <span id={hintId} className="font-ui text-xs leading-snug text-parchment-300">
                {!expressiveAllowed ? `${t('voices.sessionTier.hint')} ${t('voices.tier.lockedHint')}` : t('voices.sessionTier.hint')}
            </span>
            {fallback && <span className="font-ui text-xs leading-snug text-parchment-300">{fallback}</span>}
            {error && (
                <span role="alert" className="font-ui text-xs leading-snug text-blood-300">
                    {error}
                </span>
            )}
        </section>
    )
}

export function SessionNarrationTierToggle({ api, basePath, sessionId, readOnly = false }: SessionNarrationTierToggleProps) {
    const state = useSessionNarrationTier(api, basePath, sessionId)
    if (!state.settings) return null
    return (
        <SessionNarrationTierView
            settings={state.settings}
            accountTier={state.capabilities?.narration_tier ?? 'standard'}
            readOnly={readOnly}
            saving={state.saving}
            error={state.error}
            onChange={(tier) => void state.setTier(tier)}
        />
    )
}
