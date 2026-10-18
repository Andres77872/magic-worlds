import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SceneConflictReview, SceneDraftApi } from '../hooks/useSceneDraft'
import { manuscript, storyScene } from '@/test/fixtures/story'
import { i18n } from '@/app/i18n'
import { documentText } from '@/shared/storyDocument'
import { NovelSceneConflictModal } from './NovelSceneConflictModal'
import { reconciliationJournal } from '../persistence/reconciliationJournal'

const download = vi.hoisted(() => vi.fn())
vi.mock('@/utils/download', async (original) => ({ ...await original<typeof import('@/utils/download')>(), downloadBlob: download }))
const review = (patch: Partial<SceneConflictReview> = {}): SceneConflictReview => ({
    id: 'review-one', ownerKey: 'author/workspace/novel/scene', sequence: 2,
    baseDocument: manuscript('The gate stood open.', 'gate'),
    deviceDocument: manuscript('A watchman barred the gate.', 'gate'), deviceTitle: 'The gate',
    account: storyScene({ id: 'scene', storyId: 'novel', title: 'The gate', revision: 2, document: manuscript('Someone had broken the gate.', 'gate') }),
    ...patch,
})
function choose(field: string, option: string) {
    fireEvent.click(screen.getByRole('combobox', { name: field }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}
beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en') })
afterEach(() => { vi.restoreAllMocks() })

it('explains a source rejection without offering an ordinary save or merge of the rejected application',()=>{
    const resolve=vi.fn<SceneDraftApi['resolveConflict']>(()=>true)
    const value=review({applicationRejection:{reason:'sources_changed',generationId:'generation-1',write:{requestId:'accept-1',expectedRevision:1,document:manuscript('Original proposed writing.')}}})
    render(<NovelSceneConflictModal open review={value} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={resolve} />)
    expect(screen.getByRole('heading',{name:'Review an unapplied suggestion'})).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The saved sources or Codex context changed')
    expect(screen.queryByRole('button',{name:'Use device version'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Use reviewed merge'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Keep account writing'}))
    expect(resolve).toHaveBeenCalledExactlyOnceWith('server')
})

it('keeps unsaved review choices open when storage fails and closes after a retained retry', async () => {
    vi.spyOn(reconciliationJournal, 'load').mockResolvedValue({ checkpoint: null, unavailable: false, unreadable: 0 })
    const save = vi.spyOn(reconciliationJournal, 'save').mockResolvedValue('unavailable')
    const close = vi.fn(), checkpoint = vi.fn(), resolve = vi.fn(() => true)
    render(<NovelSceneConflictModal open review={review({ recoveryScope: { apiOrigin: 'https://novel-review-fixture.example', userHash: 'close-failure', workspaceId: 'desk' } })}
        onCheckpointState={checkpoint} onClose={close} onRefresh={vi.fn()} onResolve={resolve} />)
    await waitFor(() => { expect(screen.getByRole('combobox', { name: 'Block 1' })).toBeEnabled() })
    choose('Block 1', 'Device version')
    await screen.findByRole('alert')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Close$/ })) })
    expect(close).not.toHaveBeenCalled()
    expect(checkpoint).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('combobox', { name: 'Block 1' })).toHaveTextContent('Device version')
    fireEvent.click(screen.getByRole('button', { name: 'Download review and choices' }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'The-gate.review.json')
    save.mockResolvedValue('saved')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Close$/ })) })
    await waitFor(() => { expect(close).toHaveBeenCalledTimes(1) })
    expect(checkpoint).toHaveBeenLastCalledWith(true)
    expect(resolve).not.toHaveBeenCalled()
})

it('requires explicit conflicting-block choices and applies only the reviewed canonical candidate', () => {
    const resolve = vi.fn<SceneDraftApi['resolveConflict']>(() => true)
    render(<NovelSceneConflictModal open review={review()} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={resolve} />)
    const apply = screen.getByRole('button', { name: 'Use reviewed merge' })
    expect(apply).toBeDisabled()
    choose('Block 1', 'Device version')
    expect(apply).toBeEnabled()
    fireEvent.click(apply)
    expect(resolve).toHaveBeenCalledWith('merge', { title: 'The gate', document: manuscript('A watchman barred the gate.', 'gate') })
    expect(screen.getByRole('dialog')).toHaveTextContent('A separate device copy is retained first')
})

it('keeps independent changes from both versions in the visible rich-text preview', () => {
    const base = manuscript('The gate stood open.', 'gate')
    base.content.content!.push(...manuscript('A letter waited.', 'letter').content.content!)
    const device = structuredClone(base), account = structuredClone(base)
    device.content.content![0].content![0] = { type: 'text', text: 'The gate was barred.', marks: [{ type: 'bold' }] }
    account.content.content![1].content![0] = { type: 'text', text: 'The letter was gone.', marks: [{ type: 'highlight' }] }
    const resolve = vi.fn<SceneDraftApi['resolveConflict']>(() => true)
    render(<NovelSceneConflictModal open review={review({ baseDocument: base, deviceDocument: device, account: storyScene({ title: 'The gate', document: account }) })} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={resolve} />)
    expect(screen.queryByRole('combobox', { name: 'Block 1' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Use reviewed merge' }))
    expect(documentText(resolve.mock.calls[0][1]!.document)).toBe('The gate was barred.\n\nThe letter was gone.')
    expect(document.body.querySelectorAll('strong').length).toBeGreaterThan(0)
    expect(document.body.querySelectorAll('mark').length).toBeGreaterThan(0)
})

it('requires deliberate reading-order and title choices when both are ambiguous', () => {
    const first = manuscript('First.', 'first').content.content![0], second = manuscript('Second.', 'second').content.content![0], third = manuscript('Third.', 'third').content.content![0]
    const base = { schemaVersion: 1 as const, content: { type: 'doc', content: [first, second, third] } }
    const device = { schemaVersion: 1 as const, content: { type: 'doc', content: [third, first, second] } }
    const account = { schemaVersion: 1 as const, content: { type: 'doc', content: [second, first, third] } }
    const resolve = vi.fn<SceneDraftApi['resolveConflict']>(() => true)
    render(<NovelSceneConflictModal open review={review({ baseDocument: base, deviceDocument: device, deviceTitle: 'Device title', account: storyScene({ title: 'Account title', document: account }) })} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={resolve} />)
    expect(screen.getByRole('button', { name: 'Use reviewed merge' })).toBeDisabled()
    choose('Reading order', 'Device version'); choose('Scene title', 'Account version: Account title')
    fireEvent.click(screen.getByRole('button', { name: 'Use reviewed merge' }))
    expect(resolve).toHaveBeenCalledWith('merge', { document: device, title: 'Account title' })
})

it('keeps review choices when closed/reopened against the same source and resets them for a new review', () => {
    const props = { review: review(), onClose: vi.fn(), onRefresh: vi.fn(), onResolve: vi.fn(() => true) }
    const view = render(<NovelSceneConflictModal open {...props} />)
    choose('Block 1', 'Device version')
    view.rerender(<NovelSceneConflictModal open={false} {...props} />)
    view.rerender(<NovelSceneConflictModal open {...props} />)
    expect(screen.getByRole('button', { name: 'Use reviewed merge' })).toBeEnabled()
    view.rerender(<NovelSceneConflictModal open {...props} review={review({ id: 'fresh-source' })} />)
    expect(screen.getByRole('button', { name: 'Use reviewed merge' })).toBeDisabled()
})

it('blocks stale and archived choices while retaining source download and comparison refresh', async () => {
    const resolve = vi.fn<SceneDraftApi['resolveConflict']>(() => true), refresh = vi.fn(async () => {})
    render(<NovelSceneConflictModal open stale readOnly review={review()} onClose={vi.fn()} onRefresh={refresh} onResolve={resolve} />)
    expect(screen.getByRole('button', { name: 'Use device version' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Use account version' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Download device version' }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'The-gate.device-draft.json')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh comparison' })) })
    expect(refresh).toHaveBeenCalledTimes(1); expect(resolve).not.toHaveBeenCalled()
})

it('shows retention failure without claiming the device copy or merge succeeded', () => {
    const resolve = vi.fn<SceneDraftApi['resolveConflict']>(() => false)
    render(<NovelSceneConflictModal open retentionFailed review={review()} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={resolve} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use account version' }))
    expect(screen.getByRole('alert')).toHaveTextContent('this choice was not applied')
    expect(screen.getByRole('dialog')).toBeVisible()
})

it('offers both full versions when the original base is unavailable and never infers an automatic merge', () => {
    render(<NovelSceneConflictModal open review={review({ baseDocument: null })} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={vi.fn(() => true)} />)
    expect(screen.getByRole('dialog')).toHaveTextContent('no automatic merge is inferred')
    expect(screen.getByRole('button', { name: 'Use reviewed merge' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Use device version' })).toBeEnabled()
})

it('localizes the review and choices in Spanish', async () => {
    await i18n.changeLanguage('es')
    render(<NovelSceneConflictModal open review={review()} onClose={vi.fn()} onRefresh={vi.fn()} onResolve={vi.fn(() => true)} />)
    expect(screen.getByRole('dialog', { name: 'Conciliar el texto del dispositivo y la cuenta' })).toBeVisible()
    choose('Bloque 1', 'Versión de la cuenta')
    expect(screen.getByRole('button', { name: 'Usar combinación revisada' })).toBeEnabled()
    await i18n.changeLanguage('en')
})
