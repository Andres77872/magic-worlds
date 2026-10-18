import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import fixture from '@/test/fixtures/storyAssistantContextChapterSummaries.json'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord, StoryAssistantAction } from '@/shared/types/storyAssistant.types'
import { NovelAssistantCopy } from './NovelAssistantCopy'

const wire = fixture as unknown as { index: StoryOutline; record: NovelAssistantRecord }
const story = (edit: (value: StoryOutline) => void = () => {}) => { const value = structuredClone(wire.index); edit(value); return value }
const BLURB = 'A lamplighter keeps the tide bell ringing while the town forgets why.'
function copyRecord(action: StoryAssistantAction | undefined, answer = BLURB) {
    const value = structuredClone(wire.record)
    value.context.request = { ...value.context.request, task: 'ask', action }
    value.result = { ...value.result, answer }
    return value
}

it('shows what a blurb would replace and saves the reviewed, edited text as the description', async () => {
    const writer = vi.fn().mockResolvedValue('saved')
    render(<NovelAssistantCopy record={copyRecord({ kind: 'copy', form: 'blurb' })} story={story(value => { value.description = 'An old description.' })} writer={writer} readOnly={false} />)
    expect(screen.getByRole('region', { name: 'Use as the novel’s description' })).toBeInTheDocument()
    expect(screen.getByText('An old description.')).toBeInTheDocument()
    const box = screen.getByRole('textbox', { name: /Text to save/ })
    expect(box).toHaveValue(BLURB)
    fireEvent.change(box, { target: { value: '  ' + BLURB + ' Then the bell stops.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as description' }))
    await waitFor(() => expect(writer).toHaveBeenCalledWith('description', BLURB + ' Then the bell stops.', wire.index.metadataRevision))
    expect(await screen.findByRole('status')).toHaveTextContent('Saved as the novel’s description.')
})

it('offers the reply’s copy alone, without the answer’s notes to the author', () => {
    const record = copyRecord({ kind: 'copy', form: 'blurb' }, BLURB + '\n\nThe sources do not say who lit the lamp.')
    record.result.copy = BLURB
    render(<NovelAssistantCopy record={record} story={story()} writer={vi.fn()} readOnly={false} />)
    expect(screen.getByRole('textbox', { name: /Text to save/ })).toHaveValue(BLURB)
})

it('saves a submission synopsis as the synopsis and says when the novel changed first', async () => {
    const writer = vi.fn().mockResolvedValue('changed')
    render(<NovelAssistantCopy record={copyRecord({ kind: 'copy', form: 'synopsis' }, 'Mara rings the bell; the town remembers.')} story={story(value => { value.details = { ...value.details, synopsis: null } })} writer={writer} readOnly={false} />)
    expect(screen.getByText('The novel has no synopsis yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save as synopsis' }))
    await waitFor(() => expect(writer).toHaveBeenCalledWith('synopsis', 'Mara rings the bell; the town remembers.', wire.index.metadataRevision))
    expect(await screen.findByRole('alert')).toHaveTextContent('The novel’s details changed since you opened this. Nothing was saved')
})

it('refuses text past the limits and the text already saved', () => {
    render(<NovelAssistantCopy record={copyRecord({ kind: 'copy', form: 'synopsis' }, 'x'.repeat(20_001))} story={story(value => { value.details = { ...value.details, synopsis: 'Same.' } })} writer={vi.fn()} readOnly={false} />)
    expect(screen.getByText('The synopsis can hold up to 20,000 characters. Shorten the text.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save as synopsis' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: /Text to save/ }), { target: { value: '' } })
    expect(screen.getByText('Write the text to save.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /Text to save/ }), { target: { value: 'Same. ' } })
    expect(screen.getByRole('button', { name: 'Save as synopsis' })).toBeDisabled()
    expect(screen.getByText('This is already the saved text.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /Text to save/ }), { target: { value: 'Different.' } })
    expect(screen.getByRole('button', { name: 'Save as synopsis' })).toBeEnabled()
})

it('offers nothing for titles, a handoff note, other actions, a read-only novel or no writer', () => {
    const cases: Array<[StoryAssistantAction | undefined, boolean, boolean]> = [
        [{ kind: 'copy', form: 'titles' }, false, true], [{ kind: 'copy', form: 'handoff' }, false, true], [{ kind: 'summary' }, false, true],
        [undefined, false, true], [{ kind: 'copy', form: 'blurb' }, true, true], [{ kind: 'copy', form: 'blurb' }, false, false],
    ]
    for (const [action, readOnly, hasWriter] of cases) {
        const view = render(<NovelAssistantCopy record={copyRecord(action)} story={story()} writer={hasWriter ? vi.fn() : undefined} readOnly={readOnly} />)
        expect(view.container).toBeEmptyDOMElement()
        view.unmount()
    }
})
