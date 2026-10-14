/**
 * Adventure interaction component
 */

import {useCallback, useEffect, useMemo, useState} from 'react'
import { useTranslation } from 'react-i18next'
import type {Adventure, AdventureSnapshot, TurnEntry} from '../../../shared'
import { useNavigation, useData, useAuth } from '../../../app/hooks'
import { LoadingSpinner } from '../../../ui/components'
import { Button } from '@/ui/primitives'
import { adventureChatConfig } from '../chatSessionConfig'
import { useSessionWorkspace } from '../hooks/useSessionWorkspace'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import {InteractionCenterPanel, InteractionLeftPanel, InteractionRightPanel, InteractionTopBar, SidePanelDrawer} from './index'
import { SessionNarrationTierToggle } from './SessionNarrationTierToggle'

export function AdventureInteraction() {
    const { editingInProgress } = useData()
    return <AdventureInteractionView key={editingInProgress?.draftId ?? editingInProgress?.id ?? 'none'} />
}

function AdventureInteractionView() {
    const { t } = useTranslation()
    const { goBack, setPage } = useNavigation()
    const { editingInProgress, saveInProgressSnapshot, ensureAdventureSession } = useData()
    const [initialDraftId] = useState(() => editingInProgress?.draft ? editingInProgress.draftId : undefined)
    const { isAuthenticated } = useAuth()
    const [currentAdventure, setCurrentAdventure] = useState<Adventure | null>(null)
    const [turns, setTurns] = useState<TurnEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [reloadNonce, setReloadNonce] = useState(0)
    // One source of truth so the two mobile drawers are mutually exclusive —
    // opening one closes the other (no stacked scrims).
    const [openPanelId, setOpenPanelId] = useState<'left' | 'right' | null>(null)
    const openPanel = (id: 'left' | 'right') => setOpenPanelId((cur) => (cur === id ? null : id))
    const closePanels = useCallback(() => setOpenPanelId(null), [])
    // The narrator voice picker lives in the left panel; it is controlled here so the
    // center panel's narration notes can open it too (ER-G1, wired with onEditNarratorVoice).
    const [narratorPickerOpen, setNarratorPickerOpen] = useState(false)
    // Workspace R1: the session keeps its own workspace (this view remounts per session).
    const session = useSessionWorkspace(organizationWorkspaceId(editingInProgress))
    const { workspaceId: sessionWorkspaceId, api: sessionApi } = session
    // An archived session workspace keeps the adventure readable, not writable.
    const sessionReadOnly = useWorkspaceReadOnly(sessionWorkspaceId)
    // Read-only sessions never open the picker, so it cannot pop open once the workspace is restored.
    const openNarratorPicker = useCallback(() => setNarratorPickerOpen(true), [])
    // Stable per-session config so the chat engine's callbacks/effects don't churn.
    const chatConfig = useMemo(
        () => (sessionWorkspaceId && sessionApi ? adventureChatConfig({ workspaceId: sessionWorkspaceId, api: sessionApi }) : null),
        [sessionApi, sessionWorkspaceId],
    )

    // Detail route fallback: page navigation is allowed, but an active adventure
    // is required before mounting the socket-backed interaction surface.
    useEffect(() => {
        if (!isAuthenticated) {
            setPage('active-adventures')
        }
    }, [isAuthenticated, setPage])

    // Get adventure from data context when component mounts
    useEffect(() => {
        if (!isAuthenticated) return

        if (editingInProgress) {
            setCurrentAdventure(editingInProgress)
        } else {
            // Redirect back if no adventure is selected.
            setPage('active-adventures')
        }
    }, [editingInProgress, setPage, isAuthenticated])

    // Load turns from API when adventure is available (in the session's own workspace).
    useEffect(() => {
        if (!currentAdventure || !isAuthenticated || !chatConfig) return

        let isMounted = true
        setIsLoading(true)
        setLoadError(null)

        // Drafts have no history endpoint. Their id changes on the first send;
        // keep the live composer and optimistic turns intact through that change.
        if (currentAdventure.draft || (initialDraftId && currentAdventure.draftId === initialDraftId)) {
            setIsLoading(false)
            return
        }

        const loadTurns = async () => {
            try {
                const sessionId = Number(currentAdventure.id)
                if (Number.isNaN(sessionId)) {
                    throw new Error('Invalid adventure session id')
                }
                const storedTurns = await chatConfig.loadTurns(sessionId)
                if (isMounted) {
                    setTurns(storedTurns)
                }
            } catch (error) {
                console.error('Failed to load adventure messages:', error)
                if (isMounted) {
                    setTurns([])
                    setLoadError(t('common.loadError'))
                }
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }

        void loadTurns()

        return () => {
            isMounted = false
        }
        // Keyed on the adventure id: editing the cloned cards swaps currentAdventure
        // for a new object with the same id, and must NOT reload the chat turns.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatConfig, currentAdventure?.id, isAuthenticated, reloadNonce, t])

    const handleBack = () => {
        goBack('landing')
    }

    const handleRetryLoad = () => setReloadNonce((n) => n + 1)

    // Persist an edit to this adventure's cloned-card snapshot. saveInProgressSnapshot
    // updates editingInProgress, which cascades back into currentAdventure below.
    // The snapshot lives in the session's workspace, so it is written through that
    // workspace's client, never the one committed later.
    const handleSnapshotChange = async (snapshot: AdventureSnapshot) => {
        if (!currentAdventure) return
        await saveInProgressSnapshot(currentAdventure.id, snapshot, sessionApi)
        setCurrentAdventure((prev) =>
            prev ? { ...prev, snapshot, scenario: snapshot.template.description ?? prev.scenario } : prev,
        )
    }

    if (!isAuthenticated) {
        return null
    }

    if (!currentAdventure || !chatConfig) {
        return <LoadingSpinner message={t('interaction.loadingAdventure')} />
    }

    if (isLoading) {
        return <LoadingSpinner message={t('interaction.loadingTurns')} />
    }

    if (loadError) {
        return (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-ink-800 p-8 text-center">
                <p className="max-w-md font-narrative text-[16px] leading-relaxed text-parchment-300">{loadError}</p>
                <Button variant="primary" onClick={handleRetryLoad}>{t('common.tryAgain')}</Button>
            </div>
        )
    }

    const title = currentAdventure.snapshot?.template?.name?.trim() || t('interaction.adventureFallbackTitle')

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-ink-800 xl:flex-row">
            <InteractionTopBar
                title={title}
                mode="adventure"
                onToggleLeft={() => openPanel('left')}
                leftOpen={openPanelId === 'left'}
                onToggleRight={() => openPanel('right')}
                rightOpen={openPanelId === 'right'}
                dockAt="xl"
            />

            <div className="flex min-h-0 flex-1 overflow-hidden lg:flex-row">
                <SidePanelDrawer side="left" open={openPanelId === 'left'} onClose={closePanels} label={t('interaction.panels.detailsLabel')} dockAt="xl">
                    <InteractionLeftPanel
                        adventure={currentAdventure}
                        onBack={handleBack}
                        onSnapshotChange={handleSnapshotChange}
                        readOnly={sessionReadOnly}
                        narratorPickerOpen={narratorPickerOpen && !sessionReadOnly}
                        onNarratorPickerOpenChange={setNarratorPickerOpen}
                        narrationTierSlot={sessionApi && !currentAdventure.draft ? (
                            <SessionNarrationTierToggle
                                api={sessionApi}
                                basePath="adventure-sessions"
                                sessionId={Number(currentAdventure.id)}
                                readOnly={sessionReadOnly}
                            />
                        ) : null}
                    />
                </SidePanelDrawer>

                <div className="min-w-0 flex-1">
                    <InteractionCenterPanel
                        key={currentAdventure.draftId ?? currentAdventure.id}
                        sessionId={Number(currentAdventure.id)}
                        ensureSession={currentAdventure.draft ? () => ensureAdventureSession(currentAdventure) : undefined}
                        turns={turns} setTurns={setTurns} config={chatConfig}
                        onEditNarratorVoice={sessionReadOnly ? undefined : openNarratorPicker}
                    />
                </div>

                <SidePanelDrawer side="right" open={openPanelId === 'right'} onClose={closePanels} label={t('interaction.panels.logLabel')} dockAt="xl">
                    <InteractionRightPanel turns={turns} />
                </SidePanelDrawer>
            </div>
        </div>
    )
}
