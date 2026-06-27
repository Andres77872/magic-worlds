import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileSharingSection } from './ProfileSharingSection'
import type { ProfileSharedCardsState } from '../hooks/useProfileSharedCards'

const base: ProfileSharedCardsState = {
    publicCards: [],
    shareLinks: [],
    isLoading: false,
    error: null,
    refresh: () => {},
}

const meta = {
    title: 'Features/Profile/ProfileSharingSection',
    component: ProfileSharingSection,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Sharing manager for the profile Sharing tab: a Chip sub-toggle between public cards and unlisted share links, with copy/revoke or unpublish actions per row and toast feedback. Loading, error and empty states are handled inline.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[820px] max-w-full"><Story /></div>],
    argTypes: { sharing: { control: false } },
    args: { sharing: base },
} satisfies Meta<typeof ProfileSharingSection>

export default meta
type Story = StoryObj<typeof meta>

/** No public cards or links yet — the empty copy for the active sub-toggle. */
export const Empty: Story = {}

/** Fetching the shared-card lists. */
export const Loading: Story = { args: { sharing: { ...base, isLoading: true } } }

/** The fetch failed — a message plus a retry. */
export const ErrorState: Story = { args: { sharing: { ...base, error: 'Could not load your shared cards.' } } }
