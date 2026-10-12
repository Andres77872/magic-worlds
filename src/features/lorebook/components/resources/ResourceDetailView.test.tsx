import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { apiService } from '@/infrastructure/api'
import type { LorebookResource } from '@/shared'
import {
    OTHER_WORKSPACE_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
    createWorkspaceTestState,
    testWorkspace,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { LOREBOOK_RESOURCE_MAX_CHARS, newLorebookResource } from '../../lorebookResources'
import { ResourceDetailView } from './ResourceDetailView'
import { BackgroundTasksContext, type BackgroundTasksContextValue } from '@/app/providers/backgroundTasksContext'

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
        metadataOutdated: true,
        extraction: {
            keywords: ['mirror court'],
            shortSummary: 'The archive explains binding court oaths.',
            longSummary: 'The glass archive explains how oaths bind names under court law.',
            notes: ['Names are binding.'],
            snippets: [
                {
                    id: 'snippet-1',
                    title: 'Mirror oath',
                    content: 'The mirror oath binds names.',
                    triggers: ['mirror oath'],
                    source: 'glass-archive.md#oaths',
                },
            ],
            model: 'metadata-model',
            schemaVersion: 'resource.v1',
            sourceHash: 'hash-1',
            updatedAt: '2026-06-17T00:00:00Z',
        },
        ...overrides,
    }
}

describe('ResourceDetailView', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
        vi.restoreAllMocks()
    })

    it('shows unsynced metadata as saved content rather than a queued upload', () => {
        render(<ResourceDetailView resource={newLorebookResource('court.md','# Saved PDF text')} isCreate={false} loading={false} saving={false} onSave={vi.fn()} onSyncMetadata={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} />)
        expect(screen.getByText('Metadata not generated')).toBeInTheDocument()
        expect(screen.getByRole('button',{name:'Generate metadata'})).toBeEnabled()
        expect(screen.getByText(/The resource is saved/)).toBeInTheDocument()
        expect(screen.queryByText('pending')).not.toBeInTheDocument()
    })

    it('follows an active metadata task and prevents a duplicate generation request', () => {
        const source=newLorebookResource('court.md','# Saved PDF text')
        const context={ activeTasks:[{operation:'lorebook_extraction',target:{type:'resource',id:source.id}}] } as BackgroundTasksContextValue
        render(<BackgroundTasksContext.Provider value={context}>
            <ResourceDetailView resource={source} isCreate={false} loading={false} saving={false} onSave={vi.fn()} onSyncMetadata={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} />
        </BackgroundTasksContext.Provider>)
        expect(screen.getByText('Generating metadata')).toBeInTheDocument()
        expect(screen.getByRole('button',{name:'Generating metadata…'})).toBeDisabled()
        expect(screen.getByText(/Follow its progress in Tasks/)).toBeInTheDocument()
    })

    it('opens Markdown content directly for writing when Edit is selected', () => {
        render(<ResourceDetailView resource={completedResource()} isCreate={false} loading={false} saving={false} onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('Names spoken under glass are binding.')
        fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'renamed.md' } })
        expect(screen.getByRole('textbox', { name: 'Content' })).toBeInTheDocument()
    })

    it('keeps the resource file type in sync when the filename extension changes', async () => {
        const onSave = vi.fn(async () => false)

        render(
            <ResourceDetailView
                resource={newLorebookResource('resource.txt', 'plain notes')}
                isCreate
                loading={false}
                saving={false}
                onSave={onSave}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        expect(screen.getByText('TXT')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'resource.md' } })

        expect(screen.getByText('MD')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Create' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'resource.md',
                fileType: 'md',
            }),
            { extractMetadata: false },
        )
    })

    it('renders extracted keywords, summaries, notes, snippets, and freshness metadata', () => {
        render(
            <ResourceDetailView
                resource={completedResource()}
                isCreate={false}
                loading={false}
                saving={false}
                onSave={vi.fn()}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        expect(screen.getByText('Extracted metadata')).toBeInTheDocument()
        expect(screen.getByText('This metadata was extracted from older content. Sync metadata to refresh it.')).toBeInTheDocument()
        expect(screen.getByText('The archive explains binding court oaths.')).toBeInTheDocument()
        expect(screen.getByText('The glass archive explains how oaths bind names under court law.')).toBeInTheDocument()
        expect(screen.getByText('mirror court')).toBeInTheDocument()
        expect(screen.getByText('Names are binding.')).toBeInTheDocument()
        expect(screen.getAllByText('Mirror oath').length).toBeGreaterThan(0)
        expect(screen.getByText('The mirror oath binds names.')).toBeInTheDocument()
        expect(screen.getByText('glass-archive.md#oaths')).toBeInTheDocument()
        expect(screen.getByText('metadata-model')).toBeInTheDocument()
        expect(screen.getByText('resource.v1')).toBeInTheDocument()
    })

    it('imports markdown from a URL into a new empty resource draft', async () => {
        const onSave = vi.fn(async () => false)
        const markdown = [
            'Title: Example Domain',
            '',
            'URL Source: https://example.com',
            '',
            'Markdown Content:',
            '# Example Domain',
            '',
            'Converted source notes.',
        ].join('\n')
        const importMarkdownUrl = vi.spyOn(apiService, 'importMarkdownUrl').mockResolvedValue({
            source_url: 'https://example.com/',
            markdown,
            rate_limit_remaining: '499',
        })

        render(
            <ResourceDetailView
                resource={newLorebookResource('resource.md', '')}
                isCreate
                loading={false}
                saving={false}
                onSave={onSave}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        fireEvent.change(screen.getByLabelText('URL to import'), { target: { value: 'example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Import Markdown' }))

        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(markdown))

        expect(importMarkdownUrl).toHaveBeenCalledWith('https://example.com/')
        expect(screen.getByLabelText('Title')).toHaveValue('Example Domain')
        expect(screen.getByLabelText('File name')).toHaveValue('example-domain.md')
        expect(screen.getByText('Markdown imported.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Create' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Example Domain',
                fileName: 'example-domain.md',
                fileType: 'md',
                content: markdown,
                contentLength: markdown.length,
                extractionStatus: 'pending',
            }),
            { extractMetadata: false },
        )
    })

    it('replaces existing resource content without overwriting title or filename', async () => {
        const onSave = vi.fn(async () => false)
        vi.spyOn(apiService, 'importMarkdownUrl').mockResolvedValue({
            source_url: 'https://example.com/archive',
            markdown: '# Imported source\n\nNew court notes.',
        })

        render(
            <ResourceDetailView
                resource={completedResource({ metadataOutdated: false })}
                isCreate={false}
                loading={false}
                saving={false}
                onSave={onSave}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        fireEvent.change(screen.getByLabelText('URL to import'), { target: { value: 'https://example.com/archive#top' } })
        fireEvent.click(screen.getByRole('button', { name: 'Import Markdown' }))

        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('# Imported source\n\nNew court notes.'))

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Glass archive',
                fileName: 'glass-archive.md',
                content: '# Imported source\n\nNew court notes.',
                contentLength: '# Imported source\n\nNew court notes.'.length,
                extractionStatus: 'completed',
                metadataOutdated: true,
            }),
            { extractMetadata: false },
        )
    })

    it('shows a sanitized failure when the server cannot convert the URL', async () => {
        vi.spyOn(apiService, 'importMarkdownUrl').mockRejectedValue(new Error('private upstream detail'))

        render(
            <ResourceDetailView
                resource={newLorebookResource('resource.md', '')}
                isCreate
                loading={false}
                saving={false}
                onSave={vi.fn()}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        fireEvent.change(screen.getByLabelText('URL to import'), { target: { value: 'example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Import Markdown' }))

        await waitFor(() => {
            expect(screen.getByText('Could not convert that URL with markdown.new.')).toBeInTheDocument()
        })
        expect(screen.queryByRole('button', { name: 'Open markdown.new' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Write' }))
        expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('')
    })

    it('blocks save when imported markdown exceeds the resource size limit', async () => {
        vi.spyOn(apiService, 'importMarkdownUrl').mockResolvedValue({
            source_url: 'https://example.com/',
            markdown: `Title: Example Domain\n\n${'A'.repeat(LOREBOOK_RESOURCE_MAX_CHARS)}`,
        })

        render(
            <ResourceDetailView
                resource={newLorebookResource('resource.md', '')}
                isCreate
                loading={false}
                saving={false}
                onSave={vi.fn()}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        fireEvent.change(screen.getByLabelText('URL to import'), { target: { value: 'example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Import Markdown' }))

        await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled())
        expect(screen.getByText(/is over 80000 characters/)).toBeInTheDocument()
    })

    it('preserves stale extraction and saves edited content without metadata sync by default', () => {
        const onSave = vi.fn(async () => false)

        render(
            <ResourceDetailView
                resource={completedResource({ fileName: 'glass-archive.txt', fileType: 'txt' })}
                isCreate={false}
                loading={false}
                saving={false}
                onSave={onSave}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Content' }), { target: { value: 'Updated source text.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'Updated source text.',
                contentLength: 'Updated source text.'.length,
                extractionStatus: 'completed',
                metadataOutdated: true,
                extraction: expect.objectContaining({
                    shortSummary: 'The archive explains binding court oaths.',
                }),
            }),
            { extractMetadata: false },
        )
    })

    it('warns and opts into extraction when the save toggle is enabled', () => {
        const onSave = vi.fn(async () => false)

        render(
            <ResourceDetailView
                resource={completedResource({ metadataOutdated: false })}
                isCreate={false}
                loading={false}
                saving={false}
                onSave={onSave}
                onDelete={vi.fn()}
                onBack={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        fireEvent.click(screen.getByRole('switch', { name: 'Sync AI metadata on save' }))

        expect(screen.getByText('Saving first preserves the source. Metadata sync uses your active LLM profile and its usage limits.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(expect.any(Object), { extractMetadata: true })
    })

    it('stays readable but blocks edit, metadata sync and delete when its own workspace is archived', () => {
        // The selected workspace is active; the resource belongs to the archived one.
        const workspace = createWorkspaceTestState({
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library'),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { archived_at: '2026-10-10T00:00:00Z' }),
            ],
        })
        const onSave = vi.fn(async () => true)
        const onSyncMetadata = vi.fn(async () => true)
        const onDelete = vi.fn()
        const onBack = vi.fn()
        render(
            <WorkspaceTestProvider state={workspace}>
                <ResourceDetailView
                    resource={completedResource({ organization: { workspace_id: OTHER_WORKSPACE_ID } })}
                    isCreate={false}
                    loading={false}
                    saving={false}
                    onSave={onSave}
                    onSyncMetadata={onSyncMetadata}
                    onDelete={onDelete}
                    onBack={onBack}
                />
            </WorkspaceTestProvider>,
        )

        const edit = screen.getByRole('button', { name: 'Edit' })
        const sync = screen.getByRole('button', { name: 'Generate metadata' })
        const remove = screen.getByRole('button', { name: 'Delete Glass archive' })
        for (const control of [edit, sync, remove]) {
            expect(control).toBeDisabled()
            fireEvent.click(control)
        }
        expect(screen.queryByLabelText('File name')).not.toBeInTheDocument()
        expect(onSyncMetadata).not.toHaveBeenCalled()
        expect(onDelete).not.toHaveBeenCalled()
        expect(onSave).not.toHaveBeenCalled()
        expect(screen.getByTestId('resource-archived-notice')).toBeInTheDocument()

        // Reading and navigation keep working.
        expect(screen.getByText('Extracted metadata')).toBeInTheDocument()
        const plain = screen.getByRole('button', { name: 'Plain' })
        expect(plain).toBeEnabled()
        fireEvent.click(plain)
        expect(screen.getByText('Names spoken under glass are binding.')).toBeInTheDocument()
        const back = screen.getByRole('button', { name: 'Back to resources' })
        expect(back).toBeEnabled()
        fireEvent.click(back)
        expect(onBack).toHaveBeenCalledOnce()
    })

    it('keeps a resource of an active workspace editable while the selected workspace is archived', () => {
        const workspace = createWorkspaceTestState({
            workspaces: [
                testWorkspace(TEST_WORKSPACE_ID, 'Main library', { archived_at: '2026-10-10T00:00:00Z' }),
                testWorkspace(OTHER_WORKSPACE_ID, 'Novel A'),
            ],
        })
        render(
            <WorkspaceTestProvider state={workspace}>
                <ResourceDetailView
                    resource={completedResource({ organization: { workspace_id: OTHER_WORKSPACE_ID } })}
                    isCreate={false}
                    loading={false}
                    saving={false}
                    onSave={vi.fn()}
                    onDelete={vi.fn()}
                    onBack={vi.fn()}
                />
            </WorkspaceTestProvider>,
        )

        expect(screen.queryByTestId('resource-archived-notice')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        expect(screen.getByLabelText('File name')).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })
})
