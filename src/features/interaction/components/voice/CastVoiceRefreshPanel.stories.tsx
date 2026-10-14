import { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApiError } from '@/infrastructure/api'
import { useVoiceRefresh } from '../../hooks/useVoiceRefresh'
import { CastVoiceMenu } from './CastVoiceMenu'
import { CastVoiceRefreshPanel } from './CastVoiceRefreshPanel'
import type { CastVoiceDrift } from './sessionVoiceDrift'
import type { CastVoiceRefresh } from './useCastVoiceRefresh'

const AFFECTED: CastVoiceDrift[] = [
    { cardId: 'c1', name: 'Lyra Dawnwhisper', replaced: true, differs: true, sessionName: 'Maren', cardName: 'Eldrin' },
    { cardId: 'c2', name: 'Mirren Vale', replaced: false, differs: true, sessionName: 'Sela', cardName: 'Theo' },
]

interface CastVoiceDemoProps {
    affected: CastVoiceDrift[]
    /** What the refresh answers: success, or the 409 sent while a reply streams. */
    outcome: 'success' | 'busy'
    /** `panel`: the side panel's cast block; `bar`: the strip under the adventure top bar (below xl). */
    variant: 'panel' | 'bar'
}

/** The adventure cast block as the left panel mounts it: the multi-select, then each member's cast menu. */
function CastVoiceDemo({ affected, outcome, variant }: CastVoiceDemoProps) {
    const refresh = useVoiceRefresh()
    const statusRef = useRef<HTMLSpanElement>(null)
    const cast: CastVoiceRefresh = {
        affected,
        byCard: new Map(affected.map((drift) => [drift.cardId, drift] as const)),
        refresh,
        statusRef,
        run: () => {
            statusRef.current?.focus()
            void refresh.run(async () => {
                await new Promise((resolve) => setTimeout(resolve, 600))
                if (outcome === 'busy') throw new ApiError(409, 'busy', { code: 'voice_refresh_busy' })
            })
        },
    }
    if (variant === 'bar') {
        return (
            <div className="w-full max-w-md">
                <CastVoiceRefreshPanel cast={cast} variant="bar" label="Cast voices" />
            </div>
        )
    }
    return (
        <div className="flex w-80 flex-col gap-2.5">
            <CastVoiceRefreshPanel cast={cast} />
            {affected.map((drift) => (
                <div key={drift.cardId} className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-ui text-sm text-parchment-100">{drift.name}</span>
                    <CastVoiceMenu drift={drift} cast={cast} />
                </div>
            ))}
        </div>
    )
}

const meta = {
    title: 'Interaction/CastVoiceRefresh',
    component: CastVoiceDemo,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'D36 in an adventure (R1): cast members whose voice differs from their card’s current voice. The summary opens the affected cast as checkboxes, pre-selected where a substitution is active, and each member gets a cast menu with “Use the card’s current voice”. Below xl the same block also sits as a strip under the adventure top bar (`bar`). Shown only when a cast member drifts; otherwise the cast list looks as before.',
            },
        },
    },
    args: { affected: AFFECTED, outcome: 'success', variant: 'panel' },
    argTypes: {
        affected: { control: false },
        outcome: { control: 'inline-radio', options: ['success', 'busy'] },
        variant: { control: 'inline-radio', options: ['panel', 'bar'] },
    },
} satisfies Meta<typeof CastVoiceDemo>

export default meta
type Story = StoryObj<typeof meta>

export const TwoMembers: Story = {}

export const OneReplaced: Story = {
    args: { affected: [AFFECTED[0]] },
}

export const BusyConflict: Story = {
    args: { outcome: 'busy' },
}

export const HeaderStrip: Story = {
    args: { variant: 'bar' },
}
