/**
 * Adventure interaction component
 */

import {useEffect, useState} from 'react'
import type {Adventure, AdventureSnapshot, TurnEntry} from '../../../shared'
import { Menu, ScrollText } from 'lucide-react'
import { useNavigation, useData, useAuth } from '../../../app/hooks'
import { LoadingSpinner } from '../../../ui/components'
import { apiService } from '../../../infrastructure/api'
import { parseTurnState } from '../../../utils/turnState'
import { cx, IconButton } from '../../../ui/primitives'
import {InteractionCenterPanel, InteractionLeftPanel, InteractionRightPanel} from './index'

export function AdventureInteraction() {
    const { previousPage, setPage } = useNavigation()
    const { editingInProgress, saveInProgressSnapshot } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()
    const [currentAdventure, setCurrentAdventure] = useState<Adventure | null>(null)
    const [turns, setTurns] = useState<TurnEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false)
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)

    // Gate behind auth — unauthenticated users cannot access interaction
    useEffect(() => {
        if (!isAuthenticated) {
            openLoginModal()
            setPage('landing')
        }
    }, [isAuthenticated, openLoginModal, setPage])

    // Get adventure from data context when component mounts
    useEffect(() => {
        if (!isAuthenticated) return

        if (editingInProgress) {
            setCurrentAdventure(editingInProgress)
        } else {
            // Redirect back if no adventure is selected
            setPage('landing')
        }
    }, [editingInProgress, setPage, isAuthenticated])

    // Load turns from API when adventure is available
    useEffect(() => {
        if (!currentAdventure || !isAuthenticated) return

        let isMounted = true
        setIsLoading(true)

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
                        console.error('Failed to load turns from API, creating empty turns array:', error);
                        if (isMounted) {
                            setTurns([]);
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
    }, [currentAdventure?.id, isAuthenticated])

    const handleBack = () => {
        setPage(previousPage || 'landing')
    }

    // Persist an edit to this adventure's cloned-card snapshot. saveInProgressSnapshot
    // updates editingInProgress, which cascades back into currentAdventure below.
    const handleSnapshotChange = async (snapshot: AdventureSnapshot) => {
        if (!currentAdventure) return
        await saveInProgressSnapshot(currentAdventure.id, snapshot)
        setCurrentAdventure((prev) =>
            prev ? { ...prev, snapshot, scenario: snapshot.template.description ?? prev.scenario } : prev,
        )
    }

    // Handle panel clicks on mobile
    const handlePanelBackdropClick = (e: React.MouseEvent) => {
        // Only close on mobile when clicking the backdrop
        if (window.innerWidth <= 768) {
            const target = e.target as HTMLElement
            if (target.classList.contains('adventure-interaction__panel')) {
                setIsLeftPanelOpen(false)
                setIsRightPanelOpen(false)
            }
        }
    }

    // Close panels on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsLeftPanelOpen(false)
                setIsRightPanelOpen(false)
            }
        }
        
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [])

    if (!isAuthenticated) {
        return null
    }

    if (!currentAdventure) {
        return <LoadingSpinner message="Loading adventure..." />
    }

    if (isLoading) {
        return <LoadingSpinner message="Loading adventure turns..." />
    }

    const toggleBtn = 'absolute top-3 z-30 border border-parchment-50/10 bg-ink-700/80 backdrop-blur lg:hidden'
    // Mobile drawer: the panel element is a full-screen backdrop (its class is the
    // close-on-click hook); the inner content slides in. On lg+ it docks inline.
    const panelBase =
        'adventure-interaction__panel fixed inset-0 z-20 bg-ink-900/60 backdrop-blur-sm transition-opacity ' +
        'lg:static lg:inset-auto lg:z-auto lg:w-[320px] lg:shrink-0 lg:bg-transparent lg:backdrop-blur-none lg:opacity-100 lg:pointer-events-auto'
    const panelContent =
        'h-full w-[320px] max-w-[85%] overflow-y-auto bg-ink-900 transition-transform lg:max-w-none lg:translate-x-0'

    return (
        <div className="relative flex h-[calc(100vh-4rem)] overflow-hidden bg-ink-800">
            {/* Left Panel Toggle Button (mobile) */}
            <IconButton
                label="Toggle adventure details"
                className={cx(toggleBtn, 'left-3', isLeftPanelOpen && 'border-ember-500/45 text-ember-400')}
                onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                aria-expanded={isLeftPanelOpen}
            >
                <Menu size={18} strokeWidth={1.75} />
            </IconButton>

            {/* Left Panel */}
            <div
                className={cx(panelBase, isLeftPanelOpen ? 'opacity-100' : 'pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto')}
                onClick={handlePanelBackdropClick}
            >
                <div className={cx(panelContent, 'border-r border-parchment-50/10', isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
                    <InteractionLeftPanel adventure={currentAdventure} onBack={handleBack} onSnapshotChange={handleSnapshotChange} />
                </div>
            </div>

            {/* Center Panel */}
            <div className="min-w-0 flex-1">
                <InteractionCenterPanel adventure={currentAdventure} turns={turns} setTurns={setTurns} />
            </div>

            {/* Right Panel */}
            <div
                className={cx(panelBase, isRightPanelOpen ? 'opacity-100' : 'pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto')}
                onClick={handlePanelBackdropClick}
            >
                <div className={cx(panelContent, 'ml-auto border-l border-parchment-50/10', isRightPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')}>
                    <InteractionRightPanel adventure={currentAdventure} turns={turns} />
                </div>
            </div>

            {/* Right Panel Toggle Button (mobile) */}
            <IconButton
                label="Toggle turn history"
                className={cx(toggleBtn, 'right-3', isRightPanelOpen && 'border-ember-500/45 text-ember-400')}
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                aria-expanded={isRightPanelOpen}
            >
                <ScrollText size={18} strokeWidth={1.75} />
            </IconButton>
        </div>
    )
}
