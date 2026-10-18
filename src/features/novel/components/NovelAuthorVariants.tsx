import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Callout, Card, Drawer, Field, Input } from '@/ui/primitives'
import type { StoryVariantPage, StoryVariantRecord } from '@/shared'
import { documentMarkdown } from '@/shared/storyDocument'
import { downloadBlob, safeFilename } from '@/utils/download'
import { NovelEditor } from '../editor/NovelEditor'
import type { NovelEditorHandle } from '../editor/types'
import { useAuthorVariantDraft } from '../hooks/useAuthorVariantDraft'
import type { AuthorVariantSource } from '../hooks/useAuthorVariantSource'
import type { AuthorVariantDraft } from '../persistence/authorVariantJournal'
import type { NovelJournalRecord } from '@/shared/novelMutationJournal'

export interface NovelAuthorVariantsHandle { preserve: () => boolean }
export interface NovelAuthorVariantsProps {
    source: AuthorVariantSource; generationId: string; readOnly: boolean; startEditing?: boolean; canCreate?: boolean; isDefaultWorkspace?: boolean
    recoveryRecord?: NovelJournalRecord<AuthorVariantDraft>
    onClose: () => void; onReview: (record: StoryVariantRecord, signal: AbortSignal) => Promise<boolean>
    onRefine?: (record: StoryVariantRecord, signal: AbortSignal) => Promise<boolean>
    ref?: Ref<NovelAuthorVariantsHandle>
}
const noGeneration = async () => { throw new Error('This private editor does not execute a model') }
const noEffect = async () => {}
export function NovelAuthorVariants({ ref, source, generationId, readOnly, startEditing = true, canCreate = true, isDefaultWorkspace, recoveryRecord, onClose, onReview, onRefine }: NovelAuthorVariantsProps) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.variants.' + key, values)
    const model = useAuthorVariantDraft({ source, generationId, readOnly, startEditing, isDefaultWorkspace, recoveryRecord })
    useImperativeHandle(ref, () => ({ preserve: model.preserve }), [model.preserve])
    const editor = useRef<NovelEditorHandle | null>(null), seeded = useRef(false)
    const [handoff, setHandoff] = useState(false), [handoffFailed, setHandoffFailed] = useState(false)
    const live = useRef({ source, readOnly, onReview, onRefine }), serial = useRef(0), abort = useRef<AbortController | null>(null)
    useLayoutEffect(() => { live.current = { source, readOnly, onReview, onRefine } })
    useEffect(() => () => { serial.current++; abort.current?.abort() }, [source.key, generationId])
    const draft = model.draft, record = model.record, busy = Boolean(model.working || handoff)
    const readyEditor = useCallback((handle: NovelEditorHandle | null) => {
        editor.current = handle
        if (handle?.getInstanceToken() && draft && !draft.seeded && !seeded.current && !readOnly) {
            seeded.current = true
            model.seed(handle.prepareVariantDraft?.(draft.context) ?? null)
        }
    }, [draft, model.seed, readOnly])
    function close() { if (model.preserve()) { serial.current++; abort.current?.abort(); onClose() } }
    function download() { const value = draft ?? model.recovery?.write; if (value) downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), safeFilename(value.title, 'private-version') + '.json') }
    async function handOff(kind:'review'|'refine') {
        const action=kind==='refine'?live.current.onRefine:live.current.onReview
        if (!record || !action || busy || readOnly || draft?.pending || !source.isCurrent() || !model.preserve()) return
        const owner = ++serial.current, controller = new AbortController(); abort.current?.abort(); abort.current = controller
        setHandoff(true); setHandoffFailed(false)
        try {
            const result = await action(structuredClone(record), controller.signal)
            if (!controller.signal.aborted && serial.current === owner && source.isCurrent()) { if (result&&!live.current.readOnly) onClose(); else setHandoffFailed(true) }
        } catch { if (!controller.signal.aborted && serial.current === owner && source.isCurrent()) setHandoffFailed(true) }
        finally { if (serial.current === owner && source.isCurrent()) setHandoff(false) }
    }
    const privateEditorProps = { codexEntries: [], aiDisabled: true, onGenerate: noGeneration, onAcceptGeneration: noEffect,
        onDiscardGeneration: noEffect, onCritiqueResult: () => {}, onRequestSaveFlush: async () => false }
    return <Drawer open onClose={close} title={text('title')} size="2xl" footer={<div className="flex w-full flex-wrap gap-2">
        {(model.storageFailed||model.error||handoffFailed)&&<div className="w-full space-y-2">
            {model.storageFailed&&<Callout tone="warning" role="alert">{text('localFailed')}</Callout>}
            {model.error&&<Callout tone="warning" role="alert">{text('errors.'+model.error)}</Callout>}
            {handoffFailed&&<Callout tone="warning" role="alert">{text('handoffFailed')}</Callout>}
        </div>}
        {(model.working||handoff)&&<p role="status" className="w-full text-caption text-parchment-200">{text('work.'+(handoff?'manuscript':model.working))}</p>}
        <Button variant="ghost" onClick={close}>{t('common.close')}</Button>
        {(draft || model.recovery) && <Button variant="secondary" onClick={download}>{text('download')}</Button>}
        {model.storageFailed && <Button variant="secondary" onClick={() => model.preserve()}>{text('retryStorage')}</Button>}
        {draft?.pending ? <Button disabled={busy} onClick={() => void model.recover()}>{text('recover')}</Button>
            : draft&&!model.isCurrentSaved && <><Button variant="secondary" disabled={busy || readOnly || !model.canPrepare} onClick={() => void model.prepare()}>{text('review')}</Button>
                <Button disabled={busy || readOnly || !model.preview} onClick={() => void model.save()}>{text('save')}</Button></>}
        {record&&!readOnly&&['candidate','stashed'].includes(record.status)&&<Button disabled={busy||Boolean(draft?.pending)} aria-label={text('applyReviewNamed',{title:record.variant.title})} onClick={()=>void handOff('review')}>{text('applyReview')}</Button>}
        {record&&!readOnly&&onRefine&&<Button variant="secondary" disabled={busy||Boolean(draft?.pending)} onClick={()=>void handOff('refine')}>{text('refine')}</Button>}
    </div>}>
        <div className="min-w-0 space-y-4" onKeyDownCapture={event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopPropagation();model.preserve()}}}>
            <p className="text-body text-parchment-200">{text('help')}</p>
            {readOnly && <Callout tone="info">{text('readOnly')}</Callout>}
            {!draft && model.recovery && <Card className="space-y-3 p-4"><p>{text('recoverDraft')}</p><div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => model.resume()}>{text('resume')}</Button>
                {canCreate && <Button variant="secondary" disabled={busy || readOnly} onClick={() => { seeded.current = false; void model.loadFresh() }}>{text('another')}</Button>}
            </div></Card>}
            {!draft&&model.recoveries.length>1&&<section aria-label={text('otherDrafts')} className="space-y-2"><h3 className="font-display text-h3">{text('otherDrafts')}</h3>
                {model.recoveries.filter(item=>item.storageKey!==model.recovery?.storageKey).map(item=><Card key={item.storageKey} className="flex min-w-0 flex-wrap items-center gap-2 p-3"><span className="min-w-0 flex-1 break-words">{item.write.title||text('unnamedDraft')}</span>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={()=>model.resume(item)}>{text('resume')}</Button></Card>)}
            </section>}
            {!draft && !model.recovery && !model.working && canCreate && <Button variant="secondary" disabled={readOnly} onClick={() => { seeded.current = false; void model.loadFresh() }}>{text('open')}</Button>}
            {draft && <>
                <p className="text-caption text-parchment-300">{text('source', { scene: draft.context.sceneTitle, revision: draft.context.parent.parent.baseRevision })}</p>
                <Field label={text('draftTitle')} helper={text('draftTitleHelp')}><Input value={draft.title} disabled={readOnly || handoff} onChange={event => model.edit({ title: event.target.value })} /></Field>
                <details><summary className="cursor-pointer text-label">{text('original')}</summary><p className="whitespace-pre-wrap break-words font-narrative text-body text-arcane-300">{draft.context.parent.parent.output}</p></details>
                <details><summary className="cursor-pointer text-label">{text('base')}</summary><p className="whitespace-pre-wrap break-words font-narrative text-body">{documentMarkdown(draft.context.baseDocument)}</p></details>
                <Callout tone="info">{text('fullScene')}</Callout>
                {model.seedUnavailable && <Callout tone="warning">{text('seedUnavailable')}</Callout>}
                <section aria-label={text('privateEditor')} className="flex h-64 min-h-0 flex-col rounded-lg border border-parchment-50/10 bg-ink-800 p-3 md:h-80 [&_.story-editor-prose]:min-h-0 [&_.story-editor-prose]:px-3 [&_.story-editor-prose]:py-3">
                    <NovelEditor {...privateEditorProps} key={draft.id + ':' + model.editorEpoch} ref={readyEditor} initialDocument={draft.document}
                        readOnly={readOnly || handoff || !draft.seeded} onDocumentChange={(document, anchorEdits) => model.edit({ document, anchorEdits })} />
                </section>
                {draft.anchorEdits === null && <Callout tone="warning">{text('mapping')}</Callout>}
                {model.savedLocally && <p role="status" className="text-caption text-parchment-300">{text('localSaved')}</p>}
                {draft.pending && <Callout tone="warning">{text('pending')}</Callout>}
                {draft.refusal&&<Callout tone="warning"><p>{text('refused')}</p><details><summary className="cursor-pointer text-label">{text('refusedWriting')}</summary>
                    <p className="whitespace-pre-wrap break-words font-narrative text-body">{draft.refusal.pending.kind==='create'?documentMarkdown(draft.refusal.pending.write.intent.operation.document):text('refusedDecision')}</p></details></Callout>}
                {model.preview && <Callout tone="info" role="status">{text('reviewReady')}</Callout>}
                {model.isCurrentSaved && <Callout tone="info">{text('currentSaved')}</Callout>}
            </>}
            <SavedVariantList source={source} generationId={generationId} disabled={busy} refreshIdentity={(draft?.saved?.reference.variantHash ?? '')+':'+(record?.status ?? '')} onRead={id => void model.read(id)} />
            {record && <Card className="space-y-3 p-4">
                <h3 className="break-words font-display text-h3">{text('selected', { title: record.variant.title })}</h3>
                <Badge tone={record.status === 'accepted' ? 'ember' : 'neutral'}>{t('novelEditor.history.status.' + record.status)}</Badge>
                <details><summary className="cursor-pointer text-label">{text('original')}</summary><p className="whitespace-pre-wrap break-words font-narrative text-body text-arcane-300">{record.variant.parent.parent.output}</p></details>
                <details><summary className="cursor-pointer text-label">{text('base')}</summary><p className="whitespace-pre-wrap break-words font-narrative text-body">{documentMarkdown(record.variant.baseDocument)}</p></details>
                <p className="text-body">{text('fullScene')}</p>
                <section aria-label={text('selected', { title: record.variant.title })} className="flex h-48 min-h-0 flex-col md:h-64 [&_.story-editor-prose]:min-h-0 [&_.story-editor-prose]:px-3 [&_.story-editor-prose]:py-3">
                    <NovelEditor {...privateEditorProps} key={record.variant.id} initialDocument={record.variant.operation.document} readOnly onDocumentChange={() => {}} />
                </section>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={busy} onClick={() => void model.read(record.variant.id)}>{text('read')}</Button>
                    {!readOnly && canCreate && <Button variant="secondary" disabled={busy} onClick={() => model.editSaved()}>{text('editSaved')}</Button>}
                    {!readOnly && ['candidate', 'stashed'].includes(record.status) && <>
                        <Button variant="secondary" disabled={busy || Boolean(draft?.pending) || record.status === 'stashed'} onClick={() => void model.decide('stash')}>{text('stash')}</Button>
                        <Button variant="secondary" disabled={busy || Boolean(draft?.pending)} onClick={() => void model.decide('reject')}>{text('reject')}</Button>
                    </>}
                </div>
            </Card>}
        </div>
    </Drawer>
}
function SavedVariantList({ source, generationId, disabled, refreshIdentity, onRead }: { source: AuthorVariantSource; generationId: string; disabled: boolean; refreshIdentity: string; onRead: (id: string) => void }) {
    const { t } = useTranslation(), text = (key: string) => t('novelEditor.variants.' + key)
    const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]), [refresh, setRefresh] = useState(0)
    const before = cursors[cursors.length - 1]
    const identity=JSON.stringify([source.key,generationId,before??null,refresh,refreshIdentity])
    const [response,setResponse]=useState<{identity:string;page:StoryVariantPage|null;failed:boolean}|null>(null)
    const loading=response?.identity!==identity,failed=!loading&&Boolean(response?.failed),page=!loading?response?.page:null
    useEffect(() => {
        const controller = new AbortController(); let current = true
        void source.page({ generationId, ...(before ? { before } : {}) }, controller.signal).then(value => {
            if (current && source.isCurrent()) setResponse({identity,page:value,failed:false})
        }).catch(() => { if (current && source.isCurrent()) setResponse({identity,page:null,failed:true}) })
        return () => { current = false; controller.abort() }
    }, [source, generationId, before, identity])
    return <section aria-label={text('savedVersions')} className="space-y-3">
        <h3 className="font-display text-h3">{text('savedVersions')}</h3>
        {failed && <Callout tone="warning" role="alert">{text('errors.read')}</Callout>}
        {loading && <p role="status">{text('loading')}</p>}
        {!loading && !failed && !page?.items.length && <p className="text-body text-parchment-300">{text('noVersions')}</p>}
        {!loading && !failed && page?.items.map(row => <Card key={row.id} className="flex min-w-0 flex-wrap items-center gap-2 p-3"><span className="min-w-0 flex-1 break-words">{row.title}</span>
            <Badge tone="neutral">{t('novelEditor.history.status.' + row.status)}</Badge><Button size="sm" variant="secondary" disabled={disabled} onClick={() => onRead(row.id)}>{text('read')}</Button></Card>)}
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={disabled || loading} onClick={() => setRefresh(value => value + 1)}>{text('refresh')}</Button>
            <Button size="sm" variant="ghost" disabled={disabled || loading || cursors.length === 1} onClick={() => setCursors(value => value.slice(0, -1))}>{text('previous')}</Button>
            <Button size="sm" variant="ghost" disabled={disabled || loading || failed || !page?.nextBefore} onClick={() => setCursors(value => [...value, page?.nextBefore ?? undefined])}>{text('next')}</Button></div>
    </section>
}
