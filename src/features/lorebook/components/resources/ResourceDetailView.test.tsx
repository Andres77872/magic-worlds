import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { LorebookResource } from '@/shared'
import { LOREBOOK_RESOURCE_MAX_CHARS, newLorebookResource } from '../../lorebookResources'
import { ResourceDetailView } from './ResourceDetailView'

const fetchMock = vi.fn()

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
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
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
        fetchMock.mockResolvedValue(new Response(markdown))

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

        expect(fetchMock).toHaveBeenCalledWith('https://markdown.new/https://example.com/', expect.objectContaining({
            method: 'GET',
            credentials: 'omit',
        }))
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
        fetchMock.mockResolvedValue(new Response('# Imported source\n\nNew court notes.'))

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

    it('shows the markdown.new fallback when browser access blocks direct import', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

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
            expect(screen.getByText('Automatic import is blocked by browser access rules. Open markdown.new, copy the Markdown, and paste it below.')).toBeInTheDocument()
        })
        expect(screen.getByRole('button', { name: 'Open markdown.new' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Write' }))
        expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('')
    })

    it('blocks save when imported markdown exceeds the resource size limit', async () => {
        fetchMock.mockResolvedValue(new Response(`Title: Example Domain\n\n${'A'.repeat(LOREBOOK_RESOURCE_MAX_CHARS)}`))

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

        expect(screen.getByText('Saving with AI metadata sync enabled uses 1 resource metadata usage if extraction succeeds.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(expect.any(Object), { extractMetadata: true })
    })
})
