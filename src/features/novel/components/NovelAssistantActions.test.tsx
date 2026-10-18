import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { assistantSourceOptions, initialAssistantSettings, isAssistantSourceSettings, type AssistantSourceSettings } from '../persistence/assistantDraftJournal'
import { NovelAssistantActions } from './NovelAssistantActions'

const latest: { settings: AssistantSourceSettings; message: string } = { settings: initialAssistantSettings('scene-1', null), message: '' }
function Harness({ message: initial = '' }: { message?: string }) {
    const [state, setState] = useState({ settings: initialAssistantSettings('scene-1', null), message: initial })
    return <NovelAssistantActions value={state.settings} message={state.message} onChange={(settings, message) => { Object.assign(latest, { settings, message }); setState({ settings, message }) }} />
}
const pick = (field: string, option: string) => { fireEvent.click(screen.getByRole('combobox', { name: field })); fireEvent.click(screen.getByRole('option', { name: option })) }

it('sets the matching task and an instruction that follows the parameters until the author rewrites it', () => {
    render(<Harness />)
    pick('Action', 'Point of view or tense')
    expect(latest.settings).toMatchObject({ task: 'suggest', action: { kind: 'transform', pov: 'first', tense: null } })
    expect(latest.message).toBe('Rewrite this in first person.')
    expect(screen.getByText('Suggest · returns a proposal for review')).toBeInTheDocument()
    pick('Tense', 'Present')
    expect(latest.message).toBe('Rewrite this in first person, present tense.')
    pick('Point of view', 'Keep as is'); pick('Tense', 'Keep as is')
    expect(screen.getByRole('status')).toHaveTextContent('Choose a point of view or a tense to change.')
    // A half-chosen action survives in the device draft but cannot be prepared.
    expect(isAssistantSourceSettings(latest.settings)).toBe(true)
    pick('Action', 'Summary')
    expect(latest.settings).toMatchObject({ task: 'ask', action: { kind: 'summary' } })
    expect(latest.message).toBe('Summarize the sources scene by scene.')
    pick('Action', 'Free question or instruction')
    expect('action' in latest.settings).toBe(false)
    expect(latest.message).toBe('')
})

it('keeps the author’s own words and trims the speaker only when preparing', () => {
    render(<Harness message="Make Mara sound tired." />)
    pick('Action', 'Dialogue')
    expect(latest.message).toBe('Make Mara sound tired.')
    expect(screen.getByRole('status')).toHaveTextContent('Name the speaker.')
    fireEvent.change(screen.getByRole('textbox', { name: /Speaker/ }), { target: { value: '  Mara ' } })
    expect(latest.settings.action).toEqual({ kind: 'dialogue', speaker: 'Mara ' })
    expect(isAssistantSourceSettings(latest.settings)).toBe(true)
    expect(assistantSourceOptions(latest.settings, latest.message).action).toEqual({ kind: 'dialogue', speaker: 'Mara' })
    pick('Action', 'Line edit')
    fireEvent.click(screen.getByRole('button', { name: 'Rhythm' }))
    expect(latest.settings.action).toEqual({ kind: 'line_edit', focus: ['clarity', 'repetition', 'rhythm'] })
    // A stored action for the other task is not a recoverable draft.
    expect(isAssistantSourceSettings({ ...latest.settings, task: 'ask' })).toBe(false)
})
