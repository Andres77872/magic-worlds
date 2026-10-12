import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { i18n } from '@/app/i18n'
import type { LorebookResource } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    type WorkspaceTestState,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { LOREBOOK_RESOURCE_MAX_CHARS, LOREBOOK_RESOURCE_MAX_RESOURCES, LOREBOOK_RESOURCE_MAX_TRIGGERS, newLorebookResource } from '../lorebookResources'
import { LorebookResourcePanel } from './LorebookResourcePanel'
import { ApiError, apiService } from '@/infrastructure/api'

let workspace: WorkspaceTestState
/** The workspace (`X-Workspace-Id`) of each call: spies on the singleton see the scoped client as `this`. */
const workspacesOf = (mock: MockInstance) => mock.mock.contexts.map((client) => (client as typeof apiService).workspaceScope?.workspaceId ?? null)

function completedResource(overrides: Partial<LorebookResource> = {}): LorebookResource {
    return {
        id: 'resource-completed',
        title: 'Glass archive',
        description: 'Court source notes.',
        triggers: ['glass archive'],
        fileName: 'glass-archive.md',
        fileType: 'md',
        content: 'Names spoken under glass are binding.',
        contentLength: 37,
        extractionStatus: 'completed',
        extraction: {
            keywords: ['mirror court'],
            shortSummary: 'The archive explains binding court oaths.',
            longSummary: 'The glass archive explains how oaths bind names under court law.',
            notes: [],
            snippets: [
                {
                    id: 'snippet-1',
                    title: 'Mirror oath',
                    content: 'The mirror oath binds names.',
                    triggers: ['mirror oath'],
                    source: 'glass-archive.md#oaths',
                },
            ],
        },
        ...overrides,
    }
}

function Harness({
    initial = [],
    saving = false,
    pendingExtractionCount = 0,
    extractMetadataOnSave = false,
    workspaceId,
}: { initial?: LorebookResource[]; saving?: boolean; pendingExtractionCount?: number; extractMetadataOnSave?: boolean; workspaceId?: string | null }) {
    const [resources, setResources] = useState(initial)
    return (
        <WorkspaceTestProvider state={workspace}>
            <LorebookResourcePanel
                workspaceId={workspaceId}
                resources={resources}
                onChange={setResources}
                saving={saving}
                pendingExtractionCount={pendingExtractionCount}
                extractMetadataOnSave={extractMetadataOnSave}
            />
        </WorkspaceTestProvider>
    )
}

function LinkedHarness({ initial = [], linked = [completedResource({ id: 'shared-resource', title: 'Shared atlas' })], onDetach = vi.fn() }: {
    initial?: LorebookResource[]
    linked?: LorebookResource[]
    onDetach?: (resource: LorebookResource) => void
}) {
    const [resources, setResources] = useState(initial)
    return (
        <WorkspaceTestProvider state={workspace}>
            <LorebookResourcePanel
                resources={resources}
                linkedResources={linked}
                onChange={setResources}
                onDetachResource={onDetach}
            />
        </WorkspaceTestProvider>
    )
}

describe('LorebookResourcePanel', () => {
    beforeEach(async () => {
        vi.restoreAllMocks()
        await i18n.changeLanguage('en')
        workspace = createWorkspaceTestState({ api: apiService.withWorkspace(TEST_WORKSPACE_ID) })
    })

    it('keeps resources readable but unchangeable while read-only', () => {
        const onChange = vi.fn()
        const onDetach = vi.fn()
        render(
            <WorkspaceTestProvider state={workspace}>
                <LorebookResourcePanel
                    resources={[completedResource()]}
                    linkedResources={[completedResource({ id: 'shared-resource', title: 'Shared atlas' })]}
                    onChange={onChange}
                    onDetachResource={onDetach}
                    onExtractMetadataOnSaveChange={vi.fn()}
                    readOnly
                />
            </WorkspaceTestProvider>,
        )

        for (const name of ['New text', 'New Markdown', 'Upload source', 'Edit', 'Remove Glass archive', 'Detach Shared atlas']) {
            expect(screen.getByRole('button', { name })).toBeDisabled()
        }
        expect(screen.getByRole('switch', { name: 'Sync AI metadata on save' })).toBeDisabled()
        expect(screen.getByTestId('lorebook-resource-upload')).toBeDisabled()

        // Expanding a resource to read its source still works; its fields stay locked.
        fireEvent.click(screen.getByRole('button', { name: 'Expand Glass archive' }))
        expect(screen.getByTestId('lorebook-resource-content')).toHaveValue('Names spoken under glass are binding.')
        expect(screen.getByTestId('lorebook-resource-content')).toBeDisabled()

        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), {
            target: { files: [new File(['Mirror court notes'], 'court.md', { type: 'text/markdown' })] },
        })
        expect(screen.getByRole('alert')).toHaveTextContent('This workspace is archived. Restore it to create or edit content.')
        expect(onChange).not.toHaveBeenCalled()
        expect(onDetach).not.toHaveBeenCalled()
    })

    it('creates a manual text resource', async () => {
        render(<Harness />)

        fireEvent.click(screen.getByTestId('lorebook-resource-new-txt'))

        expect(await screen.findByText('resource.txt')).toBeInTheDocument()
        expect(screen.getByTestId('lorebook-resource-content')).toBeInTheDocument()
    })

    it('uploads Markdown and text files as resources', async () => {
        render(<Harness />)

        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), {
            target: { files: [new File(['Mirror court notes'], 'court.md', { type: 'text/markdown' })] },
        })

        expect(await screen.findByText('court.md')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Mirror court notes')).toBeInTheDocument()
    })

    it('rejects unsupported files and oversized resources', async () => {
        render(<Harness />)

        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), {
            target: { files: [new File(['bad'], 'archive.docx')] },
        })

        expect(await screen.findByRole('alert')).toHaveTextContent('archive.docx must be a .md, .txt, or .pdf file.')

        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), {
            target: { files: [new File(['x'.repeat(LOREBOOK_RESOURCE_MAX_CHARS + 1)], 'large.txt', { type: 'text/plain' })] },
        })

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(`large.txt is over ${LOREBOOK_RESOURCE_MAX_CHARS} characters.`))
    })

    it('imports PDFs as unsaved editable Markdown and blocks actions while converting', async () => {
        let finish!: (value: LorebookResource) => void
        const importPdf = vi.spyOn(apiService, 'importLorebookResourcePdf').mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        render(<Harness />)
        const file = new File(['%PDF-binary'], 'court.pdf', { type: 'application/pdf' })
        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), { target: { files: [file] } })
        expect(screen.getByTestId('lorebook-resource-upload')).toBeDisabled()
        expect(screen.getByTestId('lorebook-resource-new-txt')).toBeDisabled()
        expect(screen.getByRole('status')).toHaveTextContent('Importing files')
        const imported = newLorebookResource('court.md', '# Court facts')
        imported.title = 'court.pdf'
        finish(imported)
        expect(await screen.findByDisplayValue('# Court facts')).toBeInTheDocument()
        expect(screen.getByTestId('lorebook-resource-upload')).toBeEnabled()
        expect(importPdf).toHaveBeenCalledWith(file)
        expect(workspacesOf(importPdf)).toEqual([TEST_WORKSPACE_ID])
    })

    it('converts PDFs in the open book workspace', async () => {
        const importPdf = vi.spyOn(apiService, 'importLorebookResourcePdf').mockResolvedValueOnce(newLorebookResource('court.md', '# Court facts'))
        render(<Harness workspaceId={OTHER_WORKSPACE_ID} />)
        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), { target: { files: [new File(['%PDF-binary'], 'court.pdf')] } })
        expect(await screen.findByDisplayValue('# Court facts')).toBeInTheDocument()
        expect(workspacesOf(importPdf)).toEqual([OTHER_WORKSPACE_ID])
    })

    it('keeps a conversion that finishes after a workspace switch out of the editor', async () => {
        let finish!: (value: LorebookResource) => void
        vi.spyOn(apiService, 'importLorebookResourcePdf').mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
        const { rerender } = render(<Harness />)
        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), { target: { files: [new File(['%PDF-binary'], 'court.pdf')] } })
        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        rerender(<Harness />)
        await act(async () => finish(newLorebookResource('court.md', '# Court facts')))
        expect(screen.queryByDisplayValue('# Court facts')).not.toBeInTheDocument()
    })

    it('shows a localized PDF error and retains other successful imports', async () => {
        vi.spyOn(apiService, 'importLorebookResourcePdf').mockRejectedValueOnce(new ApiError(422, 'OCR required', { code: 'RESOURCE_PDF_OCR_REQUIRED' }))
        render(<Harness />)
        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), {
            target: { files: [new File(['Court notes'], 'court.txt'), new File(['%PDF-binary'], 'scan.pdf')] },
        })
        expect(await screen.findByRole('alert')).toHaveTextContent('pages without selectable text')
        expect(await screen.findByDisplayValue('Court notes')).toBeInTheDocument()
        expect(screen.getByTestId('lorebook-resource-upload')).toBeEnabled()
    })

    it('enforces the resource cap locally', () => {
        const resources = Array.from({ length: LOREBOOK_RESOURCE_MAX_RESOURCES }, (_, index) => newLorebookResource(`resource-${index}.txt`, 'notes'))
        render(<Harness initial={resources} />)

        expect(screen.getByTestId('lorebook-resource-new-txt')).toBeDisabled()
        expect(screen.getByTestId('lorebook-resource-upload')).toBeDisabled()
    })

    it('counts linked shared resources toward the local resource cap', () => {
        const linked = Array.from({ length: LOREBOOK_RESOURCE_MAX_RESOURCES }, (_, index) => completedResource({ id: `shared-${index}`, title: `Shared ${index}` }))
        render(<LinkedHarness linked={linked} />)

        expect(screen.getByTestId('lorebook-resource-new-txt')).toBeDisabled()
        expect(screen.getByTestId('lorebook-resource-upload')).toBeDisabled()
    })

    it('renders linked shared resources as detachable read-only cards', () => {
        const onDetach = vi.fn()
        const shared = completedResource({ id: 'shared-resource', title: 'Shared atlas' })
        render(<LinkedHarness linked={[shared]} onDetach={onDetach} />)

        expect(screen.getByText('1 shared resource')).toBeInTheDocument()
        expect(screen.getByText('Shared atlas')).toBeInTheDocument()
        expect(screen.getByText('shared')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Detach Shared atlas' }))

        expect(onDetach).toHaveBeenCalledWith(shared)
        expect(screen.queryByDisplayValue('Names spoken under glass are binding.')).not.toBeInTheDocument()
    })

    it('collapses completed resources until the user edits them', async () => {
        render(<Harness initial={[completedResource()]} />)

        expect(screen.getByText('The archive explains binding court oaths.')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('Names spoken under glass are binding.')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

        expect(await screen.findByDisplayValue('Names spoken under glass are binding.')).toBeInTheDocument()
    })

    it('shows extraction-aware blocking save copy', () => {
        render(<Harness initial={[newLorebookResource('pending.txt', 'notes')]} saving pendingExtractionCount={1} extractMetadataOnSave />)

        expect(screen.getByText('Saving and extracting 1 resource. This can take a moment.')).toBeInTheDocument()
    })

    it('disables trigger input when the resource trigger cap is reached', () => {
        const resource = newLorebookResource('triggers.txt', 'notes')
        resource.triggers = Array.from({ length: LOREBOOK_RESOURCE_MAX_TRIGGERS }, (_, index) => `trigger ${index}`)

        render(<Harness initial={[resource]} />)

        expect(screen.getByPlaceholderText('glass market, mirror court')).toBeDisabled()
    })
})
