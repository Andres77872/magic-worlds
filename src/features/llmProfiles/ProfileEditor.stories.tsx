import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LlmProfileMutation } from '@/shared/types/llmProfile.types'
import type { LlmFeature } from '@/shared/types/llm.types'
import { ProfileEditor } from './ProfileEditor'
import {
    appStorytellerDetail, appStorytellerPublicDetail, appWriterDraftDetail, catalogModels, editorFor, fixtureConnections, newEditor,
    personalStorytellerDetail,
} from './llmProfileFixtures'
import { configKey, roleFor } from './llmProfileModel'

const base = editorFor(appStorytellerDetail, true)

const meta = {
    title: 'Profile/Models/Profile editor',
    component: ProfileEditor,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: { description: { component: 'Drawer for one profile: basics, response model, separate models for roleplay and voice call, advanced settings, custom provider props, server compatibility, test, history and the danger zone. The footer states where the profile stands. Arcane marks app profiles, ember personal ones; the view mode is a read-only summary with "Copy as personal profile".' } },
    },
    argTypes: {
        draft: { control: false }, editing: { control: false }, models: { control: false }, connections: { control: false },
        testFeatures: { control: false }, compatibility: { control: false }, testResult: { control: false },
        mode: { control: 'inline-radio', options: ['create', 'edit', 'view'] },
    },
    args: {
        open: true, mode: base.mode, systemAdmin: true, draft: base.draft, editing: base.editing, models: catalogModels,
        modelsTotal: catalogModels.length, connections: fixtureConnections, testFeatures: base.testFeatures, testFeature: 'chat_adventure',
        compatibility: base.compatibility, dirty: false, draftUnsaved: false, propsKey: 0, propsInvalid: false, busy: false, testResult: null,
        onChange: () => {}, onChooseModel: () => {}, onPropsValidity: () => {}, onTestFeatureChange: () => {}, onSave: () => {},
        onPublish: () => {}, onValidate: () => {}, onTest: () => {}, onArchive: () => {}, onRollback: () => {}, onLoadMoreModels: () => {},
        onCopyPersonal: () => {}, onClose: () => {},
    },
    // Local draft state so fields, model pickers and the props editor respond while reviewing.
    render: function Stateful(args) {
        const [draft, setDraft] = useState<LlmProfileMutation>(args.draft)
        const [feature, setFeature] = useState<LlmFeature | undefined>(args.testFeature)
        const [invalid, setInvalid] = useState(false)
        const saved = args.editing ? args.systemAdmin ? args.editing.draft_config : args.editing.current?.config : undefined
        const dirty = args.dirty || invalid || !args.editing || draft.name !== args.editing.name || configKey(draft.config) !== configKey(saved)
        const chooseModel = (role: 'primary' | 'metadata' | 'preflight', id: string) => {
            const model = catalogModels.find(item => item.catalog_model_key === id)
            const roles = { ...draft.config.roles }
            if (model) roles[role] = roleFor(model); else if (role !== 'primary') delete roles[role]
            setDraft({ ...draft, config: { ...draft.config, roles } })
        }
        return <ProfileEditor {...args} draft={draft} onChange={setDraft} onChooseModel={chooseModel} dirty={dirty}
            draftUnsaved={args.systemAdmin && dirty && args.mode === 'edit'} propsInvalid={invalid} onPropsValidity={valid => setInvalid(!valid)}
            testFeature={feature} onTestFeatureChange={setFeature} />
    },
} satisfies Meta<typeof ProfileEditor>

export default meta
type Story = StoryObj<typeof meta>

/** Root editing a published app profile whose saved draft is ahead of the live version. */
export const EditAppProfile: Story = {}

const draftOnly = editorFor(appWriterDraftDetail, true)
/** Root editing a draft that was never published. */
export const EditAppDraft: Story = { args: { draft: draftOnly.draft, editing: draftOnly.editing } }

const created = newEditor(true)
/** Root creating a new app profile. */
export const CreateAppProfile: Story = { args: { mode: 'create', draft: created.draft, editing: null, compatibility: created.compatibility } }

const personal = editorFor(personalStorytellerDetail, false)
/** A user editing a personal profile (their own key): no publishing, history or platform connection. */
export const EditPersonalProfile: Story = {
    args: { systemAdmin: false, draft: personal.draft, editing: personal.editing, testFeatures: personal.testFeatures, connections: [] },
}

const readOnly = editorFor(appStorytellerPublicDetail, false)
/** A user viewing an app profile: read-only summary with "Copy as personal profile". */
export const ViewAppProfile: Story = {
    args: { mode: 'view', systemAdmin: false, draft: readOnly.draft, editing: readOnly.editing, compatibility: null, connections: [] },
}

/** A user with no models in their groups. */
export const NoModelsForUser: Story = {
    args: { mode: 'create', systemAdmin: false, models: [], modelsTotal: 0, editing: null, connections: [],
        draft: { ...created.draft, config: { ...created.draft.config, platform_connection_key: null } },
        noModelsMessage: 'Your account has no models available yet. An administrator must add models to a group your account belongs to.' },
}

/** A server error after saving, with the custom provider props it points at. */
export const SaveRejected: Story = {
    args: { error: 'The server rejected this request. Check the fields and the custom provider props.',
        propsServerError: 'The server rejected this configuration. Check the custom provider props for reserved fields or unsupported values.' },
}

/** The test panel after a passing draft test (open it with Test in the footer to see the controls). */
export const TestResult: Story = {
    args: { testResult: { execution_id: 'fixture-execution', profile_id: appStorytellerDetail.profile_id, revision_id: 'fixture-draft-revision',
        payer_mode: 'platform', feature: 'chat_adventure', roles: ['primary', 'preflight', 'metadata'], target: 'draft', replayed: false,
        output: 'The lantern gutters as the door creaks open.' } },
}
