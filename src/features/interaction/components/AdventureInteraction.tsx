/**
 * Adventure interaction component
 */

import {useCallback, useEffect, useMemo, useState} from 'react'
import { useTranslation } from 'react-i18next'
import type {Adventure, AdventureSnapshot, TurnEntry} from '../../../shared'
import { useNavigation, useData, useAuth } from '../../../app/hooks'
import { LoadingSpinner } from '../../../ui/components'
import { Button } from '@/ui/primitives'
import { apiService } from '../../../infrastructure/api'
import { parseTurnState } from '../../../utils/turnState'
import { adventureChatConfig } from '../chatSessionConfig'
import {InteractionCenterPanel, InteractionLeftPanel, InteractionRightPanel, InteractionTopBar, SidePanelDrawer} from './index'

export function AdventureInteraction() {
    const { t } = useTranslation()
    const { goBack, setPage } = useNavigation()
    const { editingInProgress, saveInProgressSnapshot } = useData()
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
    // Stable per-mount config so the chat engine's callbacks/effects don't churn.
    const chatConfig = useMemo(() => adventureChatConfig(), [])

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

    // Load turns from API when adventure is available
    useEffect(() => {
        if (!currentAdventure || !isAuthenticated) return

        let isMounted = true
        setIsLoading(true)
        setLoadError(null)

        const loadTurns = async () => {
            try {
                // Get turns from the adventure if available, otherwise load from API
                if (currentAdventure.turns && currentAdventure.turns.length > 0) {
                    if (isMounted) {
                        setTurns(parseTurnState(JSON.stringify({ turns: currentAdventure.turns })));
                        setIsLoading(false);
                    }
                } else {
                    // Try to load turns from API if the adventure doesn't have them
                    try {
                        const sessionId = Number(currentAdventure.id);
                        if (!isNaN(sessionId)) {
                            const session = await apiService.getAdventureSession(sessionId);
                            if (isMounted) {
                                setTurns(parseTurnState(session.adventure_last_turn));
                            }
                        } else {
                            if (isMounted) {
                                setTurns([]);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to load turns from API:', error);
                        if (isMounted) {
                            setTurns([]);
                            setLoadError(t('common.loadError'));
                        }
                    } finally {
                        if (isMounted) {
                            setIsLoading(false);
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing adventure turns:', error);
                if (isMounted) {
                    setTurns([]);
                    setLoadError(t('common.loadError'));
                    setIsLoading(false);
                }
            }
        }

        loadTurns();

        return () => {
            isMounted = false
        }
        // Keyed on the adventure id: editing the cloned cards swaps currentAdventure
        // for a new object with the same id, and must NOT reload the chat turns.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAdventure?.id, isAuthenticated, reloadNonce])

    const handleBack = () => {
        goBack('landing')
    }

    const handleRetryLoad = () => setReloadNonce((n) => n + 1)

    // Persist an edit to this adventure's cloned-card snapshot. saveInProgressSnapshot
    // updates editingInProgress, which cascades back into currentAdventure below.
    const handleSnapshotChange = async (snapshot: AdventureSnapshot) => {
        if (!currentAdventure) return
        await saveInProgressSnapshot(currentAdventure.id, snapshot)
        setCurrentAdventure((prev) =>
            prev ? { ...prev, snapshot, scenario: snapshot.template.description ?? prev.scenario } : prev,
        )
    }

    if (!isAuthenticated) {
        return null
    }

    if (!currentAdventure) {
        return <LoadingSpinner message={t('interaction.loadingAdventure')} />
    }

    if (isLoading) {
        return <LoadingSpinner message={t('interaction.loadingTurns')} />
    }

    if (loadError) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink-800 p-8 text-center">
                <p className="max-w-md font-narrative text-[16px] leading-relaxed text-parchment-300">{loadError}</p>
                <Button variant="primary" onClick={handleRetryLoad}>{t('common.tryAgain')}</Button>
            </div>
        )
    }

    const title = currentAdventure.snapshot?.template?.name?.trim() || t('interaction.adventureFallbackTitle')

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-ink-800 lg:flex-row">
            <InteractionTopBar
                title={title}
                mode="adventure"
                onToggleLeft={() => openPanel('left')}
                leftOpen={openPanelId === 'left'}
                onToggleRight={() => openPanel('right')}
                rightOpen={openPanelId === 'right'}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden lg:flex-row">
                <SidePanelDrawer side="left" open={openPanelId === 'left'} onClose={closePanels} label={t('interaction.panels.detailsLabel')}>
                    <InteractionLeftPanel adventure={currentAdventure} onBack={handleBack} onSnapshotChange={handleSnapshotChange} />
                </SidePanelDrawer>

                <div className="min-w-0 flex-1">
                    <InteractionCenterPanel sessionId={Number(currentAdventure.id)} turns={turns} setTurns={setTurns} config={chatConfig} />
                </div>

                <SidePanelDrawer side="right" open={openPanelId === 'right'} onClose={closePanels} label={t('interaction.panels.logLabel')}>
                    <InteractionRightPanel turns={turns} />
                </SidePanelDrawer>
            </div>
        </div>
    )
}
