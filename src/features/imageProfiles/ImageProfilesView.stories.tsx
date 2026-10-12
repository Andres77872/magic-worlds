import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ImageProfileList } from '@/shared/types/imageProfile.types'
import { ImageProfilesView } from './ImageProfilesView'
import { emptyRootConsole, rootConsole, userConsole } from './imageProfileFixtures'
import { draftFrom, emptyDraft, withModel } from './imageProfileModel'
import type { ImageProfilesConsole } from './useImageProfilesConsole'

/** Just enough local state to open the editor, confirm an archive and move the defaults. */
function PageDemo({ state: initial, root }: { state: ImageProfilesConsole; root?: boolean }) {
    const [editor, setEditor] = useState(initial.editor)
    const [confirm, setConfirm] = useState(initial.confirm)
    const [list, setList] = useState<ImageProfileList | null>(initial.list)
    const state: ImageProfilesConsole = {
        ...initial, editor, confirm, list,
        actions: {
            ...initial.actions,
            openCreate: () => setEditor({ mode: 'create', profile: null, draft: emptyDraft(initial.catalog, initial.systemAdmin), propsKey: 1, propsValid: true }),
            openEdit: profile => setEditor({ mode: 'edit', profile, draft: draftFrom(profile, initial.systemAdmin), propsKey: 1, propsValid: true }),
            closeEditor: () => setEditor(null),
            updateDraft: patch => setEditor(before => before && { ...before, draft: { ...before.draft, ...patch } }),
            chooseModel: model => setEditor(before => before && { ...before, draft: withModel(before.draft, model), propsKey: before.propsKey + 1 }),
            requestArchive: setConfirm,
            cancelArchive: () => setConfirm(null),
            confirmArchive: () => setConfirm(null),
            setGlobalDefault: profileId => setList(before => before && { ...before, system_default_profile_id: profileId }),
            setUserDefault: profileId => setList(before => before && { ...before, user_default_profile_id: profileId,
                effective_default_profile_id: profileId ?? before.system_default_profile_id }),
        },
    }
    return <ImageProfilesView state={state} onManageAppProfiles={root ? () => {} : undefined} />
}

const meta = {
    title: 'Profile/Images/Pages',
    component: PageDemo,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: { description: { component: 'Both image profile pages. Root manages the app profiles, their prices and the global default; every user picks a default image model and may keep personal profiles on their own fal.ai or OpenRouter key.' } },
    },
    args: { state: rootConsole },
    argTypes: { state: { control: false } },
} satisfies Meta<typeof PageDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Root console: global default, the missing OpenRouter key and every profile, archived last. */
export const RootConsole: Story = {}
/** A fresh server: no profile and no default yet. */
export const RootEmpty: Story = { args: { state: emptyRootConsole } }
/** The user page with a personal default, as root sees it (link to the root console). */
export const UserPage: Story = { args: { state: userConsole, root: true } }
/** The user page with a fal key entered in this tab. */
export const UserWithKey: Story = { args: { state: { ...userConsole, heldKeys: ['fal'] } } }
/** A failed load. */
export const LoadFailed: Story = { args: { state: { ...userConsole, list: null, error: 'The operation could not be completed.' } } }
