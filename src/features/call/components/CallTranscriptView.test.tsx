import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CallSummary } from '@/shared'
import { CallTranscriptView } from './CallTranscriptView'

const getVoiceCallTranscript = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: { getVoiceCallTranscript: (...args: unknown[]) => getVoiceCallTranscript(...args) },
    resolveMediaUrl: (url?: string) => url,
}))

// Every protected asset resolves instantly to a fake object URL.
const requestedMedia: Array<string | null | undefined> = []
vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => {
        requestedMedia.push(url)
        return { src: url ? 'blob:fake' : undefined, loading: false, error: null }
    },
}))

/** IntersectionObserver whose targets are visible right away (setup.ts's stub never fires). */
class VisibleObserver {
    private readonly callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
    }
    observe(target: Element) {
        this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    }
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
}

const CALL: CallSummary = {
    voice_session_id: 'vs-1',
    chat_id: 1,
    character_card_id: 'c1',
    character_name: 'Mira',
    duration_seconds: 42,
}

beforeEach(() => {
    getVoiceCallTranscript.mockResolvedValue({
        call: CALL,
        segments: [
            { segment_id: 's0', seq: 0, role: 'user', text: 'Hello there.' },
            { segment_id: 's1', seq: 0, role: 'assistant', text: 'Well met, traveller.', duration_ms: 1500, audio_url: '/tts/assets/a1.mp3' },
        ],
    })
})

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    requestedMedia.length = 0
})

describe('CallTranscriptView', () => {
    it('renders user and character transcript lines with playback for character audio only', async () => {
        vi.stubGlobal('IntersectionObserver', VisibleObserver)
        render(<CallTranscriptView call={CALL} characters={[]} onBack={vi.fn()} />)

        expect(await screen.findByText('Hello there.')).toBeInTheDocument()
        expect(screen.getByText('Well met, traveller.')).toBeInTheDocument()
        expect(screen.getByText('Call with Mira')).toBeInTheDocument()

        // Exactly one playable clip — the character line. User audio is never stored.
        await waitFor(() => expect(screen.getAllByTestId('voice-clip-player')).toHaveLength(1))
        expect(getVoiceCallTranscript).toHaveBeenCalledWith('vs-1')
    })

    it('defers fetching a clip until its line nears the viewport', async () => {
        render(<CallTranscriptView call={CALL} characters={[]} onBack={vi.fn()} />)

        expect(await screen.findByText('Well met, traveller.')).toBeInTheDocument()
        expect(screen.queryByTestId('voice-clip-player')).not.toBeInTheDocument()
        expect(requestedMedia.filter(Boolean)).toEqual([])
    })

    it('shows an empty state when the call has no transcript', async () => {
        getVoiceCallTranscript.mockResolvedValue({ call: CALL, segments: [] })
        render(<CallTranscriptView call={CALL} characters={[]} onBack={vi.fn()} />)

        expect(await screen.findByText('No transcript for this call')).toBeInTheDocument()
    })
})
