import { createContext } from 'react'
import type { VoiceUsageView } from '@/shared/voice/voiceUsage'

export interface PreviewAllowance {
    userHash: string | null
    previewsLeft: number | null
    freePreviewsLeft: number | null
    usage: VoiceUsageView | null
    beginRequest: () => number
    setAllowance: (left: number | null, free?: number | null, request?: number) => void
    refreshAllowance: () => Promise<void>
    invalidate: () => void
}

export const PreviewAllowanceContext = createContext<PreviewAllowance | null>(null)
