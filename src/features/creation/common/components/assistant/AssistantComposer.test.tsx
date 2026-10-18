import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AssistantComposer } from './AssistantComposer'

describe('shared assistant composer', () => {
    it('keeps a controlled draft through preparation and clears only when the owner asks', () => {
        const send = vi.fn()
        function Draft() {
            const [value, setValue] = useState('  Keep the original question  ')
            return <AssistantComposer streaming={false} value={value} onValueChange={setValue} clearOnSubmit={false} submitLabel="Review prompt" onSend={send} onStop={() => {}} />
        }
        render(<Draft />)
        fireEvent.click(screen.getByRole('button', { name: 'Review prompt' }))
        expect(send).toHaveBeenCalledExactlyOnceWith('Keep the original question')
        expect(screen.getByRole('textbox')).toHaveValue('  Keep the original question  ')
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A revised question' } })
        expect(screen.getByRole('textbox')).toHaveValue('A revised question')
    })

    it('preserves default send behavior, multiline input, and composition input', () => {
        const send = vi.fn()
        render(<AssistantComposer streaming={false} onSend={send} onStop={() => {}} />)
        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'A question' } })
        fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
        expect(send).not.toHaveBeenCalled()
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(send).toHaveBeenCalledExactlyOnceWith('A question')
        expect(input).toHaveValue('')
    })
})
