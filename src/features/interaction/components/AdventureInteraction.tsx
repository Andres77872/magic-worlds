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
            if (target.classList.contains('panel-container')) {
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
                    className={`panel-toggle panel-toggle-left ${isLeftPanelOpen ? 'active' : ''}`}
                    onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                    aria-label="Toggle adventure details"
                >
                    <span className="toggle-icon">☰</span>
                </button>

                {/* Left Panel */}
                <div 
                    className={`panel-container panel-left ${isLeftPanelOpen ? 'open' : ''}`}
                    onClick={handlePanelBackdropClick}
                >
                    <InteractionLeftPanel 
                        adventure={currentAdventure} 
                        onBack={handleBack}
                    />
                </div>

                {/* Center Panel */}
                <InteractionCenterPanel 
                    adventure={currentAdventure}
                    turns={turns}
                    setTurns={setTurns}
                />

                {/* Right Panel */}
                <div 
                    className={`panel-container panel-right ${isRightPanelOpen ? 'open' : ''}`}
                    onClick={handlePanelBackdropClick}
                >
                    <InteractionRightPanel 
                        adventure={currentAdventure}
                        turns={turns}
                    />
                </div>

                {/* Right Panel Toggle Button */}
                <button 
                    className={`panel-toggle panel-toggle-right ${isRightPanelOpen ? 'active' : ''}`}
                    onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                    aria-label="Toggle turn history"
                >
                    <span className="toggle-icon">📜</span>
                </button>
            </div>
        </div>
    )
}
