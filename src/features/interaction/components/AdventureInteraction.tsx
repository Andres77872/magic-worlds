/**
 * Adventure interaction component
 */

import {useEffect, useState} from 'react'
import type {Adventure, TurnEntry} from '../../../shared/types'
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

    // Get adventure from navigation state or redirect back
    useEffect(() => {
        // Set the current adventure from the data context
        if (editingInProgress) {
            setCurrentAdventure(editingInProgress)
        } else if (!currentAdventure) {
            setPage('landing')
            return
        }
    }, [editingInProgress, currentAdventure, setPage])

    // Load turns from storage when component mounts or adventure changes
    useEffect(() => {
        if (!currentAdventure) return

        let isMounted = true

        const loadTurns = async () => {
            try {
                setIsLoading(true)
                const loadedTurns = await storage.loadTurns(currentAdventure.id)
                if (isMounted) {
                    setTurns(loadedTurns)
                }
            } catch (error) {
                console.error('Failed to load turns:', error)
                if (isMounted) {
                    setTurns([])
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        loadTurns()

        return () => {
            isMounted = false
        }
    }, [currentAdventure?.id])

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
                />
            </div>
        </div>
    )
}
