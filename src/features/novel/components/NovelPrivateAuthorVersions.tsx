import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountStorageScope } from '@/shared/workspaceStorage'
import { Button, Callout, Card, Field, Input } from '@/ui/primitives'
import { Markdown } from '@/ui/components/Markdown'
import { downloadBlob, safeFilename } from '@/utils/download'
import { documentMarkdown } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'
import { NovelEditor } from '../editor/NovelEditor'
import { useRetainedAuthorVariants } from '../hooks/useRetainedAuthorVariants'
import { useDeviceAuthorVariant } from '../hooks/useDeviceAuthorVariant'
import { useDeviceWorkspaceStates } from '../hooks/useDeviceWorkspaceStates'
import { useDeviceNovelState } from '../hooks/useDeviceNovelState'
import { useBrowserConnectivity } from '../hooks/useBrowserConnectivity'
import { deviceSceneReadOnly } from '../persistence/novelDeviceLifecycle'
import { hasPrivateAuthorVariant, readRetainedAuthorVariant, readRetainedAuthorVariantRaw, retainedAuthorVariantTarget, type RetainedAuthorVariant } from '../persistence/authorVariantJournal'

export interface PrivateAuthorVersionsHandle { preserve: () => boolean }
export interface PrivateAuthorVersionsProps {
    ref?: Ref<PrivateAuthorVersionsHandle>
    scope: AccountStorageScope; current: () => boolean; allWorkspaces?: boolean
    storyId?: string; workspaceId?: string; lifecycleRetentionFailed?: boolean
    registerGuard?: (guard: () => boolean) => () => void
    canOpenAccount?: (item: RetainedAuthorVariant) => boolean
    onOpenAccount?: (item: RetainedAuthorVariant) => Promise<void>
    onAccountOpened?: (item: RetainedAuthorVariant) => void
    onResumeInStudio?: (item: RetainedAuthorVariant) => boolean
}
const noGeneration = async () => { throw new Error('Private device writing has no model client') }
const noEffect = async () => {}
const editorProps = { codexEntries: [], detectionNames: [], aiDisabled: true,
    onGenerate: noGeneration, onAcceptGeneration: noEffect, onDiscardGeneration: noEffect,
    onCritiqueResult: () => {}, onRequestSaveFlush: async () => false }

export function NovelPrivateAuthorVersions({ ref, scope, current, allWorkspaces = true, storyId, workspaceId, lifecycleRetentionFailed,
    registerGuard, canOpenAccount, onOpenAccount, onAccountOpened, onResumeInStudio }: PrivateAuthorVersionsProps) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.variants.device.' + key, values)
    const result = useRetainedAuthorVariants(scope, current), workspaces = useDeviceWorkspaceStates(scope, current)
    const [opened, setOpened] = useState<RetainedAuthorVariant | null>(null), [failed, setFailed] = useState(false)
    const guard = useRef<() => boolean>(() => true), heading = useRef<HTMLHeadingElement>(null)
    const preserve = useCallback(() => current() && guard.current(), [current])
    useImperativeHandle(ref, () => ({ preserve }), [preserve])
    useLayoutEffect(() => registerGuard?.(preserve), [registerGuard, preserve])
    const attach = useCallback((check: () => boolean) => { guard.current = check; return () => { if (guard.current === check) guard.current = () => true } }, [])
    const visible = (item: RetainedAuthorVariant) => hasPrivateAuthorVariant(item.record.write)
        && (!storyId || item.record.write.storyId === storyId) && (!workspaceId || item.scope.workspaceId === workspaceId)
        && (allWorkspaces || (workspaces.data?.states[item.scope.workspaceId]?.isDefault ?? item.record.write.isDefaultWorkspace) === true)
    const items = result?.items.filter(visible) ?? []
    const selected = opened?.scope.apiOrigin === scope.apiOrigin && opened.scope.userHash === scope.userHash && visible(opened) ? opened : null
    const unreadable = result?.unreadableKeys.filter(key => {
        const target = retainedAuthorVariantTarget(key, scope)
        return target && (!storyId || target.storyId === storyId) && (!workspaceId || target.scope.workspaceId === workspaceId)
            && (allWorkspaces || workspaces.data?.states[target.scope.workspaceId]?.isDefault === true)
    }) ?? []
    const inspect = (item: RetainedAuthorVariant) => {
        if (!preserve()) { setFailed(true); return }
        const exact = item.record.storageKey ? readRetainedAuthorVariant(item.record.storageKey, scope) : null
        if (!exact) { setFailed(true); return }
        setOpened(structuredClone(exact)); setFailed(false)
    }
    const back = () => {
        if (!preserve()) { setFailed(true); return }
        setOpened(null); setFailed(false)
        requestAnimationFrame(() => { if (current()) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }) } })
    }
    if (!current()) return null
    return <section aria-label={text('title')} className="min-w-0 space-y-3 rounded-lg border border-parchment-50/10 bg-ink-700 p-4">
        <h3 ref={heading} tabIndex={-1} className="font-display text-h3">{text('title')}</h3>
        <p className="text-body text-parchment-200">{text('help')}</p>
        {failed && <Callout role="alert" tone="warning">{text('changed')}</Callout>}
        {result?.unavailable && <Callout role="status" tone="warning">{text('unavailable')}</Callout>}
        {unreadable.length > 0 && <Callout tone="warning"><p>{text('unreadable')}</p>
            <div className="flex flex-wrap gap-2">{unreadable.map((key, index) => <Button key={key} size="sm" variant="secondary" onClick={() => {
                if (!current()) return
                const raw = readRetainedAuthorVariantRaw(key, scope)
                if (raw === null) { setFailed(true); return }
                // A JSON string preserves even malformed UTF-16 losslessly when
                // the diagnostic file is encoded to UTF-8 by the browser.
                try { downloadBlob(new Blob([JSON.stringify({ schema: 1, kind: 'unverified_private_version', storageKey: key, raw }, null, 2)], { type: 'application/json' }), `private-version-recovery-${index + 1}.json`) } catch { setFailed(true) }
            }}>{text('downloadUnreadable', { number: index + 1 })}</Button>)}</div>
        </Callout>}
        {selected ? <DeviceAuthorVersion key={selected.record.storageKey} item={selected} current={current} attach={attach}
            workspace={workspaces.data?.states[selected.scope.workspaceId] ?? null}
            workspaceUnknown={workspaces.loading || Boolean(workspaces.data?.unavailable || workspaces.data?.unreadableIds.includes(selected.scope.workspaceId))}
            lifecycleRetentionFailed={Boolean(lifecycleRetentionFailed)} onBack={back}
            canOpenAccount={canOpenAccount} onOpenAccount={onOpenAccount} onAccountOpened={onAccountOpened} onResumeInStudio={onResumeInStudio} />
            : <>
                {items.length === 0 && !result?.unavailable && <p className="text-caption text-parchment-300">{text('empty')}</p>}
                {items.map(item => <Card key={item.record.storageKey} className="flex min-w-0 flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1"><p className="break-words font-ui text-label">{item.record.write.title || t('novelEditor.variants.unnamedDraft')}</p>
                        <p className="break-words text-caption text-parchment-300">{text('scene', { title: item.record.write.context.sceneTitle || text('unknownScene'), revision: item.record.write.context.parent.parent.baseRevision })}</p>
                        {item.record.write.pending && <p className="text-caption text-parchment-300">{text('pending')}</p>}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => inspect(item)}>{text('inspect')}</Button>
                </Card>)}
            </>}
    </section>
}

function DeviceAuthorVersion({ item, current, attach, workspace, workspaceUnknown, lifecycleRetentionFailed, onBack,
    canOpenAccount, onOpenAccount, onAccountOpened, onResumeInStudio }: {
    item: RetainedAuthorVariant; current: () => boolean; attach: (check: () => boolean) => () => void
    workspace: import('../persistence/deviceWorkspaceStorage').CachedWorkspace | null; workspaceUnknown: boolean; lifecycleRetentionFailed: boolean; onBack: () => void
    canOpenAccount?: PrivateAuthorVersionsProps['canOpenAccount']; onOpenAccount?: PrivateAuthorVersionsProps['onOpenAccount']
    onAccountOpened?: PrivateAuthorVersionsProps['onAccountOpened']; onResumeInStudio?: PrivateAuthorVersionsProps['onResumeInStudio']
}) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.variants.device.' + key, values)
    const lifecycle = useDeviceNovelState({ ...item.scope, storyId: item.record.write.storyId }, current)
    const sceneReadOnly = deviceSceneReadOnly(lifecycle.data?.state ?? null, item.record.write.context.parent.parent.sceneId)
    const readOnly = workspaceUnknown || !workspace || workspace.archived || lifecycleRetentionFailed || lifecycle.loading
        || Boolean(lifecycle.data?.unavailable || lifecycle.data?.unreadable) || sceneReadOnly !== false
    const model = useDeviceAuthorVariant(item, current, readOnly), draft = model.draft
    const online = useBrowserConnectivity()
    const [original, setOriginal] = useState(false), [base, setBase] = useState(false), [working, setWorking] = useState(false), [failed, setFailed] = useState(false)
    const heading = useRef<HTMLHeadingElement>(null), mounted = useRef(true), live = useRef({ item, current, erased: false })
    useLayoutEffect(() => { live.current = { item, current, erased: Boolean(lifecycle.data?.state?.erased) } })
    useLayoutEffect(() => attach(model.preserve), [attach, model.preserve])
    useLayoutEffect(() => { mounted.current = true; heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }); return () => { mounted.current = false } }, [])
    const resume = async () => {
        if (working || !current() || lifecycle.data?.state?.erased || !model.preserve()) return
        const key = model.isCopy ? model.key : item.record.storageKey
        const exact = key ? readRetainedAuthorVariant(key, item.scope) : null
        if (!exact || canonicalJson(exact.record.write) !== canonicalJson(draft)) { setFailed(true); return }
        if (onResumeInStudio) { if (!onResumeInStudio(exact)) setFailed(true); return }
        if (!online || !onOpenAccount || !canOpenAccount?.(exact)) return
        setWorking(true); setFailed(false)
        try {
            await onOpenAccount(exact)
            if (mounted.current && live.current.current() && !live.current.erased && model.preserve()) onAccountOpened?.(exact)
        } catch { if (mounted.current && live.current.current()) setFailed(true) }
        finally { if (mounted.current && live.current.current()) setWorking(false) }
    }
    const download = (json: boolean) => {
        if (!current()) return
        try { downloadBlob(new Blob([json ? JSON.stringify({ schema: 1, scope: item.scope, write: draft }, null, 2) : documentMarkdown(draft.document)],
            { type: json ? 'application/json' : 'text/markdown;charset=utf-8' }), safeFilename(draft.title, 'private-version') + (json ? '.json' : '.md')) }
        catch { setFailed(true) }
    }
    return <div className="min-w-0 space-y-3" onKeyDownCapture={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); model.preserve() } }}>
        <h4 ref={heading} tabIndex={-1} className="break-words font-display text-h3">{draft.title || t('novelEditor.variants.unnamedDraft')}</h4>
        <Callout role="status">{text(model.isCopy ? 'independentCopy' : 'inspection')}</Callout>
        {readOnly && <Callout role="status" tone="warning">{text(lifecycle.data?.state?.erased ? 'erased' : 'readOnly')}</Callout>}
        {draft.pending && <Callout role="status" tone="warning">{text('pendingHelp')}</Callout>}
        {draft.refusal && <Callout role="status" tone="warning">{t('novelEditor.variants.refused')}</Callout>}
        <Field label={t('novelEditor.variants.draftTitle')}><Input value={draft.title} disabled={!model.isCopy || readOnly} onChange={event => model.edit({ title: event.target.value })} /></Field>
        <section aria-label={text('editor')} className="flex h-64 min-h-0 flex-col rounded-lg border border-parchment-50/10 bg-ink-800 p-3 md:h-80 [&_.story-editor-prose]:min-h-0 [&_.story-editor-prose]:px-3 [&_.story-editor-prose]:py-3">
            <NovelEditor {...editorProps} key={model.isCopy ? model.key : item.record.storageKey} initialDocument={draft.document} readOnly={!model.isCopy || readOnly}
                onDocumentChange={(document, anchorEdits) => model.edit({ document, anchorEdits })} />
        </section>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => setOriginal(value => !value)}>{t('novelEditor.variants.original')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setBase(value => !value)}>{t('novelEditor.variants.base')}</Button></div>
        {original && <Markdown content={draft.context.parent.parent.output} />}
        {base && <section aria-label={t('novelEditor.variants.base')} className="flex h-48 min-h-0 flex-col [&_.story-editor-prose]:min-h-0"><NovelEditor {...editorProps} initialDocument={draft.context.baseDocument} readOnly onDocumentChange={() => {}} /></section>}
        <div className="sticky bottom-0 space-y-2 border-t border-parchment-50/10 bg-ink-700 py-3">
            {model.storageFailed && <Callout role="alert" tone="warning">{t('novelEditor.variants.localFailed')}</Callout>}
            {model.savedLocally && <p role="status" className="text-caption text-parchment-300">{t('novelEditor.variants.localSaved')}</p>}
            {failed && <Callout role="alert" tone="warning">{text('handoffFailed')}</Callout>}
            {onOpenAccount && !online && <p role="status" className="text-caption text-parchment-300">{text('offline')}</p>}
            <div className="flex flex-wrap gap-2 [&_button]:max-w-full [&_button]:whitespace-normal">
                <Button variant="ghost" disabled={working} onClick={onBack}>{text('back')}</Button>
                {!model.isCopy && <Button disabled={readOnly || working} onClick={() => model.begin()}>{text('editCopy')}</Button>}
                {model.isCopy && <Button variant="secondary" disabled={working} onClick={() => model.preserve()}>{text('retain')}</Button>}
                <Button variant="secondary" onClick={() => download(true)}>{t('novelEditor.variants.download')}</Button>
                <Button variant="ghost" onClick={() => download(false)}>{text('downloadText')}</Button>
                {(onResumeInStudio || onOpenAccount) && <Button disabled={working || Boolean(lifecycle.data?.state?.erased) || (!onResumeInStudio && (!online || !canOpenAccount?.(item)))} onClick={() => void resume()}>{text(working ? 'opening' : onResumeInStudio ? 'resumeStudio' : 'openAccount')}</Button>}
            </div>
        </div>
    </div>
}
