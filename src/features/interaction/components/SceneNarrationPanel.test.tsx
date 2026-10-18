import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/app/i18n'
import type { ApiService } from '@/infrastructure/api'
import { AttestationContext, type AttestationContextValue } from '@/features/legal/attestation/attestationContext'
import { AudioPlaylistContext, type AudioPlaylistContextValue } from '@/app/providers/audioPlaylistContext'
import { SceneNarrationPanel, SessionSceneNarration } from './SceneNarrationPanel'
import { SCENE_FIXTURE, SAVED_SCENE_FIXTURE } from './sceneFixtures'

const get = vi.fn(), generate = vi.fn(), audio = vi.fn()
const api = { getSceneNarration: get, generateSceneNarration: generate, fetchTtsAudioBlob: audio } as unknown as ApiService
const props = { api, basePath: 'adventure-sessions' as const, sessionId: 7, turn: { assistant_message_id: 9, turn_id: 'reply-9' } }

beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue(SCENE_FIXTURE)
    generate.mockResolvedValue({ ...SAVED_SCENE_FIXTURE, job: { ...SAVED_SCENE_FIXTURE.job, status: 'pending' } })
    audio.mockResolvedValue(new Blob(['fixture'], { type: 'audio/mpeg' }))
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:scene-fixture'), revokeObjectURL: vi.fn() }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

async function expand() { fireEvent.click(await screen.findByRole('button', { name: 'Scene narration' })) }

it('shows the explicit credit cost and submits once through attestation', async () => {
    const withAttestation = vi.fn(async <T,>(operation: () => Promise<T>) => operation())
    render(<AttestationContext.Provider value={{ gate: 'satisfied', withAttestation: withAttestation as AttestationContextValue['withAttestation'], requestAttestation: vi.fn(), expectSignupAttestation: vi.fn(), cancelSignupAttestation: vi.fn() }}>
        <SceneNarrationPanel {...props} />
    </AttestationContext.Provider>)
    await expand()
    const create = screen.getByRole('button', { name: 'Create scene · 1 credit' })
    fireEvent.click(create); fireEvent.click(create)
    await screen.findByRole('status')
    expect(generate).toHaveBeenCalledExactlyOnceWith('adventure-sessions', 7, props.turn)
    expect(withAttestation).toHaveBeenCalledOnce()
    expect(audio).not.toHaveBeenCalled()
})

it('recovers a pending job using GETs without repeating generation', async () => {
    get.mockResolvedValue({ ...SAVED_SCENE_FIXTURE, job: { ...SAVED_SCENE_FIXTURE.job, status: 'pending' } })
    vi.useFakeTimers()
    await act(async () => { render(<SceneNarrationPanel {...props} />) })
    fireEvent.click(screen.getByRole('button', { name: 'Scene narration' }))
    get.mockResolvedValue(SAVED_SCENE_FIXTURE)
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(generate).not.toHaveBeenCalled()
    expect(audio).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Play Scene recording' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create scene/ })).not.toBeInTheDocument()
})

it('blocks uncertain POST replay until a successful explicit status read', async () => {
    generate.mockRejectedValue(new Error('response lost'))
    render(<SceneNarrationPanel {...props} />)
    await expand()
    fireEvent.click(screen.getByRole('button', { name: /Create scene/ }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: /Create scene/ })).toBeDisabled()
    expect(generate).toHaveBeenCalledOnce()
    get.mockResolvedValue(SAVED_SCENE_FIXTURE)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }))
    await screen.findByRole('button', { name: 'Play Scene recording' })
    expect(generate).toHaveBeenCalledOnce()
})

it('explains an incompatible cast and sends no generation request', async () => {
    get.mockResolvedValue({ ...SCENE_FIXTURE, available: false, reason: 'scene_mixed_providers' })
    render(<SceneNarrationPanel {...props} />)
    await expand()
    expect(screen.getByText(/all selected voices to use Fish Audio/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create scene/ })).not.toBeInTheDocument()
    expect(generate).not.toHaveBeenCalled()
})

it('keeps old recordings playable while showing that a changed cast costs another render', async () => {
    get.mockResolvedValue({ ...SAVED_SCENE_FIXTURE, matches_current: false, current_identity: 'f'.repeat(64) })
    render(<SceneNarrationPanel {...props} />)
    await expand()
    expect(screen.getByText(/previously saved voices/)).toBeInTheDocument()
    await screen.findByRole('button', { name: 'Play Scene recording' })
    expect(screen.getByRole('button', { name: 'Create with current voices · 1 credit' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Scene narration' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scene-fixture')
})

it('allows saved audio with a disabled scene flag or archived workspace', async () => {
    get.mockResolvedValue({ ...SAVED_SCENE_FIXTURE, enabled: false, available: false, reason: 'scene_disabled' })
    render(<SceneNarrationPanel {...props} readOnly />)
    await expand()
    await screen.findByRole('button', { name: 'Play Scene recording' })
    expect(screen.getByText(/workspace is archived/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create scene/ })).not.toBeInTheDocument()
})

it('does not query the API when voices are disabled, and refreshes after a cast edit', async () => {
    setTestFeatureFlags({ voices: false })
    const turns = [{ id: 'ai-9', type: 'ai' as const, content: 'The light is lit.', timestamp: '', assistantMessageId: 9, turnId: 'reply-9' }]
    const { rerender } = render(<SessionSceneNarration api={api} basePath="adventure-sessions" sessionId={7} turns={turns} revision="voice-a" />)
    expect(get).not.toHaveBeenCalled()
    setTestFeatureFlags({ voices: true })
    rerender(<SessionSceneNarration api={api} basePath="adventure-sessions" sessionId={7} turns={turns} revision="voice-a" />)
    await screen.findByRole('button', { name: 'Scene narration' })
    rerender(<SessionSceneNarration api={api} basePath="adventure-sessions" sessionId={7} turns={turns} revision="voice-b" />)
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(generate).not.toHaveBeenCalled()
})

it('provides Spanish availability and cost copy', async () => {
    render(<I18nextProvider i18n={i18n.cloneInstance({ lng: 'es' })}><SceneNarrationPanel {...props} /></I18nextProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Narración de escena' }))
    expect(screen.getByRole('button', { name: 'Crear escena · 1 crédito' })).toBeInTheDocument()
})

it('applies the saved cast gain with the user volume and never starts playback automatically', async () => {
    get.mockResolvedValue(SAVED_SCENE_FIXTURE)
    const prefs = { volume: 0.5, muted: false } as AudioPlaylistContextValue
    const { container, rerender } = render(<AudioPlaylistContext.Provider value={prefs}><SceneNarrationPanel {...props} /></AudioPlaylistContext.Provider>)
    await expand()
    await screen.findByRole('button', { name: 'Play Scene recording' })
    const element = container.querySelector('audio')!
    await waitFor(() => expect(element.volume).toBeCloseTo(0.5 * 10 ** (-3 / 20)))
    expect(element.paused).toBe(true)
    rerender(<AudioPlaylistContext.Provider value={{ ...prefs, muted: true }}><SceneNarrationPanel {...props} /></AudioPlaylistContext.Provider>)
    expect(element.volume).toBe(0)
})
