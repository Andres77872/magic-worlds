/**
 * Voice state badges (R1-FE-03, 09 §8, 03 §5.12). The keys equal the BFF badge
 * values, so `effective_voice.badges[]` renders directly; unknown keys are
 * ignored (forward compatible). Every badge carries its meaning in text, never
 * in colour alone; badges with a hint (date, replacement, upgrade) also expose
 * it as a tooltip and `title`, and take focus so keyboard users reach it.
 * `locked` names the plan that unlocks the voice ("Plus" / "Pro" from
 * `min_plan`, 03 §5.12) with "Upgrade to pick this voice" as its hint; screen
 * readers hear "Locked: requires Plus", since the lock icon is decorative.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Lock } from 'lucide-react'
import type { VoiceBadgeKey } from '@/shared'
import { isVoiceBadgeKey } from '@/shared/voice'
import { Badge, Icon, Tooltip, cx, type BadgeTone } from '@/ui/primitives'

export interface VoiceBadgeContext {
    /** `disable_at` of the catalog voice (leaving). */
    date?: string | null
    /** Language code the voice is not tested in (not_tested_language). */
    language?: string | null
    /** The voice heard instead (replaced, call_voice). */
    name?: string | null
    /** The stored voice's own name (replaced). */
    original?: string | null
    /** Plan that unlocks a locked voice. */
    minPlan?: string | null
}

export const BADGE_TONES: Record<VoiceBadgeKey, BadgeTone> = {
    leaving: 'warning',
    needs_reselect: 'warning',
    retired: 'warning',
    replaced: 'neutral',
    standard_fallback: 'neutral',
    call_voice: 'neutral',
    locked: 'glass',
    house_voice: 'arcane',
    expressive_only: 'ember',
    not_tested_language: 'neutral',
}

/** Ordered for display: the actionable states first. */
const ORDER: readonly VoiceBadgeKey[] = [
    'needs_reselect', 'leaving', 'retired', 'replaced', 'locked',
    'call_voice', 'standard_fallback', 'not_tested_language', 'expressive_only', 'house_voice',
]

export function formatBadgeDate(value: string | null | undefined, language: string): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    try {
        return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
    } catch {
        return date.toISOString().slice(0, 10)
    }
}

export function languageLabel(code: string | null | undefined, uiLanguage: string): string {
    if (!code) return ''
    try {
        return new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code) ?? code
    } catch {
        return code
    }
}

interface BadgeCopy {
    text: string
    hint: string | null
    /** Replaces `text` for screen readers when the visible text leans on the icon. */
    srText?: string | null
}

const PLAN_KEYS: Readonly<Record<string, string>> = {
    plus: 'voices.badge.locked_plus',
    pro: 'voices.badge.locked_pro',
}

/** The plan name a `locked` badge shows, or null for an unknown or missing `min_plan`. */
export function lockedPlanLabel(minPlan: string | null | undefined, t: TFunction): string | null {
    const key = PLAN_KEYS[(minPlan ?? '').trim().toLowerCase()]
    return key ? t(key) : null
}

export function voiceBadgeCopy(badge: VoiceBadgeKey, context: VoiceBadgeContext, t: TFunction, uiLanguage: string): BadgeCopy {
    switch (badge) {
        case 'leaving': {
            const date = formatBadgeDate(context.date, uiLanguage)
            return { text: date ? t('voices.badge.leaving', { date }) : t('voices.badge.leaving_soon'), hint: null }
        }
        case 'replaced':
            return {
                text: t('voices.badge.replaced'),
                hint: context.original && context.name
                    ? t('voices.badge.replaced_tooltip', { original: context.original, name: context.name })
                    : t('voices.badge.replaced_tooltip_generic'),
            }
        case 'locked': {
            const plan = lockedPlanLabel(context.minPlan, t)
            return plan
                ? { text: plan, hint: t('voices.badge.locked_hint'), srText: t('voices.badge.locked_plan_sr', { plan }) }
                : { text: t('voices.badge.locked'), hint: t('voices.badge.locked_hint') }
        }
        case 'call_voice':
            return { text: t('voices.badge.call_voice', { name: context.name || t('voices.display.fallbackName') }), hint: null }
        case 'standard_fallback':
            return { text: t('voices.badge.standard_fallback'), hint: t('voices.badge.standard_fallback_tooltip') }
        case 'not_tested_language':
            return { text: t('voices.badge.not_tested_language', { language: languageLabel(context.language, uiLanguage) }), hint: null }
        default:
            return { text: t(`voices.badge.${badge}`), hint: null }
    }
}

interface VoiceBadgesProps {
    badges: readonly unknown[] | null | undefined
    context?: VoiceBadgeContext
    className?: string
}

export function VoiceBadges({ badges, context = {}, className }: VoiceBadgesProps) {
    const { t, i18n } = useTranslation()
    const known = new Set((badges ?? []).filter(isVoiceBadgeKey))
    const shown = ORDER.filter((badge) => known.has(badge))
    if (shown.length === 0) return null
    return (
        <div className={cx('inline-flex flex-wrap items-center gap-1.5', className)} data-testid="voice-badges">
            {shown.map((badge) => {
                const { text, hint, srText } = voiceBadgeCopy(badge, context, t, i18n.language)
                const icon: ReactNode = badge === 'locked' ? <Icon icon={Lock} size={12} /> : undefined
                const node = (
                    <Badge
                        key={badge}
                        tone={BADGE_TONES[badge]}
                        icon={icon}
                        title={hint ?? undefined}
                        tabIndex={hint ? 0 : undefined}
                        data-badge={badge}
                    >
                        {srText ? (
                            <>
                                <span aria-hidden="true">{text}</span>
                                <span className="sr-only">{srText}</span>
                            </>
                        ) : text}
                    </Badge>
                )
                return hint ? (
                    <Tooltip key={badge} label={hint} wrapperClassName="inline-flex">
                        {node}
                    </Tooltip>
                ) : node
            })}
        </div>
    )
}
