import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { authSession } from '@/infrastructure/api/authSession'
import type { NavigationInterceptor } from '@/app/providers/NavigationProvider'
import { Button, Callout, Drawer, Field, Input, Textarea } from '@/ui/primitives'
import { documentMarkdown } from '@/shared/storyDocument'
import type { AccountStorageScope } from '@/shared/workspaceStorage'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { downloadBlob, safeFilename } from '@/utils/download'
import { deviceCacheScope, studioReadStorage, validCachedNovel, type CachedNovelRead, type CachedSceneRead, type DeviceCacheList, type StudioReadStorage } from '../persistence/studioReadStorage'
import { useSceneDraft } from '../hooks/useSceneDraft'
import { useBrowserConnectivity } from '../hooks/useBrowserConnectivity'
import type { StoryWorkspace } from '../hooks/useStoryWorkspace'
import { NovelEditor } from '../editor/NovelEditor'
import type { NovelEditorHandle } from '../editor/types'
import { NovelRetainedSceneDrafts } from './NovelRetainedSceneDrafts'
import { NovelSavedSceneReviews } from './NovelSavedSceneReview'
import { NovelOfflineAppCopy } from './NovelOfflineAppCopy'
import { NovelPrivateAuthorVersions } from './NovelPrivateAuthorVersions'
import type { RetainedAuthorVariant } from '../persistence/authorVariantJournal'
import { newestCachedWorkspace, type CachedWorkspace } from '../persistence/deviceWorkspaceStorage'
import { useDeviceWorkspaceStates } from '../hooks/useDeviceWorkspaceStates'
import { useDeviceNovelState } from '../hooks/useDeviceNovelState'
import { deviceSceneReadOnly, mergeNovelLifecycle, novelLifecycleObservation } from '../persistence/novelDeviceLifecycle'

export function NovelDeviceLibrary({ showEntry = true }: { showEntry?: boolean }) {
    const auth = useAuth(), workspace = useContext(WorkspaceContext), data = useData(), navigation = useNavigation()
    if (!auth.userHash || !auth.isAuthenticated || auth.sessionPhase !== 'authenticated') return null
    const userHash = auth.userHash, accountKey = auth.accountKey
    const current = () => {
        const live = authSession.getSnapshot()
        return live.userHash === userHash && live.accountKey === accountKey && live.sessionPhase === 'authenticated'
    }
    return <NovelDeviceLibraryView key={accountKey} showEntry={showEntry} scope={deviceCacheScope(userHash)} current={current} lifecycleRetentionFailed={data.novelLifecycleStorageFailed}
        allWorkspaces registerNavigationInterceptor={navigation.registerNavigationInterceptor}
        canOpenAccount={(copy) => workspace?.status === 'ready' && workspace.selectedWorkspaceId === copy.workspace.id}
        canOpenAuthorAccount={(item) => workspace?.status === 'ready' && workspace.selectedWorkspaceId === item.scope.workspaceId}
        onOpenAuthorAccount={async (item) => {
            const captured = workspace?.capture()
            if (!current() || !captured || !workspace || captured.workspaceId !== item.scope.workspaceId) throw new Error('Select the writing workspace first')
            await workspace.refreshWorkspaces()
            if (!current() || !workspace.isCurrent(captured)) throw new Error('The writing workspace changed')
            await data.openStory({ id: item.record.write.storyId }, item.record.write.context.parent.parent.sceneId)
            if (!current() || !workspace.isCurrent(captured)) throw new Error('The writing workspace changed')
        }}
        onAuthorAccountOpened={(item) => { if (current() && workspace?.capture()?.workspaceId === item.scope.workspaceId) navigation.setPage('story') }}
        onOpenAccount={async (copy, sceneId) => {
            const captured = workspace?.capture()
            if (!current() || !captured || captured.workspaceId !== copy.workspace.id || !workspace) throw new Error('Select the writing workspace first')
            await workspace.refreshWorkspaces()
            if (!current() || !workspace.isCurrent(captured)) throw new Error('The writing workspace changed')
            await data.openStory({ id: copy.index.id }, sceneId)
            if (!current() || !workspace.isCurrent(captured)) throw new Error('The writing workspace changed')
        }}
        onAccountOpened={(copy) => { if (current() && workspace?.capture()?.workspaceId === copy.workspace.id) navigation.setPage('story') }} />
}

export interface NovelDeviceLibraryViewProps {
    scope: AccountStorageScope
    current: () => boolean
    store?: StudioReadStorage
    showEntry?: boolean
    initialOpen?: boolean
    allWorkspaces?: boolean
    lifecycleRetentionFailed?: boolean
    canOpenAccount?: (copy: CachedNovelRead) => boolean
    onOpenAccount?: (copy: CachedNovelRead, sceneId: string) => Promise<void>
    onAccountOpened?: (copy: CachedNovelRead) => void
    canOpenAuthorAccount?: (item: RetainedAuthorVariant) => boolean
    onOpenAuthorAccount?: (item: RetainedAuthorVariant) => Promise<void>
    onAuthorAccountOpened?: (item: RetainedAuthorVariant) => void
    registerNavigationInterceptor?: (interceptor: NavigationInterceptor) => () => void
}
interface Selection { copy: CachedNovelRead; scene: CachedSceneRead }

/** Explicit local surface. Its selection never commits a workspace or populates account state. */
export function NovelDeviceLibraryView({ scope, current, store = studioReadStorage, showEntry = true, initialOpen = false, allWorkspaces = true, lifecycleRetentionFailed = false,
    canOpenAccount, onOpenAccount, onAccountOpened, canOpenAuthorAccount, onOpenAuthorAccount, onAuthorAccountOpened, registerNavigationInterceptor }: NovelDeviceLibraryViewProps) {
    const { t } = useTranslation(), text = (key: string, options?: Record<string, unknown>) => t('novelEditor.deviceCache.' + key, options)
    const [open, setOpen] = useState(initialOpen), [selected, setSelected] = useState<Selection | null>(null)
    const [list, setList] = useState<DeviceCacheList | null>(null), [leaveFailed, setLeaveFailed] = useState(false)
    const [opening, setOpening] = useState(false), [accountFailed, setAccountFailed] = useState(false)
    const guard = useRef<() => boolean>(() => true), mounted = useRef(true), live = useRef({ current, scope, erased: false })
    const drawerBody = useRef<HTMLDivElement>(null), previousSelection = useRef<string | null>(null)
    const reviewSafe = useRef(true), reviewState = useCallback((safe: boolean) => { reviewSafe.current = safe }, [])
    const registerGuard = useCallback((check: () => boolean) => {
        guard.current = check
        return () => { if (guard.current === check) guard.current = () => true }
    }, [])
    const online = useBrowserConnectivity(), scopeKey = JSON.stringify(scope)
    const lifecycle = useDeviceWorkspaceStates(scope, current, open)
    const novelLifecycle = useDeviceNovelState(selected ? { ...scope, workspaceId: selected.copy.workspace.id, storyId: selected.copy.index.id } : null, current)
    const selectedLifecycle = useMemo(() => {
        if (!selected) return null
        const earlier = novelLifecycleObservation(selected.scene.source, selected.copy.workspace.id)
        const latest = novelLifecycleObservation(selected.copy.index, selected.copy.workspace.id)
        const base = latest ? mergeNovelLifecycle(earlier, latest) : earlier
        return novelLifecycle.data?.state ? mergeNovelLifecycle(base, novelLifecycle.data.state) : base
    }, [selected, novelLifecycle.data])
    useLayoutEffect(() => { live.current = { current, scope, erased: Boolean(selectedLifecycle?.erased) } })
    useLayoutEffect(() => {
        const next = selected ? selected.copy.key + ':' + selected.scene.read.scene.id : null
        if (!next && previousSelection.current) Array.from(drawerBody.current?.querySelectorAll<HTMLButtonElement>('button[data-device-scene]') ?? [])
            .find((button) => button.dataset.deviceScene === previousSelection.current)?.focus()
        previousSelection.current = next
    }, [selected])
    useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
    useEffect(() => {
        if (!open) return
        let active = true, serial = 0
        const refresh = async () => {
            const ticket = ++serial, result = await store.list(scope)
            if (active && ticket === serial && live.current.current() && JSON.stringify(live.current.scope) === scopeKey) setList(result)
        }
        void refresh()
        const unsubscribe = store.subscribe(() => { void refresh() })
        return () => { active = false; unsubscribe() }
    }, [open, scope, scopeKey, store])
    const preserve = () => {
        if (!current()) return false
        const saved = guard.current() && reviewSafe.current
        setLeaveFailed(!saved)
        return saved
    }
    useEffect(() => {
        if (!open || !registerNavigationInterceptor) return
        return registerNavigationInterceptor((_proceed, cancel) => {
            if (!live.current.current() || !guard.current() || !reviewSafe.current) { setLeaveFailed(true); cancel?.(); return true }
            return false
        })
    }, [open, registerNavigationInterceptor])
    const close = () => { if (preserve()) { setOpen(false); setSelected(null); setAccountFailed(false) } }
    const workspaceFor = (copy: CachedNovelRead) => {
        const saved = list?.workspaceStates?.[copy.workspace.id], live = lifecycle.data?.states[copy.workspace.id]
        const known = saved ? newestCachedWorkspace(copy.workspace, saved) : copy.workspace
        return live ? newestCachedWorkspace(known, live) : known
    }
    const items = (list?.items ?? []).filter((item) => validCachedNovel(item, scope) && (allWorkspaces || workspaceFor(item).isDefault))
    const selectedWorkspace = selected ? workspaceFor(selected.copy) : null
    const workspaceUnverified = Boolean(selected && (lifecycle.loading || lifecycle.data?.unavailable
        || list?.workspaceUnreadableIds?.includes(selected.copy.workspace.id) || lifecycle.data?.unreadableIds.includes(selected.copy.workspace.id)))
    const novelReadOnly = selected ? deviceSceneReadOnly(selectedLifecycle, selected.scene.read.scene.id) : null
    const erased = Boolean(selectedLifecycle?.erased)
    const novelUnverified = Boolean(selected && (lifecycleRetentionFailed || novelLifecycle.loading || novelLifecycle.data?.unavailable || novelLifecycle.data?.unreadable || novelReadOnly === null))
    const choose = (copy: CachedNovelRead, scene: CachedSceneRead) => {
        if (!preserve()) return
        setSelected(structuredClone({ copy, scene })); setAccountFailed(false)
    }
    const enterAccount = async () => {
        if (!selected || erased || !onOpenAccount || !online || !canOpenAccount?.(selected.copy) || !preserve() || opening) return
        const captured = selected
        setOpening(true); setAccountFailed(false)
        try {
            await onOpenAccount(captured.copy, captured.scene.read.scene.id)
            if (!mounted.current || !current() || !preserve() || live.current.erased) return
            setOpen(false); setSelected(null); onAccountOpened?.(captured.copy)
        } catch { if (mounted.current && current()) setAccountFailed(true) }
        finally { if (mounted.current && current()) setOpening(false) }
    }
    return <>
        {showEntry && <div className="px-4 py-2"><Button size="sm" variant="secondary" onClick={() => { if (current()) setOpen(true) }}>{text('entry')}</Button></div>}
        <Drawer bodyRef={drawerBody} open={open} onClose={close} title={text('title')} size="2xl" footer={<>
            {selected && <Button variant="ghost" disabled={opening} onClick={() => { if (preserve()) { setSelected(null); setAccountFailed(false) } }}>{text('back')}</Button>}
            {selected && <Button disabled={erased || opening || !online || !canOpenAccount?.(selected.copy)} onClick={() => void enterAccount()}>{text(opening ? 'opening' : 'account')}</Button>}
        </>}>
            <div className="space-y-4">
                <p className="text-body text-parchment-200">{text('help')}</p>
                {lifecycleRetentionFailed && <Callout tone="warning" role="status">{text('lifecycleRetentionFailed')}</Callout>}
                {leaveFailed && <Callout tone="warning" role="alert">{text('checkpointFailed')}</Callout>}
                {accountFailed && <Callout tone="warning" role="alert">{text('accountFailed')}</Callout>}
                {selected ? <>
                    <p className="text-caption text-parchment-300">{text('novel', { title: selected.copy.index.title, workspace: selectedWorkspace!.name })}</p>
                    <DeviceSceneEditor key={selected.copy.key + ':' + selected.scene.read.scene.id} selected={selected} cachedWorkspace={selectedWorkspace!} workspaceUnverified={workspaceUnverified} novelReadOnly={Boolean(novelReadOnly)} novelUnverified={novelUnverified} current={current} registerGuard={registerGuard} leaveFailed={leaveFailed} />
                    <p className="text-caption text-parchment-300">{text(erased ? 'erasedHelp' : 'accountHelp')}</p>
                </> : <>
                    {open && <NovelOfflineAppCopy />}
                    <NovelSavedSceneReviews scope={scope} current={current} allWorkspaces={allWorkspaces} onCheckpointState={reviewState} />
                    <NovelPrivateAuthorVersions scope={scope} current={current} allWorkspaces={allWorkspaces} lifecycleRetentionFailed={lifecycleRetentionFailed}
                        registerGuard={registerGuard} canOpenAccount={canOpenAuthorAccount}
                        onOpenAccount={onOpenAuthorAccount ? async item => { if (!preserve()) throw new Error('Device recovery must be retained first'); await onOpenAuthorAccount(item) } : undefined}
                        onAccountOpened={item => { if (preserve()) { setOpen(false); onAuthorAccountOpened?.(item) } }} />
                    {!list && <p role="status">{text('loading')}</p>}
                    {list?.unavailable && <Callout tone="warning" role="alert">{text('unavailable')}</Callout>}
                    {Boolean(list?.unreadable) && <Callout tone="warning" role="status">{text('unreadable', { count: list!.unreadable })}</Callout>}
                    {list && !list.unavailable && !items.length && <p role="status">{text('empty')}</p>}
                    {list && !list.unavailable && <p className="text-caption text-parchment-300">{text('stored', { used: (list.bytes / (1024 * 1024)).toFixed(1) })}</p>}
                    {items.map((copy) => {
                        const heads = copy.index.chapters.flatMap((chapter) => chapter.scenes)
                        const ids = new Set(heads.map((head) => head.id)), extra = Object.values(copy.scenes).filter((scene) => !ids.has(scene.read.scene.id))
                        return <section key={copy.key} className="space-y-3 rounded-lg border border-parchment-50/10 bg-ink-700 p-4">
                            <h3 className="font-display text-h3">{text('novel', { title: copy.index.title, workspace: workspaceFor(copy).name })}</h3>
                            <p className="text-caption text-parchment-300">{text('scenes', { count: Object.keys(copy.scenes).length })}</p>
                            {copy.index.chapters.map((chapter) => <section key={chapter.id} className="space-y-2">
                                <h4 className="font-ui text-label">{chapter.title}</h4>
                                <ul className="space-y-2">{chapter.scenes.map((head) => <li key={head.id}>
                                    <Button data-device-scene={copy.key + ':' + head.id} variant="secondary" size="sm" disabled={!copy.scenes[head.id]} onClick={() => choose(copy, copy.scenes[head.id])}>
                                        {copy.scenes[head.id] ? text('scene', { title: head.title, revision: copy.scenes[head.id].read.scene.revision }) : head.title + ' · ' + text('notCached')}
                                    </Button>
                                </li>)}</ul>
                            </section>)}
                            {extra.length > 0 && <section className="space-y-2"><h4 className="font-ui text-label">{text('extra')}</h4><p className="text-caption text-parchment-300">{text('extraHelp')}</p>
                                {extra.map((scene) => <Button key={scene.read.scene.id} data-device-scene={copy.key + ':' + scene.read.scene.id} variant="secondary" size="sm" onClick={() => choose(copy, scene)}>{text('scene', { title: scene.read.scene.title, revision: scene.read.scene.revision })}</Button>)}
                            </section>}
                        </section>
                    })}
                </>}
            </div>
        </Drawer>
    </>
}

function DeviceSceneEditor({ selected, cachedWorkspace, workspaceUnverified, novelReadOnly, novelUnverified, current, registerGuard, leaveFailed }: {
    selected: Selection; cachedWorkspace: CachedWorkspace; workspaceUnverified: boolean; current: () => boolean;
    novelReadOnly: boolean; novelUnverified: boolean;
    registerGuard: (check: () => boolean) => () => void; leaveFailed: boolean;
}) {
    const { t } = useTranslation(), text = (key: string, options?: Record<string, unknown>) => t('novelEditor.deviceCache.' + key, options)
    const workspace = useMemo<StoryWorkspace>(() => ({ workspaceId: selected.copy.workspace.id, deviceOnly: true, isCurrent: current, detachedApi: () => null }), [selected, current])
    const heading = useRef<HTMLHeadingElement>(null)
    const editor = useRef<NovelEditorHandle>(null)
    useLayoutEffect(() => { heading.current?.focus() }, [])
    const knownReadOnly = useWorkspaceReadOnly(selected.copy.workspace.id)
    const readOnly = knownReadOnly || cachedWorkspace.archived || workspaceUnverified || novelReadOnly || novelUnverified
    const draft = useSceneDraft({ storyId: selected.copy.index.id, scene: selected.scene.read.scene, workspace, blocked: readOnly })
    const [showCopy, setShowCopy] = useState(false), [copied, setCopied] = useState<'yes' | 'failed' | null>(null), [checkpointFailed, setCheckpointFailed] = useState(false)
    useLayoutEffect(() => registerGuard(draft.preserveLocal), [draft.preserveLocal, registerGuard])
    const source = draft.recovery?.document ?? draft.document, title = draft.recovery?.title ?? draft.title
    const titleError = !draft.title.trim() ? 'blank' : [...draft.title.trim()].length > 255 ? 'tooLong' : draft.titleError
    const copy = async () => {
        try { await navigator.clipboard.writeText(documentMarkdown(source)); if (current()) setCopied('yes') }
        catch { if (current()) { setCopied('failed'); setShowCopy(true) } }
    }
    return <div className="space-y-4">
        <h3 ref={heading} tabIndex={-1} className="font-display text-h3">{draft.title}</h3>
        <Callout tone="warning"><strong>{text('local')}</strong><p>{text('localHelp')}</p></Callout>
        {readOnly && <Callout role="status">{text(workspaceUnverified ? 'workspaceUnverified' : novelUnverified ? 'novelUnverified' : 'readonly')}</Callout>}
        {draft.recovery && <Callout tone="warning" role="status"><p>{text(readOnly ? 'recoveryReadOnly' : 'recovery')}</p>
            {draft.recovery.pendingInvalid && <p>{t('novelEditor.offline.unsupportedRequest')}</p>}
            <Button size="sm" disabled={draft.recovery.pendingInvalid} onClick={() => {
                const trigger = document.activeElement
                draft.resumeRecovery()
                requestAnimationFrame(() => { if (current() && (document.activeElement === trigger || document.activeElement === document.body)) editor.current?.focus() })
            }}>{text(readOnly ? 'inspect' : 'resume')}</Button>
        </Callout>}
        {!leaveFailed && (draft.storageFailed || checkpointFailed) && <Callout tone="warning" role="alert">{text('checkpointFailed')}</Callout>}
        <Field label={text('titleField')} error={titleError ? t('novelEditor.recovery.title_' + titleError) : undefined}>
            <Input value={draft.title} disabled={Boolean(draft.recovery) || readOnly} onChange={(event) => draft.setTitle(event.target.value)} />
        </Field>
        <NovelEditor ref={editor} key={draft.contentKey} initialDocument={draft.document} codexEntries={[]} aiDisabled readOnly={readOnly || Boolean(draft.recovery)}
            manuscriptLanguage={selected.copy.index.details.language} onDocumentChange={draft.onDocumentChange}
            onRequestSaveFlush={async () => false} onGenerate={async () => { throw new Error('Account AI is paused in device writing') }}
            onAcceptGeneration={async () => {}} onDiscardGeneration={async () => {}} onCritiqueResult={() => {}} />
        <p role="status" className="text-caption text-parchment-200">{draft.localSaved ? text(readOnly ? 'checkpointReadOnly' : 'checkpointSaved') : draft.saveState === 'offline' ? text('checkpointPending') : text('cached', { revision: selected.scene.read.scene.revision })}</p>
        <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCheckpointFailed(!draft.preserveLocal())}>{text('checkpoint')}</Button>
            <Button variant="secondary" size="sm" onClick={() => void copy()}>{text('copy')}</Button>
            <Button variant="secondary" size="sm" onClick={() => {
                const value = { schema: 'novel-device-draft-v1', title, document: source, baseRevision: draft.recovery?.baseRevision ?? draft.getRevision(),
                    baseMetadataRevision: draft.recovery?.baseMetadataRevision ?? selected.scene.read.scene.metadataRevision }
                downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), safeFilename(title, 'device-draft') + '.device-draft.json')
            }}>{text('download')}</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCopy((value) => !value)}>{text('show')}</Button>
        </div>
        {copied && <p role="status">{text(copied === 'yes' ? 'copied' : 'copyFailed')}</p>}
        {showCopy && <Field label={text('copyable')}><Textarea readOnly rows={8} value={documentMarkdown(source)} /></Field>}
        <NovelRetainedSceneDrafts items={draft.retainedDrafts} unavailable={draft.retainedDraftsUnavailable} />
    </div>
}
