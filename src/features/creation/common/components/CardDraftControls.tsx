/**
 * CardDraftControls — the editor header cluster for the draft/publish workflow.
 *
 * Rendered in the creator's `headerActions` beside the (form-submit) "Save draft" button.
 * Shows the unsaved-changes badge, a Publish action (with optional version label), and a
 * "Version history" trigger that opens {@link CardHistoryDrawer}. Publish/Discard/Restore
 * are driven through the creator's `useCardDraft` instance; on success the editor form is
 * re-hydrated via `onHydrate` (discard/restore) and the gallery refreshed via `onPublished`.
 *
 * Renders nothing until the card has been created (no id ⇒ nothing to draft/publish yet).
 *
 * A write refused because the draft changed elsewhere (a novel staged a fact into it) opens a
 * dialog instead of an error: load the newer draft, or keep this editor's version on purpose.
 * Publishing offers no override — nothing the author has not seen goes live.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import type { VersionableCardType } from '@/shared'
import type { CardDraftDocument, CardPublishResult } from '@/shared/types/cardVersion.types'
import { useNavigation } from '@/app/hooks'
import { buildCardEditHash } from '@/features/gallery/galleryLinks'
import { isDraftChanged, type UseCardDraftApi } from '../engine'
import { Badge, Button, Icon, Input, Modal } from '@/ui/primitives'
import { Toast } from '@/ui/primitives/Toast'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { CardHistoryDrawer } from './CardHistoryDrawer'

export interface CardDraftControlsProps {
    cardType: VersionableCardType
    cardId: string | null
    cardName: string
    draft: UseCardDraftApi
    /** Re-seed the editor form from a card body (after discard or restore). */
    onHydrate: (body: CardDraftDocument) => void
    /** Called after a successful publish (e.g. to refresh the gallery). */
    onPublished?: (result: CardPublishResult) => void
    /** Called when the conflict dialog saved the editor's body over a newer draft (the form is now clean). */
    onDraftSaved?: (body: unknown) => void
    /** Disable actions while the form runs its own submit. */
    disabled?: boolean
    /** Workspace R1: the card's own workspace (history and usage reads); default = committed. */
    workspaceId?: string | null
    /** Archived workspace: Publish, discard and restore are off; version history stays viewable. */
    readOnly?: boolean
}

export function CardDraftControls({
    cardType,
    cardId,
    cardName,
    draft,
    onHydrate,
    onPublished,
    onDraftSaved,
    disabled = false,
    workspaceId,
    readOnly = false,
}: CardDraftControlsProps) {
    const { t } = useTranslation()
    const { replaceHash } = useNavigation()
    const [historyOpen, setHistoryOpen] = useState(false)
    const [publishOpen, setPublishOpen] = useState(false)
    const [discardOpen, setDiscardOpen] = useState(false)
    const [label, setLabel] = useState('')
    const [reloadToken, setReloadToken] = useState(0)
    const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

    if (!cardId) return null

    const { hasDraft, busy, draftState } = draft
    const based = draftState?.basedOnVersionNumber ?? 0
    const latest = draftState?.latestVersionNumber ?? 0

    const fail = (key: string | null) => setToast({ tone: 'error', message: t(key ?? 'cardVersions.errors.publish') })
    // A changed draft opens the conflict dialog rather than an error toast.
    const watch = () => {
        const seen = { changed: false }
        return { seen, onError: (cause: unknown) => { seen.changed = isDraftChanged(cause) } }
    }

    const confirmPublish = async () => {
        if (readOnly) return
        const watched = watch()
        const result = await draft.publish(label.trim() || undefined, watched)
        if (result) {
            setPublishOpen(false)
            setLabel('')
            setReloadToken((n) => n + 1)
            setToast({ tone: 'success', message: t('cardVersions.publish.success', { number: result.version_number }) })
            onPublished?.(result)
        } else {
            setPublishOpen(false)
            if (!watched.seen.changed) fail(draft.error)
        }
    }

    const confirmDiscard = async () => {
        if (readOnly) return
        const watched = watch()
        const published = await draft.discard(watched)
        setDiscardOpen(false)
        if (published) {
            onHydrate(published)
            setToast({ tone: 'success', message: t('cardVersions.draft.discarded') })
        } else if (!watched.seen.changed) {
            fail(draft.error)
        }
    }

    const handleRestore = async (versionNumber: number) => {
        if (readOnly) return
        const watched = watch()
        const body = await draft.restoreIntoDraft(versionNumber, watched)
        if (body) {
            onHydrate(body)
            // Restore stages the version into the draft → drop any `?version=` so the URL = draft.
            replaceHash(buildCardEditHash(cardType, cardId))
            setHistoryOpen(false)
            setToast({ tone: 'success', message: t('cardVersions.history.restored', { number: versionNumber }) })
        } else if (!watched.seen.changed) {
            fail(draft.error)
        }
    }

    const conflict = draft.conflict
    const conflictNumber = conflict?.action === 'restore' ? conflict.versionNumber : undefined

    /** Show the draft as stored now; the editor's unsaved edits give way to it. */
    const loadNewer = async () => {
        const body = await draft.loadLatest()
        if (!body) return fail('cardVersions.errors.loadLatest')
        onHydrate(body)
        setToast({ tone: 'success', message: t('cardVersions.conflict.loaded') })
    }

    /** Replace the newer draft with this editor's own write, on purpose. */
    const keepMine = async () => {
        if (!conflict || readOnly || conflict.action === 'publish') return
        if (!(await draft.adoptLatest())) return fail('cardVersions.errors.loadLatest')
        draft.dismissConflict()
        if (conflict.action === 'discard') return confirmDiscard()
        if (conflict.action === 'restore') return handleRestore(conflict.versionNumber)
        const watched = watch()
        if (await draft.saveDraft(conflict.body, watched)) {
            onDraftSaved?.(conflict.body)
            setToast({ tone: 'success', message: t('cardVersions.draft.saved') })
        } else if (!watched.seen.changed) {
            fail('cardVersions.errors.draftSave')
        }
    }

    /** View a version READ-ONLY via the URL (`?version=<n>`); never touches the draft. */
    const handleView = (versionNumber: number) => {
        replaceHash(buildCardEditHash(cardType, cardId, versionNumber))
        setHistoryOpen(false)
    }

    return (
        <>
            {hasDraft && (
                <Badge tone="ember">
                    {based > 0
                        ? t('cardVersions.draft.unsavedSince', { number: based })
                        : t('cardVersions.draft.badge')}
                </Badge>
            )}
            <Button
                variant="primary"
                onClick={() => setPublishOpen(true)}
                disabled={disabled || readOnly || busy || !hasDraft}
            >
                {draft.publishing ? t('cardVersions.publish.publishing') : t('cardVersions.publish.button')}
            </Button>
            <Button
                variant="ghost"
                onClick={() => setHistoryOpen(true)}
                iconLeft={<Icon icon={History} size={16} />}
                disabled={disabled}
            >
                {t('cardVersions.history.open')}
            </Button>

            <CardHistoryDrawer
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                cardType={cardType}
                cardId={cardId}
                cardName={cardName}
                workspaceId={workspaceId}
                readOnly={readOnly}
                hasDraft={hasDraft}
                basedOnVersionNumber={based}
                latestVersionNumber={latest}
                busy={busy}
                reloadToken={reloadToken}
                onPublish={() => setPublishOpen(true)}
                onDiscard={() => setDiscardOpen(true)}
                onRestore={(n) => void handleRestore(n)}
                onView={(n) => handleView(n)}
            />

            <ConfirmDialog
                visible={publishOpen}
                title={t('cardVersions.publish.confirmTitle')}
                message={
                    <div className="flex flex-col gap-3">
                        <p>{t('cardVersions.publish.confirmBody', { number: latest + 1 })}</p>
                        <Input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder={t('cardVersions.publish.labelPlaceholder')}
                            aria-label={t('cardVersions.publish.labelPlaceholder')}
                            maxLength={255}
                        />
                    </div>
                }
                confirmLabel={t('cardVersions.publish.button')}
                processingLabel={t('cardVersions.publish.publishing')}
                isProcessing={draft.publishing}
                onConfirm={() => void confirmPublish()}
                onCancel={() => setPublishOpen(false)}
            />

            <ConfirmDialog
                visible={discardOpen}
                variant="danger"
                title={t('cardVersions.draft.discardConfirmTitle')}
                message={t('cardVersions.draft.discardConfirmBody')}
                confirmLabel={t('cardVersions.draft.discard')}
                processingLabel={t('cardVersions.draft.discarding')}
                isProcessing={draft.saving}
                onConfirm={() => void confirmDiscard()}
                onCancel={() => setDiscardOpen(false)}
            />

            <Modal
                open={conflict !== null}
                onClose={draft.dismissConflict}
                title={t('cardVersions.conflict.title')}
                size="md"
                footer={
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" onClick={draft.dismissConflict} disabled={busy}>
                            {t('cardVersions.conflict.later')}
                        </Button>
                        {conflict && conflict.action !== 'publish' && !readOnly && (
                            <Button variant="secondary" onClick={() => void keepMine()} disabled={busy}>
                                {t(`cardVersions.conflict.keep.${conflict.action}`, { number: conflictNumber })}
                            </Button>
                        )}
                        <Button variant="primary" onClick={() => void loadNewer()} disabled={busy}>
                            {t('cardVersions.conflict.load')}
                        </Button>
                    </div>
                }
            >
                {conflict && (
                    <div className="flex flex-col gap-3 text-body text-parchment-200">
                        <p>{t(`cardVersions.conflict.body.${conflict.action}`, { number: conflictNumber })}</p>
                        <p className="text-caption text-parchment-400">{t('cardVersions.conflict.loadHint')}</p>
                    </div>
                )}
            </Modal>

            <Toast
                open={toast !== null}
                tone={toast?.tone ?? 'success'}
                title={toast?.message ?? ''}
                onClose={() => setToast(null)}
                autoCloseMs={3200}
            />
        </>
    )
}
