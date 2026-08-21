import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { useContext } from 'react'
import { AudioPlaylistProvider } from './AudioPlaylistProvider'
import { AudioPlaylistContext } from './audioPlaylistContext'
import { AuthContext } from './AuthProvider'
import type { AuthSessionPhase } from '@/infrastructure/api/authSession'

const TRACK = { id: 't1', title: 'Ember Hymn', url: '/tts/1.mp3' }
const KEY = 'magic_worlds:playlist:v1:user:abc'

function authValue(sessionPhase: AuthSessionPhase, authEpoch: number) {
    return {
        isAuthenticated: sessionPhase === 'authenticated',
        user: null, token: null, projects: [], isLoading: false, error: null,
        sessionPhase, authEpoch, accountKey: 'user:abc:0', userHash: 'abc',
        isLoginModalOpen: false,
        login: async () => false, register: async () => false,
        loginWithGoogle: async () => {}, completeGoogleLogin: async () => false,
        logout: async () => {}, continueSignedOut: () => {}, updateUser: () => {},
        clearError: () => {}, openLoginModal: () => {}, closeLoginModal: () => {},
    } as unknown as React.ContextType<typeof AuthContext>
}

function Harness({ onReady }: { onReady: (api: NonNullable<React.ContextType<typeof AudioPlaylistContext>>) => void }) {
    const api = useContext(AudioPlaylistContext)
    if (api) onReady(api)
    return null
}

function renderAt(phase: AuthSessionPhase, epoch: number, onReady: (api: never) => void) {
    return render(
        <AuthContext.Provider value={authValue(phase, epoch)}>
            <AudioPlaylistProvider>
                <Harness onReady={onReady as never} />
            </AudioPlaylistProvider>
        </AuthContext.Provider>,
    )
}

describe('playlist persistence across auth phases', () => {
    it('keeps the stored queue when the session expires, and restores it on reauthentication', () => {
        localStorage.clear()
        let api: { enqueue: (t: unknown) => void } | null = null
        const first = renderAt('authenticated', 1, (a) => { api = a })
        act(() => { (api as unknown as { enqueue: (t: unknown) => void }).enqueue(TRACK) })
        expect(localStorage.getItem(KEY)).toContain('Ember Hymn')

        // Token refresh denied: the same owner is expected back, so the slot survives.
        first.rerender(
            <AuthContext.Provider value={authValue('expired', 2)}>
                <AudioPlaylistProvider>
                    <Harness onReady={() => {}} />
                </AudioPlaylistProvider>
            </AuthContext.Provider>,
        )
        expect(localStorage.getItem(KEY)).toContain('Ember Hymn')
        first.unmount()

        let after: { queue: unknown[] } | null = null
        renderAt('authenticated', 3, (a) => { after = a })
        expect((after as unknown as { queue: unknown[] }).queue).toHaveLength(1)
    })

    it('drops the stored queue on an explicit sign-out', () => {
        localStorage.clear()
        let api: unknown = null
        const view = renderAt('authenticated', 1, (a) => { api = a })
        act(() => { (api as { enqueue: (t: unknown) => void }).enqueue(TRACK) })
        expect(localStorage.getItem(KEY)).toContain('Ember Hymn')

        view.rerender(
            <AuthContext.Provider value={authValue('signed_out', 2)}>
                <AudioPlaylistProvider>
                    <Harness onReady={() => {}} />
                </AudioPlaylistProvider>
            </AuthContext.Provider>,
        )
        expect(localStorage.getItem(KEY)).toBeNull()
    })
})
