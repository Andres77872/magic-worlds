/** Offline fixtures for visual review. Never imported by the application. */
import type { ComponentProps, ReactNode } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { BackgroundTasksContext, type BackgroundTasksContextValue } from '@/app/providers/backgroundTasksContext'
import { apiService, ChatSocket } from '@/infrastructure/api'
import { adventures, characters, characterChats, worlds } from '@/ui/components/lists/fixtures'
import { libraryCardToSnapshotCard } from '@/features/interaction/utils/adventureSnapshot'
import type { AdminVoiceGroups, Adventure, CallSummary, VoicePreset } from '@/shared'

export type AuditState = 'populated' | 'empty' | 'loading' | 'error' | 'signed-out' | 'restricted'
type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
const noop = () => {}
const blocked = async () => { throw new Error('Offline preview: this action is not sent to the server.') }
export const auditAdventure: Adventure = {
    ...adventures[0], id: '90001',
    snapshot: { schema_version: 2, source: 'resolved_library_clone', template_card_id: 'preview-template', template: {
        id: 'preview-template', name: 'The Tavern at the Edge of Sleep', description: 'Rain taps the leaded glass as a courier places a sealed letter on your table.',
        persona: libraryCardToSnapshotCard({ ...characters[3], role: 'persona' }, 'character'),
        characters: characters.slice(0, 2).map((card) => libraryCardToSnapshotCard(card, 'character')),
        world: [libraryCardToSnapshotCard(worlds[0], 'world')],
    } },
}
export const auditVoices: AdminVoiceGroups = {
    system: [{ voice_id: 'English_Warm_Narrator', voice_type: 'system', voice_name: 'Warm narrator', description: ['A measured English storyteller.'], deletable: false }],
    voice_generation: [{ voice_id: 'archive_keeper', voice_type: 'voice_generation', voice_name: 'Archive keeper', description: ['Soft-spoken and curious.'], deletable: true }],
    voice_cloning: [{ voice_id: 'courier_voice', voice_type: 'voice_cloning', voice_name: 'Courier', description: ['A calm messenger.'], deletable: true }],
}
export const auditPresets: VoicePreset[] = [
    { preset_id: '1', name: 'The patient storyteller', description: 'Warm, unhurried narration for long scenes.', base_voice_id: 'English_Warm_Narrator', base_voice_name: 'Warm narrator', speed: .9, volume: 1, pitch: -1, emotion: 'calm', language_boost: 'English', is_global: true },
    { preset_id: '2', name: 'My courier', description: 'A brisk, curious voice.', base_voice_id: 'English_Warm_Narrator', base_voice_name: 'Warm narrator', speed: 1.1, volume: 1, pitch: 1, is_global: false },
]
export const auditCall: CallSummary = { voice_session_id: 'preview-call', chat_id: 90002, character_card_id: characters[0].id, character_name: characters[0].name, duration_seconds: 192, segment_count: 2, started_at: '2026-09-18T18:00:00Z', status: 'ended' }
const codeGrant = { code_id: 1, label: 'Storyteller welcome', credits: 250, status: 'active' as const, expires_at: null, claimed_by_user_id: null, claimed_at: null, created_by_user_id: 9, reason: 'Preview grant', created_at: '2026-09-01T00:00:00Z', updated_at: null }
const emailGrant = { ...codeGrant, grant_id: 2, email: 'reader@example.com', email_delivery_status: 'sent' }
const counts = { active: 1, active_credits: 250, claimed: 0, claimed_credits: 0, expired: 0, expired_credits: 0, disabled: 0, disabled_credits: 0, total: 1, total_credits: 250 }
const storedMessages = [
    { message_id: 1, sequence_no: 1, role: 'user', content: 'I open the letter carefully.', created_at: '2026-09-19T01:00:00Z', turn_id: 'preview-turn', status: 'completed' },
    { message_id: 2, sequence_no: 2, role: 'assistant', content: 'The seal breaks with a whisper. Inside, a map of the sunken library glows faintly.', created_at: '2026-09-19T01:00:01Z', turn_id: 'preview-turn', status: 'completed', metadata: { turn_metadata: { forwardOptions: [{ label: 'Ask about the map', message: 'Who drew this map?' }, { label: 'Study the route', message: 'Study the route marked on the map.' }] } } },
]

/** Replace every API method and the chat transport; actions cannot reach live services. */
export function installPlayAdminAuditApi(state: AuditState = 'populated') {
    const target = apiService as unknown as Record<string, unknown>
    const originals = new Map<string, PropertyDescriptor | undefined>()
    const prototype = Object.getPrototypeOf(apiService)
    const methods = new Set([...Object.getOwnPropertyNames(prototype), ...Object.keys(target)])
    for (const key of methods) {
        if (key === 'constructor' || typeof target[key] !== 'function') continue
        originals.set(key, Object.getOwnPropertyDescriptor(apiService, key))
        target[key] = blocked
    }
    const load = async <T,>(value: T): Promise<T> => {
        if (state === 'loading') return new Promise<T>(() => {})
        if (state === 'error') throw new Error('The preview service is temporarily unavailable. Try again.')
        return value
    }
    const empty = state === 'empty'
    Object.assign(target, {
        listSystemVoices: () => load({ groups: empty ? { system: [], voice_generation: [], voice_cloning: [] } : auditVoices }),
        listAdminVoices: () => load({ groups: empty ? { system: [], voice_generation: [], voice_cloning: [] } : auditVoices }),
        listVoicePresets: () => load(empty ? [] : auditPresets),
        getRecentVoiceCalls: () => load({ items: empty ? [] : [auditCall] }),
        getVoiceCallTranscript: () => load({ call: auditCall, segments: empty ? [] : [
            { segment_id: '1', seq: 1, role: 'user', text: 'What happened after the gate closed?' },
            { segment_id: '2', seq: 2, role: 'assistant', text: 'The lantern went dark. Then someone knocked from the other side.' },
        ] }),
        listCreditCodeGrants: () => load({ items: empty ? [] : [codeGrant], total: empty ? 0 : 1, next_offset: null }),
        listEmailCreditGrants: () => load({ items: empty ? [] : [emailGrant], total: empty ? 0 : 1, next_offset: null }),
        getCreditGrantsSummary: () => load({ codes: empty ? { ...counts, active: 0, active_credits: 0, total: 0, total_credits: 0 } : counts, emails: empty ? { ...counts, active: 0, active_credits: 0, total: 0, total_credits: 0 } : counts }),
        listLorebookAttachments: async () => [],
        getAdventureSessionMessages: () => load({ messages: empty ? [] : storedMessages }),
        getCharacterChatMessages: () => load({ messages: empty ? [] : storedMessages }),
        getCardUsage: async () => ({ sessions: 1, stories: 0 }),
    })
    const connect = ChatSocket.prototype.connect
    const close = ChatSocket.prototype.close
    ChatSocket.prototype.connect = function () {
        const socket = this as unknown as { handlers: { onStatusChange?: (status: 'open') => void } }
        socket.handlers.onStatusChange?.('open')
    }
    ChatSocket.prototype.close = noop
    return () => {
        for (const [key, original] of originals) {
            if (original) Object.defineProperty(apiService, key, original)
            else delete target[key]
        }
        ChatSocket.prototype.connect = connect
        ChatSocket.prototype.close = close
    }
}

export function PlayAdminAuditProviders({ children, state = 'populated' }: { children: ReactNode; state?: AuditState }) {
    const empty = state === 'empty' || state === 'error' || state === 'loading'
    const auth = { isAuthenticated: state !== 'signed-out', user: { user_hash: 'preview', username: 'preview', user_type: state === 'restricted' ? 'user' : 'root' }, token: 'preview', isLoading: false, error: null, authEpoch: 1, accountKey: 'preview', userHash: 'preview', sessionPhase: state === 'signed-out' ? 'anonymous' : 'authenticated', openLoginModal: noop, closeLoginModal: noop, isLoginModalOpen: false } as unknown as AuthValue
    const data = { characters: empty ? [] : [...characters.slice(0, 3), { ...characters[3], role: 'persona' }], worlds, lorebooks: [], setLorebooks: noop,
        inProgressAdventures: empty ? [] : [auditAdventure], characterChats: empty ? [] : characterChats,
        editingInProgress: auditAdventure, activeCharacterChat: { ...characterChats[0], turns: state === 'empty' ? [] : characterChats[0].turns, id: '90002', persona: { ...characters[3], role: 'persona' }, codexCards: [] }, activeCharacterChatMode: 'text',
        loadingState: { isLoading: state === 'loading', error: state === 'error' ? 'Service unavailable' : null },
        loadData: async () => { if (state === 'loading') await new Promise<void>(() => {}) }, editInProgress: noop, deleteInProgress: blocked, saveInProgressSnapshot: blocked,
        editCharacter: noop, resumeCharacterChat: noop, startCharacterChat: blocked, deleteCharacterChat: blocked,
        addCharacterChatCodexCards: blocked, toggleCharacterChatCodexCard: blocked, removeCharacterChatCodexCard: blocked,
    } as unknown as DataValue
    const tasks = { tasks: [], activeTasks: [], activeCount: 0, taskBuckets: { active: [], completed: [], failed: [] }, drawerOpen: false, openDrawer: noop, closeDrawer: noop, refreshTasks: async () => {}, registerTask: noop, registerThemeSongJob: noop, cancelTask: blocked, clearTerminalTasks: blocked, terminalHasMore: { completed: false, failed: false }, loadMoreTerminalTasks: async () => {} } as unknown as BackgroundTasksContextValue
    return <NavigationProvider><AuthContext.Provider value={auth}><DataContext.Provider value={data}><BackgroundTasksContext.Provider value={tasks}><FloatingWindowsProvider>{children}</FloatingWindowsProvider></BackgroundTasksContext.Provider></DataContext.Provider></AuthContext.Provider></NavigationProvider>
}
