import { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ApiService, SceneNarrationResponse } from '@/infrastructure/api'
import { SceneNarrationPanel } from './SceneNarrationPanel'
import { SCENE_FIXTURE, SAVED_SCENE_FIXTURE } from './sceneFixtures'

function silentAudio() {
    const bytes = new Uint8Array(16_044)
    const view = new DataView(bytes.buffer)
    bytes.set(new TextEncoder().encode('RIFF'), 0); view.setUint32(4, bytes.length - 8, true)
    bytes.set(new TextEncoder().encode('WAVEfmt '), 8); view.setUint32(16, 16, true)
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true)
    view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    bytes.set(new TextEncoder().encode('data'), 36); view.setUint32(40, 16000, true)
    return new Blob([bytes], { type: 'audio/wav' })
}

function Scene({ state = 'ready', readOnly = false }: { state?: 'ready' | 'saved' | 'changed' | 'mixed' | 'pending' | 'failed'; readOnly?: boolean }) {
    const api = useMemo(() => {
        const value: SceneNarrationResponse = state === 'saved' || state === 'changed' ? { ...SAVED_SCENE_FIXTURE, matches_current: state !== 'changed' }
            : state === 'mixed' ? { ...SCENE_FIXTURE, available: false, reason: 'scene_mixed_providers' }
            : state === 'pending' || state === 'failed' ? { ...SAVED_SCENE_FIXTURE, job: { ...SAVED_SCENE_FIXTURE.job!, assets: [], status: state === 'pending' ? 'pending' : 'unavailable' } } : SCENE_FIXTURE
        const responses = new Map([['scene', value]])
        return { getSceneNarration: async () => responses.get('scene')!,
            generateSceneNarration: async () => { responses.set('scene', SAVED_SCENE_FIXTURE); return SAVED_SCENE_FIXTURE },
            fetchTtsAudioBlob: async () => silentAudio(),
        } as unknown as ApiService
    }, [state])
    return <div className="w-full max-w-sm"><SceneNarrationPanel key={`${state}:${readOnly}`} api={api} basePath="adventure-sessions" sessionId={7}
        turn={{ assistant_message_id: 9, turn_id: 'reply-9' }} readOnly={readOnly} /></div>
}

const meta = {
    title: 'Interaction/SceneNarrationPanel', component: Scene, tags: ['autodocs'], args: { state: 'ready', readOnly: false },
    parameters: { layout: 'padded', docs: { description: { component: 'An optional whole-reply recording beside cast controls, with explicit credit cost, saved cast provenance and read-only recovery. Uses an offline API fixture.' } } },
    argTypes: { state: { control: 'inline-radio', options: ['ready', 'saved', 'changed', 'mixed', 'pending', 'failed'] } },
} satisfies Meta<typeof Scene>
export default meta
type Story = StoryObj<typeof meta>
export const Ready: Story = {}
export const Saved: Story = { args: { state: 'saved' } }
export const ChangedCast: Story = { args: { state: 'changed' } }
export const MixedCast: Story = { args: { state: 'mixed' } }
export const Pending: Story = { args: { state: 'pending' } }
export const Failed: Story = { args: { state: 'failed' } }
export const Archived: Story = { args: { state: 'saved', readOnly: true } }
