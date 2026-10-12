import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ImageProfileMutation } from '@/shared/types/imageProfile.types'
import { ImageProfileEditor, type ImageProfileEditorProps } from './ImageProfileEditor'
import { gptDraft, imageCatalog, newSystemDraft, personalDraft } from './imageProfileFixtures'
import { withModel } from './imageProfileModel'

/** Keeps the draft in local state so every field can be tried without a backend. */
function EditorDemo(props: ImageProfileEditorProps) {
    const [draft, setDraft] = useState<ImageProfileMutation>(props.draft)
    const [propsKey, setPropsKey] = useState(props.propsKey)
    const [propsValid, setPropsValid] = useState(true)
    return <ImageProfileEditor {...props} draft={draft} propsKey={propsKey} propsValid={propsValid}
        onChange={patch => setDraft(before => ({ ...before, ...patch }))} onPropsValidity={setPropsValid}
        onChooseModel={model => { setDraft(before => withModel(before, model)); setPropsKey(key => key + 1) }} />
}

const meta = {
    title: 'Profile/Images/Profile editor',
    component: ImageProfileEditor,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: { description: { component: 'The image profile drawer: provider and catalog model, the model’s own settings (left on their defaults unless changed), the price for app profiles and custom provider fields that may not shadow a setting or a field the app sets.' } },
    },
    render: args => <EditorDemo {...args} />,
    argTypes: { catalog: { control: false }, draft: { control: false }, onSave: { action: 'save' }, onArchive: { action: 'archive' },
        onClose: { action: 'close' }, onChange: { control: false }, onChooseModel: { control: false }, onPropsValidity: { control: false } },
    args: {
        open: true, mode: 'create', systemAdmin: true, catalog: imageCatalog, draft: newSystemDraft, propsKey: 0, propsValid: true,
        busy: false, error: null, onChange: () => {}, onChooseModel: () => {}, onPropsValidity: () => {}, onSave: () => {}, onClose: () => {},
    },
} satisfies Meta<typeof ImageProfileEditor>

export default meta
type Story = StoryObj<typeof meta>

/** Root creates an app profile: the first catalog model, 1 credit per image. */
export const CreateAppProfile: Story = {}
/** Root edits a GPT Image profile with quality raised to medium. */
export const EditAppProfile: Story = { args: { mode: 'edit', draft: gptDraft, onArchive: () => {} } }
/** A user edits a personal profile on their own fal key: no price field. */
export const PersonalProfile: Story = { args: { mode: 'edit', systemAdmin: false, draft: personalDraft, onArchive: () => {} } }
/** A server error (e.g. an invalid setting) sits above the form. */
export const WithError: Story = { args: { mode: 'edit', draft: gptDraft, error: 'A setting or custom field is not valid for this model. quality: must be one of auto, low, medium, high, xhigh, max.' } }
