import { fireEvent, render, screen, waitFor,within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/app/hooks',()=>({useAuth:()=>({userHash:'drawer-author'})}))

import { apiService } from '@/infrastructure/api'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import type { CodexEntry } from '../../hooks/useCodex'
import { CodexEntryDrawer } from './CodexEntryDrawer'
import { CodexLorebookPickerDrawer } from './CodexLorebookPickerDrawer'
import { storyReference } from '@/test/fixtures/story'
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'

describe('Codex drawer recovery', () => {
    afterEach(() => vi.restoreAllMocks())

    it('keeps a failed snapshot edit open with its entered content and a visible error', async () => {
        const onClose = vi.fn()
        const entry = { id: 'entry', kind: 'character', label: 'Lyra', description: 'Old text', enabled: true, ref: { snapshot: {} } } as CodexEntry
        render(<CodexEntryDrawer entry={entry} busy={false} onClose={onClose} onSave={async () => { throw new Error('Unable to save this copy.') }} />)
        fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'New text' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save this copy.')
        expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('New text')
        expect(onClose).not.toHaveBeenCalled()
    })

    it('distinguishes a lorebook loading failure from an empty search', async () => {
        setTestFeatureFlags({ novels: true, lorebooks: true })
        vi.spyOn(apiService, 'getLorebooks').mockRejectedValue(new Error('Could not load your lorebooks.'))
        const workspace = createWorkspaceTestState({ api: apiService })
        render(
            <WorkspaceTestProvider state={workspace}>
                <CodexLorebookPickerDrawer open busy={false} existingEntryIds={new Set()} onClose={vi.fn()} onClone={async () => {}} />
            </WorkspaceTestProvider>,
        )
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your lorebooks.')
        expect(screen.queryByText('No matching lorebooks')).not.toBeInTheDocument()
    })

    it('recovers a closed snapshot form and explicitly rebases only its changed fields before saving',async()=>{
        localStorage.clear()
        const entry:CodexEntry={id:'reference-1',kind:'character',label:'Mira',description:'Original note',enabled:true,ref:storyReference(),contextRevision:2}
        const onSave=vi.fn().mockResolvedValue(undefined)
        const props={busy:false,onClose:vi.fn(),onSave,workspaceId:TEST_WORKSPACE_ID}
        const view=render(<CodexEntryDrawer {...props} entry={entry}/>)
        fireEvent.change(screen.getByRole('textbox',{name:'Description'}),{target:{value:'My private revision'}})
        view.rerender(<CodexEntryDrawer {...props} entry={null}/>)
        const account={...entry,label:'Renamed elsewhere',contextRevision:4}
        view.rerender(<CodexEntryDrawer {...props} entry={account}/>)
        expect(screen.getByText(/Unsent private snapshot edits/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button',{name:'Resume device draft'}))
        expect(screen.getByRole('textbox',{name:'Description'})).toHaveValue('My private revision')
        fireEvent.click(screen.getByRole('button',{name:'Compare versions'}))
        const compare=await screen.findByRole('dialog',{name:'Compare versions'})
        expect(within(compare).getByText('Renamed elsewhere')).toBeInTheDocument()
        fireEvent.click(within(compare).getByRole('button',{name:'Keep my changed fields'}))
        expect(screen.getByRole('textbox',{name:'Name'})).toHaveValue('Renamed elsewhere')
        fireEvent.click(screen.getByRole('button',{name:'Save'}))
        await waitFor(()=>expect(onSave).toHaveBeenCalledWith(expect.objectContaining({contextRevision:4}),{label:'Renamed elsewhere',description:'My private revision'}))
    })

    it("lists the story's workspace and closes on a committed workspace switch", async () => {
        setTestFeatureFlags({ novels: true, lorebooks: true })
        const getLorebooks = vi.spyOn(apiService, 'getLorebooks').mockResolvedValue([
            { id: 'lb-1', name: 'Twin Courts', description: null, entries: [] },
        ])
        const workspace = createWorkspaceTestState({ api: apiService })
        const onClose = vi.fn()
        const drawer = (
            <CodexLorebookPickerDrawer open workspaceId={TEST_WORKSPACE_ID} busy={false} existingEntryIds={new Set()} onClose={onClose} onClone={async () => {}} />
        )
        const { rerender } = render(<WorkspaceTestProvider state={workspace}>{drawer}</WorkspaceTestProvider>)

        expect(await screen.findByTestId('codex-lorebook-option')).toHaveTextContent('Twin Courts')
        const client = getLorebooks.mock.contexts[0] as { workspaceScope: { workspaceId: string } | null }
        expect(client.workspaceScope?.workspaceId).toBe(TEST_WORKSPACE_ID)

        workspace.switchTo(OTHER_WORKSPACE_ID)
        rerender(<WorkspaceTestProvider state={workspace}>{drawer}</WorkspaceTestProvider>)

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
        expect(screen.queryByTestId('codex-lorebook-option')).not.toBeInTheDocument()
    })
})
