import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CharacterVoiceV2, VoiceBadgeKey, VoiceSubstitutionReason } from '@/shared'
import {
    CATALOG_SELA_LEAVING,
    EFFECTIVE_BY_REASON,
    V1_VOICE,
    V2_VOICE,
    VOICE_KEY_MAREN,
    VOICE_KEY_ORRIN,
    VOICE_KEY_SELA,
    VOICE_KEY_TOBIAS,
    effectiveVoice,
} from '../fixtures'
import { EffectiveVoiceLabel } from './EffectiveVoiceLabel'

type LabelProps = ComponentProps<typeof EffectiveVoiceLabel>

const storedV2 = (voiceKey: string, voiceName: string): CharacterVoiceV2 => ({ ...V2_VOICE, voice_key: voiceKey, voice_name: voiceName })

const SELA = storedV2(VOICE_KEY_SELA, 'Sela')
const TOBIAS = storedV2(VOICE_KEY_TOBIAS, 'Tobias')
const ORRIN = storedV2(VOICE_KEY_ORRIN, 'Orrin')
const MAREN = storedV2(VOICE_KEY_MAREN, 'Maren')

/** The voice still playing for a stored V2 voice: its own key and name, plus the given badges and flags. */
const own = (stored: CharacterVoiceV2, badges: VoiceBadgeKey[], flags: string[] = []) =>
    effectiveVoice({ voice_key: stored.voice_key, display_name: stored.voice_name, badges, flags })

/**
 * One row per badge key `VoiceBadges` can render (03 §5.12). Only `leaving`,
 * `retired`, `replaced`, `needs_reselect` and `review` reach this label from
 * the `effective_voice` projection; the other keys come from catalog rows
 * (`locked`, `house_voice`, `not_tested_language`, `expressive_only`), the call
 * note (`call_voice`) or narrated clips (`standard_fallback`), and are shown
 * here only so every key's copy can be reviewed in one place.
 */
const EVERY_BADGE: { badge: string; props: LabelProps }[] = [
    { badge: 'leaving', props: { stored: SELA, effective: own(SELA, ['leaving']), badgeContext: { date: CATALOG_SELA_LEAVING.disable_at } } },
    { badge: 'leaving (no date yet)', props: { stored: SELA, effective: own(SELA, ['leaving']) } },
    { badge: 'needs_reselect', props: { stored: SELA, effective: own(SELA, ['needs_reselect'], ['needs_review']) } },
    { badge: 'review', props: { stored: V2_VOICE, effective: effectiveVoice({ flags: ['speed_clamped'], badges: ['review'] }) } },
    { badge: 'retired', props: { stored: SELA, effective: own(SELA, ['retired']) } },
    { badge: 'replaced', props: { stored: V2_VOICE, effective: EFFECTIVE_BY_REASON.voice_removed } },
    { badge: 'locked', props: { stored: TOBIAS, effective: own(TOBIAS, ['locked']), badgeContext: { minPlan: 'plus' } } },
    { badge: 'call_voice', props: { stored: V2_VOICE, effective: EFFECTIVE_BY_REASON.not_call_eligible } },
    { badge: 'standard_fallback', props: { stored: V2_VOICE, effective: effectiveVoice({ substitution_reason: 'tier_fallback', badges: ['standard_fallback'] }) } },
    { badge: 'not_tested_language', props: { stored: ORRIN, effective: own(ORRIN, ['not_tested_language']), badgeContext: { language: 'es' } } },
    { badge: 'expressive_only', props: { stored: V2_VOICE, effective: own(V2_VOICE, ['expressive_only']) } },
    { badge: 'house_voice', props: { stored: MAREN, effective: own(MAREN, ['house_voice']) } },
]

const REASONS = Object.keys(EFFECTIVE_BY_REASON) as VoiceSubstitutionReason[]

/** Reasons the server badges `replaced` (04 §12.4): the voice picked is not the one heard. */
const REPLACED_REASONS: ReadonlySet<VoiceSubstitutionReason> = new Set<VoiceSubstitutionReason>([
    'voice_removed', 'voice_blocked', 'voice_unavailable', 'unmapped_legacy', 'language_unsupported',
])

/**
 * The projection the server sends for each reason (Maren plays instead): `replaced`
 * for the reasons above, plus `needs_reselect` for an unmapped classic voice;
 * the other reasons carry no badge on the projection.
 */
const serverProjection = (reason: VoiceSubstitutionReason) => effectiveVoice({
    voice_key: VOICE_KEY_MAREN,
    display_name: 'Maren',
    substitution_reason: reason,
    badges: [
        ...(REPLACED_REASONS.has(reason) ? ['replaced' as const] : []),
        ...(reason === 'unmapped_legacy' ? ['needs_reselect' as const] : []),
    ],
})

const meta = {
    title: 'Voices/EffectiveVoiceLabel',
    component: EffectiveVoiceLabel,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'A stored voice’s name plus what the listener actually hears (R1). Without a projection (a share-link reader) it is the plain name with no badges. With one, the server projection adds the voice badges, and when another voice plays, a "Plays as {name}" line names it while the stored name stays on top. The always-present "AI voice" label is not part of this component: it never depends on the projection.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[360px] max-w-full rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        stored: { control: false, description: 'The stored V1 or V2 voice (`voice` / `narrator_voice`).' },
        effective: { control: false, description: 'The read-only `effective_voice` projection; badges render only when it is present.' },
        badgeContext: { control: 'object', description: 'Badge details the projection does not carry: leaving `date`, untested `language`, `minPlan`.' },
        showBadges: { control: 'boolean' },
        fallback: { control: 'text', description: 'Copy when nothing is assigned or no name is known.' },
        className: { control: false },
        nameClassName: { control: false },
    },
    args: {
        stored: V1_VOICE,
        effective: serverProjection('unmapped_legacy'),
        badgeContext: {},
        showBadges: true,
    },
} satisfies Meta<typeof EffectiveVoiceLabel>

export default meta
type Story = StoryObj<typeof meta>

/** A classic voice with no mapping yet: it keeps its name, plays as Maren, and needs re-selection. */
export const Playground: Story = {}

/** Every badge on its own label, in the situation that produces it. */
export const EveryBadge: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <ul className="flex flex-col gap-4">
            {EVERY_BADGE.map(({ badge, props }) => (
                <li key={badge} className="flex flex-col gap-1.5 border-b border-parchment-50/[.08] pb-3 last:border-b-0 last:pb-0">
                    <code className="font-mono text-caption text-fg-subtle">{badge}</code>
                    <EffectiveVoiceLabel {...props} />
                </li>
            ))}
        </ul>
    ),
}

/** The 03 example: a leaving voice that also needs re-selection, dated from the catalog. */
export const LeavingAndNeedsReselect: Story = {
    args: {
        stored: SELA,
        effective: own(SELA, ['leaving', 'needs_reselect'], ['needs_review']),
        badgeContext: { date: CATALOG_SELA_LEAVING.disable_at },
    },
}

/**
 * One projection per substitution reason, as the server sends it; Maren plays
 * instead of Eldrin (of the classic "Child girl" voice for `unmapped_legacy`).
 */
export const EverySubstitutionReason: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <ul className="flex flex-col gap-4">
            {REASONS.map((reason) => (
                <li key={reason} className="flex flex-col gap-1.5 border-b border-parchment-50/[.08] pb-3 last:border-b-0 last:pb-0">
                    <code className="font-mono text-caption text-fg-subtle">{reason}</code>
                    <EffectiveVoiceLabel stored={reason === 'unmapped_legacy' ? V1_VOICE : V2_VOICE} effective={serverProjection(reason)} />
                </li>
            ))}
        </ul>
    ),
}

/** No projection (a share-link reader): the label is the stored voice’s plain name. */
export const NoProjection: Story = {
    args: { stored: V1_VOICE, effective: null },
}

/** Nothing assigned: the translated default name every app caller gets (no caller passes `fallback`). */
export const NothingAssigned: Story = {
    args: { stored: null, effective: null },
}

/** Badges hidden by the caller; the "Plays as" line still names the voice heard. */
export const BadgesHidden: Story = {
    args: { showBadges: false },
}
