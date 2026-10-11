import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LlmPreferences, LlmProfileDetail } from '@/shared/types/llmProfile.types'
import { LlmProfilesConsoleView } from './LlmProfilesConsoleView'
import {
    appArchivedDetail, appPolicy, appStorytellerDetail, appStorytellerPublicDetail, appWriterDraftDetail, editorFor, newEditor,
    personalStorytellerDetail, rootConsole, userConsole,
} from './llmProfileFixtures'
import { stableJson } from './llmProfileModel'
import type { LlmProfilesConsole } from './useLlmProfilesConsole'

const rootDetails: Record<string, LlmProfileDetail> = Object.fromEntries([appStorytellerDetail, appWriterDraftDetail, appArchivedDetail]
    .map(detail => [detail.profile_id, detail]))
const userDetails: Record<string, LlmProfileDetail> = Object.fromEntries([personalStorytellerDetail, appStorytellerPublicDetail]
    .map(detail => [detail.profile_id, detail]))

/**
 * Wraps the page view with just enough local state to review it without a
 * backend: open / create / close the editor, edit the draft, copy an app
 * profile, change assignments and set the app default.
 */
function PageDemo({ state: initial, root }: { state: LlmProfilesConsole; root?: boolean }) {
    const [editor, setEditor] = useState(initial.editor)
    const [assignments, setAssignments] = useState<LlmPreferences | null>(initial.assignments)
    const [preferences, setPreferences] = useState(initial.preferences)
    const details = initial.systemAdmin ? rootDetails : userDetails
    const state: LlmProfilesConsole = {
        ...initial, editor, assignments, preferences,
        assignmentsDirty: Boolean(preferences && assignments && stableJson({ default_profile_id: preferences.default_profile_id,
            feature_profiles: preferences.feature_profiles }) !== stableJson(assignments)),
        actions: {
            ...initial.actions,
            open: profile => details[profile.profile_id] && setEditor(editorFor(details[profile.profile_id], initial.systemAdmin)),
            create: () => setEditor(newEditor(initial.systemAdmin)),
            closeEditor: () => setEditor(null),
            updateDraft: draft => setEditor(before => before && { ...before, draft, dirty: true, draftUnsaved: initial.systemAdmin && before.mode === 'edit' }),
            copyPersonal: () => setEditor(before => before && { ...before, mode: 'create', editing: null, dirty: true, compatibility: { status: 'checking', report: null },
                draft: { ...before.draft, config: { ...before.draft.config, platform_connection_key: null } } }),
            setAssignments,
            setAppDefault: profileId => {
                setPreferences(before => before && { ...before, default_profile_id: profileId })
                setAssignments(before => before && { ...before, default_profile_id: profileId })
            },
        },
    }
    return <LlmProfilesConsoleView state={state} onManageAppProfiles={root ? () => {} : undefined} />
}

const meta = {
    title: 'Profile/Models/Pages',
    component: PageDemo,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: { description: { component: 'Both LLM profile pages from fixtures, without login. Root ("LLM profiles"): profiles, the default for everyone, which profile each feature uses, and the collapsed catalog and activity. User ("Models and profiles"): personal and app profiles, their own assignments, the provider key and request usage. Cards, the editor and assignments respond locally; nothing is saved.' } },
    },
    argTypes: { state: { control: false } },
    args: { state: rootConsole() },
} satisfies Meta<typeof PageDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Root console with a published default, a draft and an archived profile. */
export const RootPage: Story = {}
/** No default yet: the banner offers to set one right there. */
export const RootWithoutDefault: Story = {
    args: { state: rootConsole({ preferences: { ...appPolicy, default_profile_id: null },
        assignments: { default_profile_id: null, feature_profiles: { ...appPolicy.feature_profiles } }, defaultGaps: [] }) },
}
/** Root editing the app default (opened from its card). */
export const RootEditor: Story = { args: { state: rootConsole({ editor: editorFor(appStorytellerDetail, true) }) } }
/** Root assignments the server refused. */
export const RootRefusedAssignments: Story = {
    args: { state: rootConsole({ assignmentIssues: { features: { card_generation: { code: 'PROFILE_INCOMPATIBLE', role: 'primary' } } },
        assignments: { default_profile_id: appPolicy.default_profile_id, feature_profiles: { ...appPolicy.feature_profiles, card_generation: appPolicy.default_profile_id! } } }) },
}
/** The user page. */
export const UserPage: Story = { args: { state: userConsole() } }
/** The user page for a root user, with the link to the app-profile console. */
export const UserPageAsRoot: Story = { args: { state: userConsole(), root: true } }
/** A user whose groups have no models: creating is disabled with the reason; app profiles still show. */
export const UserWithoutModels: Story = { args: { state: userConsole({ models: [], modelsTotal: 0, hasUsableModels: false }) } }
/** A user viewing an app profile read-only. */
export const UserViewingAppProfile: Story = { args: { state: userConsole({ editor: editorFor(appStorytellerPublicDetail, false) }) } }
/** First load. */
export const Loading: Story = {
    args: { state: userConsole({ loading: true, profiles: [], details: {}, preferences: null, assignments: null, capacityUsage: null }) },
}
