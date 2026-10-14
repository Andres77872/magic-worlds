import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { OTHER_WORKSPACE_ID } from '@/shared/hooks/testing/workspaceTestUtils'
import { REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET } from '../fixtures'
import { VoiceStoryProviders } from '../storybook/VoiceStoryProviders'
import { ReviewFlagList } from './ReviewFlagList'
import { ReviewNotice } from './ReviewNotice'

const meta = {
    title: 'Voices/ReviewNotice',
    component: ReviewNotice,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'One review flag (R1): a voice changed when it moved to the new voices, and the owner should listen again. Shows one line per known change, the record’s workspace when it is not the selected one, "Adjust" (opens the record, or calls `onAdjust` when the host already shows it) and "Dismiss". It is a region named by its heading, and Dismiss names the notice it dismisses (05 §10); after a dismissal the focus moves to the next notice or a heading.',
            },
        },
    },
    decorators: [
        (Story) => (
            <VoiceStoryProviders>
                <div className="max-w-xl">
                    <Story />
                </div>
            </VoiceStoryProviders>
        ),
    ],
    argTypes: {
        flag: { control: 'object' },
        title: { control: 'text' },
        name: { control: 'text' },
        readOnly: { control: 'boolean' },
        headingLevel: { control: 'inline-radio', options: [2, 3, 4] },
        dismissFocusTarget: { control: false },
        onDismiss: { control: false },
        onAdjust: { control: false },
        className: { control: false },
    },
    args: {
        flag: REVIEW_FLAG_CARD,
        onDismiss: fn(),
    },
} satisfies Meta<typeof ReviewNotice>

export default meta
type Story = StoryObj<typeof meta>

/** A character card whose pitch and volume could not carry over. "Adjust" would open its editor. */
export const CharacterCard: Story = {}

/** In the character editor itself: "Adjust" opens the voice picker in place. */
export const InTheEditor: Story = {
    args: { onAdjust: fn(), name: 'Lyra' },
}

/** The editor of a card in an archived workspace: no "Adjust", but Listen and Dismiss still work (05 §7.9). */
export const ArchivedEditor: Story = {
    args: { onAdjust: fn(), name: 'Lyra', readOnly: true },
}

/** A preset whose speed was clamped to the new range. "Adjust" would open the Voice studio on it. */
export const Preset: Story = {
    args: { flag: REVIEW_FLAG_PRESET, title: 'My pirate' },
}

/** A record from another workspace names that workspace. */
export const OtherWorkspace: Story = {
    args: {
        title: 'Captain Vey',
        flag: { ...REVIEW_FLAG_CARD, flag_id: 13, flags: ['needs_review'], organization: { workspace_id: OTHER_WORKSPACE_ID } },
    },
}

/**
 * The Voice studio's account list (`ReviewFlagList`): each notice is named after its record, from the host's
 * preset rows or the loaded library, else its kind, numbered when a name repeats, so every region and every
 * Listen and Dismiss name is distinct (05 §10).
 */
export const AccountList: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <ReviewFlagList
            flags={[
                REVIEW_FLAG_PRESET,
                { ...REVIEW_FLAG_PRESET, flag_id: 21, ref_id: 'user-2' },
                REVIEW_FLAG_CARD,
                { ...REVIEW_FLAG_CARD, flag_id: 22, ref_id: 'card-2', flags: ['needs_review'] },
            ]}
            onDismiss={fn()}
            nameFor={(flag) => (flag.ref_type === 'preset' ? ({ 'user-1': 'My pirate', 'user-2': 'Gruff mentor' } as Record<string, string>)[flag.ref_id] ?? null : null)}
        />
    ),
}
