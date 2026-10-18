import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrictMode, type ReactNode } from 'react'
import type { VoicePresetPreviewResponse } from '@/shared'
import { Button } from '@/ui/primitives'
import { PreviewAllowanceProvider } from './PreviewAllowanceProvider'
import { PREVIEW_ALLOWANCE_CHANNEL } from './usePreviewAllowance'
import { useRecipePreview, type RecipePreviewInput } from './useRecipePreview'
import { resetPreviewCreditConfirmation } from './usePreviewCreditConfirm'
import { PreviewCreditDialog } from './components/PreviewCreditDialog'
import { PresetEditorV2 } from './components/PresetEditorV2'
import { CAPABILITIES_FISH, CATALOG_FISH, PRESET_FISH } from './fishFixtures'
import { PERFORMANCE_CAPABILITIES } from './performanceFixtures'
import { clearPreferredLanguageCache } from './hooks/usePreferredLanguage'
import { clearPreviewTextsCache } from './usePreviewTexts'

const api = vi.hoisted(() => ({ getUserProfile: vi.fn(), previewVoice: vi.fn(), previewVoicePerformance: vi.fn(),
    fetchProtectedMediaBlob: vi.fn(), getVoiceCatalogByKeys: vi.fn(), listVoiceCatalog: vi.fn(),
    getVoicePerformanceCapabilities: vi.fn(), listPronunciationDictionaries: vi.fn(), getUserPreferences: vi.fn(), getPreviewTexts: vi.fn() }))
vi.mock('@/infrastructure/api', () => ({ apiService: api, isProtectedMediaUrl: () => false }))
vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))

class Channel {
    static instances = new Set<Channel>()
    onmessage: ((event: { data: unknown }) => void) | null = null
    readonly name: string
    constructor(name: string) { this.name = name; Channel.instances.add(this) }
    postMessage(data: unknown) {
        for (const peer of Channel.instances) if (peer !== this && peer.name === this.name) {
            queueMicrotask(() => { if (Channel.instances.has(peer)) peer.onmessage?.({ data }) })
        }
    }
    close() { Channel.instances.delete(this) }
}

const input: RecipePreviewInput = { voiceKey: CATALOG_FISH.voice_key, provider: 'fish_audio', settings: null,
    emotion: 'calm', language: 'en', textId: 'narration', tier: 'standard' }
let used: number
let credits: number
let block: { promise: Promise<void>; release: () => void } | null
const cache = new Map<string, string>()
const profile = () => ({ membership: { previews_left: 10 - used, limits: { voice_preview: { daily_limit: 10 } } } })
function httpError(status: number, code: string, details: object) { return Object.assign(new Error(code), { status, code, details }) }

async function preview(kind: string, body: Record<string, unknown>): Promise<VoicePresetPreviewResponse> {
    const { max_credit_cost: cap = 0, ...recipe } = body
    const key = `${kind}:${JSON.stringify(recipe)}`
    const cached = cache.has(key)
    const cost = cached || used < 3 ? 0 : 1
    if (!cached && used >= 10) throw httpError(429, 'daily_limit_reached', { previews_left: 0 })
    if (cost > Number(cap)) throw httpError(409, 'preview_credit_confirmation_required', {
        previews_left: 10 - used, free_previews_left: 0, required_credit_cost: 1,
    })
    if (!cached) { used++; credits += cost; cache.set(key, `clip${cache.size}`) }
    const result: VoicePresetPreviewResponse = { cache_key: cache.get(key)!, cached, charged_credits: cost,
        previews_left: 10 - used, free_previews_left: Math.max(0, 3 - used), source: 'render' }
    if (block) await block.promise
    return result
}

beforeEach(() => {
    vi.clearAllMocks()
    resetPreviewCreditConfirmation()
    clearPreferredLanguageCache()
    clearPreviewTextsCache()
    used = 2; credits = 0; block = null; cache.clear()
    vi.stubGlobal('BroadcastChannel', Channel)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
    api.getUserProfile.mockImplementation(async () => profile())
    api.previewVoice.mockImplementation(body => preview('recipe', body))
    api.previewVoicePerformance.mockImplementation(body => preview('authored', body))
    api.fetchProtectedMediaBlob.mockResolvedValue(new Blob(['audio']))
    const voice = { ...CATALOG_FISH, languages: CATALOG_FISH.languages.map(language => ({ ...language, model_ids: ['drama-3'] })) }
    api.getVoiceCatalogByKeys.mockResolvedValue([voice])
    api.listVoiceCatalog.mockResolvedValue({ items: [voice], next_cursor: null })
    api.getVoicePerformanceCapabilities.mockResolvedValue(PERFORMANCE_CAPABILITIES)
    api.listPronunciationDictionaries.mockResolvedValue({ items: [] })
    api.getUserPreferences.mockResolvedValue({ preferred_language: 'en', has_preference: true })
    api.getPreviewTexts.mockRejectedValue(Object.assign(new Error('older server'), { status: 404 }))
})

afterEach(() => { vi.unstubAllGlobals() })

const wrapper = ({ children }: { children: ReactNode }) => <PreviewAllowanceProvider userHash="user-a">{children}</PreviewAllowanceProvider>

it('seeds one shared allowance in the app’s StrictMode lifecycle', async () => {
    const strict = ({ children }: { children: ReactNode }) => <StrictMode>{wrapper({ children })}</StrictMode>
    const { result } = renderHook(() => ({ first: useRecipePreview(), second: useRecipePreview() }), { wrapper: strict })
    await waitFor(() => expect(result.current.first.previewsLeft).toBe(8))
    expect(result.current.second.previewsLeft).toBe(8)
    expect(api.getUserProfile).toHaveBeenCalledTimes(1)
})

function Surface({ name, authored = false }: { name: string; authored?: boolean }) {
    const preview = useRecipePreview()
    return <section aria-label={name}>
        <Button onClick={() => void preview.run({ ...input, ...(authored ? { authoredText: name } : {}) })}>{name}{preview.nextCostsCredit ? ' · 1 credit' : ''}</Button>
        <output>{preview.previewsLeft ?? 'unknown'}</output>
        <PreviewCreditDialog confirm={preview.credit} />
    </section>
}

it('shares the last-free response between the real editor and advanced panel, then confirms exactly one debit', async () => {
    const capabilities = { ...CAPABILITIES_FISH, providers: CAPABILITIES_FISH.providers?.map(provider => ({ ...provider,
        models: [{ model_id: 'drama-3' as const, label: 'Drama 3', settings: [], surfaces: ['preview', 'narration'],
            supports_emotion: true, supports_direction: true, supports_pronunciation: true, supports_scoped_delivery: true }] })) }
    render(<PresetEditorV2 open mode="edit" source={PRESET_FISH} capabilities={capabilities} userHash="user-a"
        onClose={vi.fn()} onSaved={vi.fn()} notify={vi.fn()} />, { wrapper })
    await screen.findByText('Advanced performance')
    await waitFor(() => expect(screen.getAllByText('8 previews left today')).toHaveLength(2))
    fireEvent.click(screen.getByText('Advanced performance'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview neutral' }))
    await waitFor(() => expect(screen.getAllByText('7 previews left today')).toHaveLength(2))
    expect(credits).toBe(0)
    expect(screen.getByRole('button', { name: 'Preview directed · 1 credit' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Preview voice · 1 credit' }))
    let dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
    expect(credits).toBe(0)
    expect(api.previewVoice.mock.lastCall?.[0].max_credit_cost).toBe(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(used).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Preview voice · 1 credit' }))
    dialog = await screen.findByRole('dialog', { name: 'Preview with credits?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(credits).toBe(1))
    await waitFor(() => expect(screen.getAllByText('6 previews left today')).toHaveLength(2))
    expect(api.previewVoice.mock.calls.map(([body]) => body.max_credit_cost)).toEqual([0, 0, 1])
    fireEvent.click(screen.getByRole('button', { name: 'Preview voice · 1 credit' }))
    await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(4))
    expect(credits).toBe(1)
    expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
    used = 10
    fireEvent.focus(window)
    await waitFor(() => expect(screen.getAllByText('Daily preview limit reached. Previews reset tomorrow.')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Preview voice' }))
    await waitFor(() => expect(api.previewVoice).toHaveBeenCalledTimes(5))
    expect(credits).toBe(1)
})

it('also shares the transition from the main preview to an authored comparison', async () => {
    const { result } = renderHook(() => ({ main: useRecipePreview(), advanced: useRecipePreview() }), { wrapper })
    await waitFor(() => expect(result.current.main.previewsLeft).toBe(8))
    await act(() => result.current.main.run(input))
    expect(result.current.advanced.previewsLeft).toBe(7)
    expect(result.current.advanced.usage?.previewsLeft).toBe(7)
    expect(result.current.advanced.nextCostsCredit).toBe(true)
    await act(() => result.current.advanced.run({ ...input, authoredText: 'Directed comparison' }))
    expect(result.current.advanced.credit.open).toBe(true)
    expect(api.previewVoicePerformance.mock.lastCall?.[0].max_credit_cost).toBe(0)
    expect(credits).toBe(0)
})

it('reconciles another tab through invalidation, but the server cap also protects a missed broadcast', async () => {
    render(<><PreviewAllowanceProvider userHash="user-a"><Surface name="Tab A" /></PreviewAllowanceProvider>
        <PreviewAllowanceProvider userHash="user-a"><Surface name="Tab B" authored /></PreviewAllowanceProvider></>)
    const tabA = within(screen.getByRole('region', { name: 'Tab A' }))
    const tabB = within(screen.getByRole('region', { name: 'Tab B' }))
    await waitFor(() => expect(tabA.getByRole('status')).toHaveTextContent('8'))
    fireEvent.click(tabB.getByRole('button', { name: 'Tab B' }))
    await waitFor(() => expect(tabA.getByRole('button', { name: 'Tab A · 1 credit' })).toBeEnabled())
    // A sleeping tab can miss every message and keep an old profile snapshot.
    api.getUserProfile.mockResolvedValue({ membership: { previews_left: 8, limits: { voice_preview: { daily_limit: 10 } } } })
    fireEvent.focus(window)
    await waitFor(() => expect(tabA.getByRole('button', { name: 'Tab A' })).toBeEnabled())
    fireEvent.click(tabA.getByRole('button', { name: 'Tab A' }))
    await screen.findByRole('dialog', { name: 'Preview with credits?' })
    expect(api.previewVoice.mock.lastCall?.[0].max_credit_cost).toBe(0)
    expect(credits).toBe(0)
})

it.each(['late response', 'aborted fetch'])('a stopped last-free render with %s cannot authorize another debit', async mode => {
    const { result } = renderHook(() => ({ first: useRecipePreview(), second: useRecipePreview() }), { wrapper })
    await waitFor(() => expect(result.current.first.previewsLeft).toBe(8))
    let release!: () => void
    block = { promise: new Promise<void>(resolve => { release = resolve }), release: () => release() }
    let server!: Promise<VoicePresetPreviewResponse>
    if (mode === 'aborted fetch') api.previewVoice.mockImplementationOnce((body, { signal }: { signal: AbortSignal }) => {
        server = preview('recipe', body)
        return new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })), { once: true })
            void server.then(resolve, reject)
        })
    })
    let running!: Promise<void>
    act(() => { running = result.current.first.run(input) })
    await waitFor(() => expect(used).toBe(3))
    act(() => result.current.first.stop())
    await act(async () => { block!.release(); await running; if (server) await server })
    block = null
    expect(result.current.first.clip).toBeNull()
    expect(result.current.second.previewsLeft).toBe(7)
    await act(() => result.current.second.run({ ...input, textId: 'dialogue' }))
    expect(result.current.second.credit.open).toBe(true)
    expect(credits).toBe(0)
    act(() => result.current.second.credit.confirm())
    await waitFor(() => expect(credits).toBe(1))
})

it('unknown allowance cannot authorize a paid miss, while an unconfirmed cached replay stays free', async () => {
    const first = renderHook(() => useRecipePreview(), { wrapper })
    await act(() => first.result.current.run(input)) // Last free render is cached.
    first.unmount()
    resetPreviewCreditConfirmation()
    api.getUserProfile.mockRejectedValue(new Error('offline profile'))
    const next = renderHook(() => useRecipePreview(), { wrapper })
    expect(next.result.current.freePreviewsLeft).toBeNull()
    await act(() => next.result.current.run(input))
    expect(next.result.current.clip?.cached).toBe(true)
    expect(next.result.current.credit.open).toBe(false)
    expect(credits).toBe(0)
    await act(() => next.result.current.run({ ...input, textId: 'dialogue' }))
    expect(next.result.current.credit.open).toBe(true)
    expect(credits).toBe(0)
})

it('account changes clear allowance and cannot run another account’s pending authorization', async () => {
    used = 3
    const accountWrapper = ({ children, account }: { children: ReactNode; account: string }) => <PreviewAllowanceProvider userHash={account}>{children}</PreviewAllowanceProvider>
    const { rerender } = render(accountWrapper({ children: <Surface name="Preview" />, account: 'user-a' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Preview · 1 credit' }))
    await screen.findByRole('dialog', { name: 'Preview with credits?' })
    used = 0
    rerender(accountWrapper({ children: <Surface name="Preview" />, account: 'user-b' }))
    await screen.findByRole('button', { name: 'Preview' })
    expect(screen.queryByRole('dialog', { name: 'Preview with credits?' })).not.toBeInTheDocument()
    expect(credits).toBe(0)
    expect(Channel.instances.size).toBe(1)
    expect([...Channel.instances][0].name).toBe(PREVIEW_ALLOWANCE_CHANNEL)
})

it('an older response from another surface cannot restore free renders after a newer response', async () => {
    used = 1
    const { result } = renderHook(() => ({ main: useRecipePreview(), advanced: useRecipePreview() }), { wrapper })
    await waitFor(() => expect(result.current.main.previewsLeft).toBe(9))
    let release!: () => void
    block = { promise: new Promise<void>(resolve => { release = resolve }), release: () => release() }
    let first!: Promise<void>
    act(() => { first = result.current.main.run(input) })
    await waitFor(() => expect(used).toBe(2))
    const pending = block
    block = null
    await act(() => result.current.advanced.run({ ...input, authoredText: 'Last free comparison' }))
    expect(result.current.main.previewsLeft).toBe(7)
    await act(async () => { pending.release(); await first })
    expect(result.current.main.previewsLeft).toBe(7)
    expect(result.current.advanced.nextCostsCredit).toBe(true)
})

it('reconciles same-account storage notifications when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const { result } = renderHook(() => useRecipePreview(), { wrapper })
    await waitFor(() => expect(result.current.previewsLeft).toBe(8))
    used = 3
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: PREVIEW_ALLOWANCE_CHANNEL, newValue: JSON.stringify({ userHash: 'user-b' }) })))
    expect(result.current.previewsLeft).toBe(8)
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: PREVIEW_ALLOWANCE_CHANNEL, newValue: JSON.stringify({ userHash: 'user-a' }) })))
    await waitFor(() => expect(result.current.previewsLeft).toBe(7))
    expect(result.current.nextCostsCredit).toBe(true)
})
