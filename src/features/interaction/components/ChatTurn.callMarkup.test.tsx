/**
 * R1-FE-05 (D23, 03 §5.5, 10 §2.4 #16-#17): a voice-call reply the ElevenLabs
 * streaming client spoke shows in the chat without speech markup v1; every
 * other turn (a call reply stored before the voice purge included) renders
 * byte-identically to before. Copy copies the text the bubble shows; Edit
 * starts from the stored text.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatResponseSegment, TurnEntry } from '@/shared'
import { LEGACY_CALL_TTS_PROVIDER } from '@/test/fixtures/legacyMinimax'
import { ChatMessage } from './ChatMessage'
import { ChatTurn } from './ChatTurn'

// Pass-through spy: what ChatTurn hands the message renderer, by reference.
vi.mock('./ChatMessage', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./ChatMessage')>()
    const Real = actual.ChatMessage
    return { ...actual, ChatMessage: vi.fn((props: Parameters<typeof Real>[0]) => <Real {...props} />) }
})

const SPOKEN = 'Hold on. <#0.4#> (sighs) The door is open.'
const SHOWN = 'Hold on. The door is open.'
const SEGMENTS: ChatResponseSegment[] = [{ kind: 'speech', content: SPOKEN, speaker_id: 'c1', speaker_name: 'Lyra' }]

function callMetadata(ttsProvider: string): Record<string, unknown> {
    return {
        conversation_mode: 'voice_call',
        voice: { voice_session_id: 7, segment_seq: 2, stt_provider: 'groq', tts_provider: ttsProvider, partial: false },
    }
}

function turn(overrides: Partial<TurnEntry> = {}): TurnEntry {
    return { id: 'ai-1', type: 'ai', content: SPOKEN, timestamp: '2026-10-14T10:00:00Z', ...overrides }
}

function renderTurn(entry: TurnEntry, stripCallMarkup?: boolean) {
    return render(<ChatTurn turn={entry} onForwardOptionClick={vi.fn()} showImage={false} showForwardOptions={false} aiSpeaker={{ id: 'c1', name: 'Lyra' }} stripCallMarkup={stripCallMarkup} />)
}

function messageHtml(container: HTMLElement): string {
    return container.querySelector('article')?.innerHTML ?? ''
}

const spy = vi.mocked(ChatMessage)

describe('ChatTurn: speech markup in call replies (R1-FE-05)', () => {
    beforeEach(() => {
        spy.mockClear()
    })

    it('an ElevenLabs call reply shows its text without pauses or interjections', () => {
        const { container } = renderTurn(turn({ metadata: callMetadata('elevenlabs_streaming'), segments: SEGMENTS }))
        expect(screen.getByText(SHOWN)).toBeInTheDocument()
        expect(container.textContent).not.toContain('<#')
        expect(container.textContent).not.toContain('(sighs)')
        // Display only: the stored turn keeps what was spoken.
        expect(SEGMENTS[0].content).toBe(SPOKEN)
    })

    it('an ElevenLabs call reply without segments shows its stripped prose', () => {
        const { container } = renderTurn(turn({ metadata: callMetadata('elevenlabs_streaming') }))
        expect(container.textContent).toContain(SHOWN)
        expect(container.textContent).not.toContain('(sighs)')
    })

    it.each([
        ['a call reply stored before the voice purge', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments: SEGMENTS }],
        ['a call reply stored before the voice purge, without segments', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }],
        ['a text reply', { segments: SEGMENTS }],
        ['the player\'s turn of an ElevenLabs call', { type: 'user' as const, metadata: callMetadata('elevenlabs_streaming') }],
    ])('%s renders exactly as stored', (_label, overrides: Partial<TurnEntry>) => {
        const entry = turn(overrides)
        const { container, unmount } = renderTurn(entry)
        expect(container.textContent).toContain('<#0.4#>')
        expect(container.textContent).toContain('(sighs)')
        // The renderer gets the stored string and the stored segment array itself.
        const props = spy.mock.lastCall?.[0]
        expect(props?.content).toBe(entry.content)
        expect(props?.segments).toBe(entry.segments)
        const html = messageHtml(container)
        unmount()

        // Byte-identical to the same turn with no call metadata at all (today's path).
        const { container: plain } = renderTurn({ ...entry, metadata: undefined })
        expect(messageHtml(plain)).toBe(html)
    })
})

describe('ChatTurn: stripCallMarkup (D23, 10 §2.4 #16-#17)', () => {
    beforeEach(() => {
        spy.mockClear()
    })

    it.each([
        ['a call reply stored before the voice purge', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments: SEGMENTS }],
        ['a call reply stored before the voice purge, without segments', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }],
        ['an ElevenLabs call reply', { metadata: callMetadata('elevenlabs_streaming'), segments: SEGMENTS }],
    ])('%s shows without pauses or interjections', (_label, overrides: Partial<TurnEntry>) => {
        const { container } = renderTurn(turn(overrides), true)
        expect(container.textContent).toContain(SHOWN)
        expect(container.textContent).not.toContain('<#')
        expect(container.textContent).not.toContain('(sighs)')
        expect(SEGMENTS[0].content).toBe(SPOKEN)
    })

    it.each([
        ['a text reply', { segments: SEGMENTS }],
        ['the player\'s call turn', { type: 'user' as const, metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }],
    ])('%s still renders exactly as stored', (_label, overrides: Partial<TurnEntry>) => {
        const entry = turn(overrides)
        const { container } = renderTurn(entry, true)
        expect(container.textContent).toContain('<#0.4#>')
        const props = spy.mock.lastCall?.[0]
        expect(props?.content).toBe(entry.content)
        expect(props?.segments).toBe(entry.segments)
    })

    it('re-renders when the option changes', () => {
        const entry = turn({ metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) })
        const { container, rerender } = renderTurn(entry, false)
        expect(container.textContent).toContain('<#0.4#>')
        rerender(<ChatTurn turn={entry} onForwardOptionClick={vi.fn()} showImage={false} showForwardOptions={false} aiSpeaker={{ id: 'c1', name: 'Lyra' }} stripCallMarkup />)
        expect(container.textContent).not.toContain('<#0.4#>')
        expect(container.textContent).toContain(SHOWN)
    })
})

describe('ChatTurn: Copy copies what the bubble shows (D23)', () => {
    const originalClipboard = navigator.clipboard
    let writeText: ReturnType<typeof vi.fn>

    beforeEach(() => {
        writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    })

    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
    })

    async function copied(): Promise<string> {
        fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
        return writeText.mock.calls[0][0] as string
    }

    it.each([
        ['an ElevenLabs call reply', { metadata: callMetadata('elevenlabs_streaming'), segments: SEGMENTS }, false],
        ['an ElevenLabs call reply without segments', { metadata: callMetadata('elevenlabs_streaming') }, false],
        ['a call reply stored before the voice purge, with stripCallMarkup', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments: SEGMENTS }, true],
        ['a call reply stored before the voice purge without segments, with stripCallMarkup', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }, true],
    ])('%s copies its text without pauses or interjections', async (_label, overrides: Partial<TurnEntry>, strip: boolean) => {
        const entry = turn(overrides)
        renderTurn(entry, strip)
        expect(await copied()).toBe(SHOWN)
        // Display only: the stored turn keeps what was spoken.
        expect(entry.content).toBe(SPOKEN)
    })

    it.each([
        ['a text reply', { segments: SEGMENTS }, true],
        ['the player\'s call turn', { type: 'user' as const, metadata: callMetadata('elevenlabs_streaming') }, true],
        ['a call reply stored before the voice purge, without stripCallMarkup', { metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }, false],
    ])('%s copies its stored content, as it shows', async (_label, overrides: Partial<TurnEntry>, strip: boolean) => {
        renderTurn(turn(overrides), strip)
        expect(await copied()).toBe(SPOKEN)
    })

    it('editing a call reply still starts from the stored text', () => {
        render(<ChatTurn turn={turn({ metadata: callMetadata('elevenlabs_streaming') })} onForwardOptionClick={vi.fn()} onEditClick={vi.fn()} showImage={false} showForwardOptions={false} aiSpeaker={{ id: 'c1', name: 'Lyra' }} stripCallMarkup />)
        fireEvent.click(screen.getByRole('button', { name: 'Edit message' }))
        expect(screen.getByRole('textbox')).toHaveValue(SPOKEN)
    })
})
