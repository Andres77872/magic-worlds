/**
 * CodexEntryDrawer — view/edit one cloned snapshot (name + content). Edits
 * merge into the ref's snapshot only: the source card or lorebook entry is
 * never touched.
 *
 * `readOnly` (the story's workspace is archived) keeps it a viewer: the fields
 * stay selectable for reading and copying, Save is disabled, and the archived
 * notice says why.
 */

import { useRef,useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive } from 'lucide-react'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import { Icon, Button, Callout, Drawer, Modal, Field, Input, Tag, Textarea } from '@/ui/primitives'
import { useAuth } from '@/app/hooks'
import { novelMutationKey } from '@/shared/novelMutationJournal'
import { useCodexSnapshotDraft } from '../../hooks/useCodexSnapshotDraft'
import type { CodexEntry } from '../../hooks/useCodex'
import { KIND_ICONS, KIND_META } from '../../utils/codexUtils'

interface CodexEntryDrawerProps {
    entry: CodexEntry | null
    busy: boolean
    workspaceId?:string|null
    /** The story's workspace is archived: view only. */
    readOnly?: boolean
    onClose: () => void
    onSave: (entry: CodexEntry, patch: { label: string; description: string }) => Promise<void>
}

export function CodexEntryDrawer(props:CodexEntryDrawerProps){
    const {userHash}=useAuth()
    if(!props.entry)return null
    const key=novelMutationKey('codex-details',{userHash,workspaceId:props.workspaceId,storyId:props.entry.ref.storyId},props.entry.id)
    return <SnapshotForm key={key??props.entry.id} {...props} entry={props.entry}/>
}
function SnapshotForm({entry,busy,readOnly=false,onClose,onSave,workspaceId}:CodexEntryDrawerProps&{entry:CodexEntry}){
    const {t}=useTranslation()
    const [error,setError]=useState<string|null>(null)
    const [comparing,setComparing]=useState(false)
    const saving=useRef(false)
    const draft=useCodexSnapshotDraft(entry,workspaceId,busy||readOnly)
    const {label,description}=draft.form
    const disabled=busy||readOnly||Boolean(draft.recovery)

    const meta = entry ? KIND_META.find((item) => item.kind === entry.kind) : null
    const metaLabel = meta ? t(meta.labelKey) : null
    const keys = entry?.kind === 'lorebook_entry' && entry.label ? [entry.label] : []
    const sourceLorebookName = entry?.ref.snapshot.source_lorebook_id ?? null

    const submit = async () => {
        if (!entry||saving.current) return
        if (disabled) {
            setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
            return
        }
        setError(null)
        saving.current=true
        try {
            await onSave({...entry,contextRevision:draft.baseRevision}, { label: label.trim() || entry.label, description })
            draft.acknowledged();onClose()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('novelEditor.save.failed'))
        }finally{saving.current=false}
    }

    return <>
        <Drawer
            open={entry !== null}
            onClose={onClose}
            eyebrow={metaLabel ?? t('novelEditor.entryDrawer.defaultEyebrow')}
            title={entry?.label ?? ''}
            icon={entry ? <Icon icon={KIND_ICONS[entry.kind]} size={18} /> : undefined}
            size="lg"
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={busy}>
                        {readOnly ? t('common.close') : t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => void submit()} disabled={disabled||!draft.dirty} data-testid="codex-entry-save">
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            }
        >
            {entry && (
                <div className="flex flex-col gap-4">
                    {draft.recovery&&<Callout tone="warning" role="status"><p>{t('novelEditor.structure.snapshotRecovery')}</p><div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={draft.resume}>{t('novelEditor.recovery.resume')}</Button>
                        <Button variant="secondary" size="sm" disabled={busy||readOnly} onClick={()=>draft.resolve(false)}>{t('novelEditor.structure.useAccountDetails')}</Button>
                    </div></Callout>}
                    {draft.storageFailed&&<Callout tone="warning" role="alert">{t('novelEditor.recovery.storageFailed')}</Callout>}
                    {draft.remoteChanged&&draft.dirty&&<Callout tone="warning"><p>{t('novelEditor.structure.snapshotChanged')}</p><Button variant="secondary" size="sm" onClick={()=>setComparing(true)}>{t('novelEditor.recovery.compare')}</Button></Callout>}
                    {readOnly && (
                        <Callout tone="warning" role="status" icon={<Icon icon={Archive} size={16} />} data-testid="codex-entry-archived">
                            {t(ARCHIVED_WORKSPACE_MESSAGE_KEY)}
                        </Callout>
                    )}
                    {error && <Callout tone="danger" role="alert">{error}</Callout>}
                    <p className="m-0 font-ui text-xs text-parchment-400">
                        {t('novelEditor.entryDrawer.privateCopy', { label: entry.label, kind: metaLabel ? metaLabel.toLowerCase() : t('novelEditor.entryDrawer.defaultKind') })}
                    </p>
                    <Field label={t('novelEditor.entryDrawer.name')}>
                        <Input maxLength={255} value={label} onChange={(e) => draft.edit('label',e.target.value)} readOnly={disabled} data-testid="codex-entry-name" />
                    </Field>
                    <Field label={entry.kind === 'lorebook_entry' ? t('novelEditor.entryDrawer.content') : t('novelEditor.entryDrawer.description')}>
                        <Textarea
                            value={description}
                            onChange={(e) => draft.edit('description',e.target.value)}
                            readOnly={disabled}
                            rows={12}
                            data-testid="codex-entry-content"
                        />
                    </Field>
                    {entry.kind === 'lorebook_entry' && (keys.length > 0 || sourceLorebookName) && (
                        <div className="flex flex-col gap-2">
                            {keys.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-ui text-xs text-parchment-400">{t('novelEditor.entryDrawer.keys')}</span>
                                    {keys.map((key) => (
                                        <Tag key={key}>{key}</Tag>
                                    ))}
                                </div>
                            )}
                            {sourceLorebookName && (
                                <p className="m-0 font-ui text-xs text-parchment-400">{t('novelEditor.entryDrawer.clonedFrom', { name: sourceLorebookName })}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Drawer>
        <Modal open={comparing} onClose={()=>setComparing(false)} title={t('novelEditor.recovery.compare')} size="lg" footer={<>
            <Button variant="secondary" disabled={busy||readOnly} onClick={()=>{draft.resolve(false);setComparing(false)}}>{t('novelEditor.structure.useAccountDetails')}</Button>
            <Button disabled={busy||readOnly} onClick={()=>{draft.resolve(true);setComparing(false)}}>{t('novelEditor.structure.keepDetailsChanges')}</Button>
        </>}>
            <p className="mb-4 text-body text-parchment-300">{t('novelEditor.structure.detailsMergeHelp')}</p>
            <div className="grid gap-4 sm:grid-cols-2">{[[t('novelEditor.recovery.local'),label,description],[t('novelEditor.recovery.account'),entry.label,entry.description]].map(([heading,name,content])=><section key={heading}>
                <h3 className="font-ui text-label text-parchment-200">{heading}</h3><p className="mt-2 text-body font-semibold">{name}</p><p className="mt-2 whitespace-pre-wrap text-body">{content}</p>
            </section>)}</div>
        </Modal>
    </>
}
