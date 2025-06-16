/**
 * Adventure interaction component
 */

import {useEffect, useState} from 'react'
import type {Adventure, TurnEntry} from '../../../shared'
import { useNavigation, useData } from '../../../app/providers'
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

    if (!currentAdventure) {
        return <LoadingSpinner message="Loading adventure..." />
    }

    if (isLoading) {
        return <LoadingSpinner message="Loading adventure turns..." />
    }

    return (
        <div className="adventure-interaction">
            <div className="interaction-layout">
                <InteractionLeftPanel 
                    adventure={currentAdventure} 
                    onBack={handleBack}
                />
                <InteractionCenterPanel 
                    adventure={currentAdventure}
                    turns={turns}
                    setTurns={setTurns}
                />
                <InteractionRightPanel 
                    adventure={currentAdventure}
                    turns={turns}
                />
            </div>
        </div>
    )
}
