/**
 * Adventure interaction component
 */

import {useEffect, useState} from 'react'
import type {Adventure, TurnEntry} from '../../../shared'
import { useNavigation, useData } from '../../../app/hooks'
import { LoadingSpinner } from '../../../ui/components'
import { storage } from '../../../infrastructure/storage'
import {InteractionCenterPanel, InteractionLeftPanel, InteractionRightPanel} from './index'
import './AdventureInteraction.css'

export function AdventureInteraction() {
    const { previousPage, setPage } = useNavigation()
    const { editingInProgress } = useData()
    const [currentAdventure, setCurrentAdventure] = useState<Adventure | null>(null)
    const [turns, setTurns] = useState<TurnEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false)
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)

    // Get adventure from data context when component mounts
    useEffect(() => {
        if (editingInProgress) {
            setCurrentAdventure(editingInProgress)
        } else {
            // Redirect back if no adventure is selected
            setPage('landing')
        }
    }, [editingInProgress, setPage])

    // Load turns from storage when adventure is available
    useEffect(() => {
        if (!currentAdventure) return

        let isMounted = true
        setIsLoading(true)

        const loadTurns = async () => {
            try {
                // Get turns from the adventure if available, otherwise load from storage
                if (currentAdventure.turns && currentAdventure.turns.length > 0) {
                    if (isMounted) {
                        setTurns(currentAdventure.turns);
                        setIsLoading(false);
                    }
                } else {
                    // Try to load turns from storage if the adventure doesn't have them
                    try {
                        const loadedTurns = await storage.loadTurns(currentAdventure.id);
                        if (isMounted) {
                            setTurns(loadedTurns);
                        }
                    } catch (error) {
                        console.error('Failed to load turns, creating empty turns array:', error);
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
    }, [currentAdventure])

    const handleBack = () => {
        setPage(previousPage || 'landing')
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

    if (!currentAdventure) {
        return <LoadingSpinner message="Loading adventure..." />
    }

    if (isLoading) {
        return <LoadingSpinner message="Loading adventure turns..." />
    }

    return (
        <div className="adventure-interaction">
            <div className="interaction-layout">
                {/* Left Panel Toggle Button */}
                <button 
                    className={`adventure-interaction__toggle adventure-interaction__toggle--left interaction-focusable ${isLeftPanelOpen ? 'is-active' : ''}`}
                    onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                    aria-label="Toggle adventure details"
                    aria-expanded={isLeftPanelOpen}
                >
                    <span className="adventure-interaction__toggle-icon">☰</span>
                </button>

                {/* Left Panel */}
                <div 
                    className={`adventure-interaction__panel adventure-interaction__panel--left ${isLeftPanelOpen ? 'is-open' : ''}`}
                    onClick={handlePanelBackdropClick}
                >
                    <div className="adventure-interaction__panel-content interaction-scrollbar">
                        <InteractionLeftPanel 
                            adventure={currentAdventure} 
                            onBack={handleBack}
                        />
                    </div>
                </div>

                {/* Center Panel */}
                <div className={`adventure-interaction__center ${isLeftPanelOpen ? 'adventure-interaction__center--left-open' : ''} ${isRightPanelOpen ? 'adventure-interaction__center--right-open' : ''}`}>
                    <InteractionCenterPanel 
                        adventure={currentAdventure}
                        turns={turns}
                        setTurns={setTurns}
                    />
                </div>

                {/* Right Panel */}
                <div 
                    className={`adventure-interaction__panel adventure-interaction__panel--right ${isRightPanelOpen ? 'is-open' : ''}`}
                    onClick={handlePanelBackdropClick}
                >
                    <div className="adventure-interaction__panel-content interaction-scrollbar">
                        <InteractionRightPanel 
                            adventure={currentAdventure}
                            turns={turns}
                        />
                    </div>
                </div>

                {/* Right Panel Toggle Button */}
                <button 
                    className={`adventure-interaction__toggle adventure-interaction__toggle--right interaction-focusable ${isRightPanelOpen ? 'is-active' : ''}`}
                    onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                    aria-label="Toggle turn history"
                    aria-expanded={isRightPanelOpen}
                >
                    <span className="adventure-interaction__toggle-icon">📜</span>
                </button>
            </div>
        </div>
    )
}
