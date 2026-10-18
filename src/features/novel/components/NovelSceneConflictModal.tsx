import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryDocumentNode } from '@/shared'
import { Button, Callout, Drawer, Field, Select } from '@/ui/primitives'
import { downloadBlob, safeFilename } from '@/utils/download'
import type { SceneDraftApi } from '../hooks/useSceneDraft'
import { reviewSceneReconciliation, resolveSceneReconciliation, type ReconciliationSide } from '../persistence/sceneReconciliation'
import { ManuscriptProse } from './ManuscriptProse'
import { useReconciliationProgress, type ReconciliationReview } from '../hooks/useReconciliationProgress'
import {NovelGenerationApplicationNotice} from './NovelGenerationApplicationNotice'

interface Props {
    open: boolean
    review: ReconciliationReview | null
    deviceOnly?: boolean
    onCheckpointState?: (safe: boolean) => void
    readOnly?: boolean
    workspaceUnverified?: boolean
    novelUnverified?: boolean
    stale?: boolean
    retentionFailed?: boolean
    onClose: () => void
    onRefresh: () => Promise<void>
    onResolve: SceneDraftApi['resolveConflict']
}
export function NovelSceneConflictModal(props: Props) {
    return props.review ? <ConflictReview key={props.review.id} {...props} review={props.review} /> : null
}

function ConflictReview({ review, open, deviceOnly = false, onCheckpointState, readOnly = false, workspaceUnverified = false, novelUnverified = false, stale = false, retentionFailed = false, onClose, onRefresh, onResolve }: Props & { review: ReconciliationReview }) {
    const { t } = useTranslation(), text = (key: string, options?: Record<string, unknown>) => t('novelEditor.offline.' + key, options)
    const plan = useMemo(() => reviewSceneReconciliation(review.baseDocument, review.deviceDocument, review.account.document), [review])
    const progress = useReconciliationProgress(review, plan)
    const { choices, order, title } = progress.value
    const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false)
    const [closing, setClosing] = useState(false), [closeFailed, setCloseFailed] = useState(false)
    const alive = useRef(true)
    useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
    const candidate = useMemo(() => plan ? resolveSceneReconciliation(plan, choices, order || undefined) : null, [plan, choices, order])
    const deviceTitleValid = Boolean(review.deviceTitle.trim()) && [...review.deviceTitle.trim()].length <= 255
    const chosenTitleValid = title === 'account' || title === 'device' && deviceTitleValid
    const options = [{ value: '', label: text('choose') }, { value: 'device', label: text('device') }, { value: 'account', label: text('account') }]
    const blocked = readOnly || workspaceUnverified || novelUnverified || stale || busy || closing || progress.status === 'loading'
    const applyBlocked = blocked || deviceOnly || progress.status === 'saving'
    const application=review.applicationRejection
    const accountBlocked=application?workspaceUnverified||novelUnverified||stale||busy||closing||deviceOnly||progress.status==='loading'||progress.status==='saving':applyBlocked
    useLayoutEffect(() => {
        onCheckpointState?.(!progress.changed || progress.status === 'saved')
        return () => onCheckpointState?.(true)
    }, [progress.changed, progress.status, onCheckpointState])
    function close() {
        if (closing) return
        if (progress.status === 'disabled' || progress.status === 'clean' || progress.status === 'recovered' || progress.status === 'saved') { onClose(); return }
        setClosing(true)
        void progress.flush().then((saved) => { if (alive.current) { if (saved) onClose(); else setCloseFailed(true) } })
            .finally(() => { if (alive.current) setClosing(false) })
    }
    async function refresh() {
        if (busy) return
        setBusy(true); setFailed(false)
        try { await onRefresh() } catch { if (alive.current) setFailed(true) }
        finally { if (alive.current) setBusy(false) }
    }
    function download() {
        downloadBlob(new Blob([JSON.stringify({ schema: 'novel-device-draft-v1', title: review.deviceTitle, document: review.deviceDocument,
            ...(application?{applicationRejection:application}:{}) }, null, 2)], { type: 'application/json' }), safeFilename(review.deviceTitle, 'device-draft') + '.device-draft.json')
    }
    return <Drawer open={open} onClose={close} title={application?t('novelEditor.assistant.applicationCompareTitle'):text('compareTitle')} size="2xl" footer={<>
        <Button variant="secondary" disabled={accountBlocked} onClick={() => onResolve('server')}>{application?t('novelEditor.assistant.applicationKeepAccount'):text('keepAccount')}</Button>
        {!application&&<Button variant="secondary" disabled={applyBlocked || !deviceTitleValid} onClick={() => onResolve('local')}>{text('keepDevice')}</Button>}
        {!application&&<Button disabled={applyBlocked || !candidate || !chosenTitleValid} onClick={() => { if (candidate && title) onResolve('merge', { document: candidate, title: title === 'device' ? review.deviceTitle : review.account.title }) }}>{text('apply')}</Button>}
    </>}>
        <div className="space-y-4">
            {application&&<NovelGenerationApplicationNotice value={application} />}
            <p className="text-body text-parchment-200">{application?t('novelEditor.assistant.applicationHelp'):text('compareHelp')}</p>
            {deviceOnly && <Callout tone="warning" role="status">{text('savedReviewHelp')}</Callout>}
            {progress.status === 'loading' && <p role="status">{text('reviewLoading')}</p>}
            {progress.status === 'saving' && <p role="status">{text('reviewSaving')}</p>}
            {(progress.status === 'recovered' || progress.status === 'saved') && <Callout tone="success" role="status">{text(progress.status === 'recovered' ? 'reviewRecovered' : 'reviewSaved')}</Callout>}
            {(progress.status === 'failed' || closeFailed && progress.status !== 'saved') && <Callout tone="warning" role="alert">{text('reviewStorageFailed')}</Callout>}
            {progress.unreadable > 0 && <Callout tone="warning" role="status">{text('reviewUnreadable')}</Callout>}
            {stale && <Callout tone="warning" role="alert">{text('changed')}</Callout>}
            {readOnly && <Callout tone="warning" role="status">{text('readonly')}</Callout>}
            {workspaceUnverified && <Callout tone="warning" role="status">{t('novelEditor.deviceCache.workspaceUnverified')}</Callout>}
            {novelUnverified && <Callout tone="warning" role="status">{t('novelEditor.deviceCache.novelUnverified')}</Callout>}
            {retentionFailed && <Callout tone="warning" role="alert">{text('retentionFailed')}</Callout>}
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={download}>{text('downloadDevice')}</Button>
                {review.recoveryScope && <Button variant="secondary" onClick={() => downloadBlob(new Blob([JSON.stringify({ schema: 'novel-reconciliation-review-v1', source: progress.source, value: progress.value }, null, 2)], { type: 'application/json' }), safeFilename(review.deviceTitle, 'review') + '.review.json')}>{text('downloadReview')}</Button>}
                <Button variant="ghost" disabled={busy || deviceOnly} aria-busy={busy} onClick={() => void refresh()}>{text(busy ? 'checkingComparison' : 'refresh')}</Button>
            </div>
            {failed && <Callout tone="warning" role="alert">{text('failed')}</Callout>}
            {!plan?.baseAvailable && <Callout tone="warning">{text('baseMissing')}</Callout>}
            <div className="grid gap-4 sm:grid-cols-2">
                <section className="space-y-2"><h3 className="font-display text-h3">{text('device')}</h3><p>{review.deviceTitle}</p><ManuscriptProse document={review.deviceDocument} /></section>
                <section className="space-y-2"><h3 className="font-display text-h3">{text('account')}</h3><p>{review.account.title}</p><ManuscriptProse document={review.account.document} /></section>
            </div>
            {application&&<details className="space-y-3"><summary className="cursor-pointer text-label">{t('novelEditor.assistant.applicationProposed')}</summary><ManuscriptProse document={application.write.document} /></details>}
            {plan && !application && <>
                <p>{text('automatic', { count: plan.automaticBlocks })} {text('conflicts', { count: plan.conflicts.length })}</p>
                {plan.conflicts.map((conflict, index) => <section key={conflict.id} className="space-y-3 rounded-lg border border-line p-3">
                    <Field label={text('block', { number: index + 1 })}><Select value={choices[conflict.id] ?? ''} disabled={blocked} options={options} onChange={(value) => { if (value === 'device' || value === 'account') progress.update({ ...progress.value, choices: { ...choices, [conflict.id]: value } }) }} /></Field>
                    <div className="grid gap-4 sm:grid-cols-2"><Block label={text('device')} node={conflict.device} removed={text('removed')} /><Block label={text('account')} node={conflict.account} removed={text('removed')} /></div>
                </section>)}
                <Field label={text('titleChoice')}><Select value={title} disabled={blocked} options={options.map((option) => ({ ...option, label: option.value === 'device' ? `${text('device')}: ${review.deviceTitle}` : option.value === 'account' ? `${text('account')}: ${review.account.title}` : option.label }))} onChange={(value) => progress.update({ ...progress.value, title: value as ReconciliationSide | '' })} /></Field>
                <Field label={text('order')} helper={plan.orderConflict ? text('orderHelp') : undefined}><Select value={order} disabled={blocked} options={options} onChange={(value) => progress.update({ ...progress.value, order: value as ReconciliationSide | '' })} /></Field>
                <section className="space-y-2"><h3 className="font-display text-h3">{text('preview')}</h3>{candidate ? <ManuscriptProse document={candidate} /> : <Callout tone="warning" role="status">{text('invalid')}</Callout>}</section>
            </>}
        </div>
    </Drawer>
}
function Block({ label, node, removed }: { label: string; node: StoryDocumentNode | null; removed: string }) {
    return <div className="space-y-2"><h4 className="font-ui text-label text-parchment-200">{label}</h4>{node ? <ManuscriptProse document={{ schemaVersion: 1, content: { type: 'doc', content: [node] } }} /> : <p>{removed}</p>}</div>
}
