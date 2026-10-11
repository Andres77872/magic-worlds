import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LlmPreferences } from '@/shared/types/llmProfile.types'
import { AssignmentsTable } from './AssignmentsTable'
import { appPolicy, appStoryteller, featureContracts, personalStoryteller, userPreferences } from './llmProfileFixtures'
import { stableJson } from './llmProfileModel'

const appChoices = [appStoryteller]
const userChoices = [personalStoryteller, appStoryteller]

const meta = {
    title: 'Profile/Models/Assignments',
    component: AssignmentsTable,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: '"Which profile each feature uses": a default row, then features grouped by what they do. Arcane badges mark features that also use the preflight and metadata models. Server refusals show inline on their row (blood); a feature the default cannot serve gets an amber warning that does not block saving.' } },
    },
    argTypes: { features: { control: false }, profiles: { control: false }, value: { control: false }, issues: { control: false },
        onChange: { control: false }, onSave: { action: 'save' }, scope: { control: 'inline-radio', options: ['app', 'personal'] } },
    args: {
        scope: 'app', features: featureContracts, profiles: appChoices, value: appPolicy, defaultGaps: ['image_prompt'],
        onChange: () => {}, onSave: () => {},
    },
    render: function Stateful(args) {
        const [value, setValue] = useState<LlmPreferences>(args.value)
        return <AssignmentsTable {...args} value={value} onChange={setValue} dirty={stableJson(value) !== stableJson(args.value)} />
    },
} satisfies Meta<typeof AssignmentsTable>

export default meta
type Story = StoryObj<typeof meta>

/** Root policy: the app default plus the roleplay chats on the same profile; the default cannot serve image prompts. */
export const AppPolicy: Story = {}
/** A user's own choices, limited to the features users may pick. */
export const Personal: Story = {
    args: { scope: 'personal', profiles: userChoices, value: userPreferences, defaultGaps: [],
        features: featureContracts.filter(feature => feature.user_selection_enabled),
        note: 'Image and music writers and voice use application profiles. Their media charges are separate.' },
}
/** The server refused the save: no default, and a per-feature profile that lacks a capability. */
export const RefusedByServer: Story = {
    args: { value: { default_profile_id: null, feature_profiles: { card_generation: appStoryteller.profile_id } }, defaultGaps: [],
        issues: { default: { code: 'SYSTEM_DEFAULT_REQUIRED', role: null }, features: { card_generation: { code: 'PROFILE_INCOMPATIBLE', role: 'primary' } } } },
}
