import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { LorebookResource } from '@/shared'
import { LOREBOOK_RESOURCE_MAX_CHARS, LOREBOOK_RESOURCE_MAX_RESOURCES, LOREBOOK_RESOURCE_MAX_TRIGGERS, newLorebookResource } from '../lorebookResources'
import { LorebookResourcePanel } from './LorebookResourcePanel'

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
}: { initial?: LorebookResource[]; saving?: boolean; pendingExtractionCount?: number; extractMetadataOnSave?: boolean }) {
    const [resources, setResources] = useState(initial)
    return (
        <LorebookResourcePanel
            resources={resources}
            onChange={setResources}
            saving={saving}
            pendingExtractionCount={pendingExtractionCount}
            extractMetadataOnSave={extractMetadataOnSave}
        />
    )
}

function LinkedHarness({ initial = [], linked = [completedResource({ id: 'shared-resource', title: 'Shared atlas' })], onDetach = vi.fn() }: {
    initial?: LorebookResource[]
    linked?: LorebookResource[]
    onDetach?: (resource: LorebookResource) => void
}) {
    const [resources, setResources] = useState(initial)
    return (
        <LorebookResourcePanel
            resources={resources}
            linkedResources={linked}
            onChange={setResources}
            onDetachResource={onDetach}
        />
    )
}

describe('LorebookResourcePanel', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
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
            target: { files: [new File(['bad'], 'archive.pdf', { type: 'application/pdf' })] },
        })

        expect(await screen.findByRole('alert')).toHaveTextContent('archive.pdf must be a .md or .txt file.')

        fireEvent.change(screen.getByTestId('lorebook-resource-upload'), {
            target: { files: [new File(['x'.repeat(LOREBOOK_RESOURCE_MAX_CHARS + 1)], 'large.txt', { type: 'text/plain' })] },
        })

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(`large.txt is over ${LOREBOOK_RESOURCE_MAX_CHARS} characters.`))
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
