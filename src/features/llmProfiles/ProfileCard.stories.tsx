import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProfileCard } from './ProfileCard'
import {
    appArchived, appArchivedDetail, appPolicy, appStoryteller, appStorytellerDetail, appStorytellerPublicDetail, appWriterDraft,
    appWriterDraftDetail, catalogModels, personalStoryteller, personalStorytellerDetail, userPreferences,
} from './llmProfileFixtures'
import { profileUsage } from './llmProfileModel'

const meta = {
    title: 'Profile/Models/Profile card',
    component: ProfileCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'One LLM profile at a glance: response model and provider, status (draft or published version), custom provider props and where it is used. Arcane marks app profiles (platform key); ember marks personal profiles and the app default.' } },
    },
    decorators: [Story => <div className="max-w-sm"><Story /></div>],
    argTypes: { profile: { control: false }, detail: { control: false }, models: { control: false }, usage: { control: false },
        onOpen: { action: 'open' }, onSetDefault: { action: 'set default' } },
    args: {
        profile: appStoryteller, detail: appStorytellerDetail, models: catalogModels, usage: profileUsage(appStoryteller.profile_id, appPolicy),
        systemAdmin: true, isAppDefault: true, onOpen: () => {}, onSetDefault: () => {},
    },
} satisfies Meta<typeof ProfileCard>

export default meta
type Story = StoryObj<typeof meta>

/** Root view of the published app default, with unpublished draft changes and custom props. */
export const AppDefault: Story = {}
/** Root view of a draft that was never published: no "Set as default" yet. */
export const AppDraft: Story = { args: { profile: appWriterDraft, detail: appWriterDraftDetail, isAppDefault: false,
    usage: profileUsage(appWriterDraft.profile_id, appPolicy) } }
/** Archived profiles sink to the end of the list, dimmed. */
export const Archived: Story = { args: { profile: appArchived, detail: appArchivedDetail, isAppDefault: false, usage: { isDefault: false, features: [] } } }
/** The user page: an app profile is read-only (View profile). */
export const AppProfileForUser: Story = { args: { systemAdmin: false, isAppDefault: false, onSetDefault: undefined,
    detail: appStorytellerPublicDetail, usage: profileUsage(appStoryteller.profile_id, userPreferences) } }
/** The user page: a personal profile on the user's own key. */
export const Personal: Story = { args: { systemAdmin: false, isAppDefault: false, onSetDefault: undefined, profile: personalStoryteller,
    detail: personalStorytellerDetail, usage: profileUsage(personalStoryteller.profile_id, userPreferences) } }
/** While its detail loads the model line says so. */
export const Loading: Story = { args: { detail: undefined } }
