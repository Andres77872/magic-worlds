import { useContext, type ReactNode } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'
import { PreviewAllowanceContext } from './previewAllowanceContext'
import { useLocalPreviewAllowance } from './usePreviewAllowance'

function AllowanceScope({ children, userHash }: { children: ReactNode; userHash: string | null }) {
    const allowance = useLocalPreviewAllowance(userHash)
    return <PreviewAllowanceContext.Provider value={allowance}>{children}</PreviewAllowanceContext.Provider>
}

export function PreviewAllowanceProvider({ children, userHash }: { children: ReactNode; userHash?: string | null }) {
    const auth = useContext(AuthContext)
    const account = userHash === undefined ? auth?.userHash ?? null : userHash
    return <AllowanceScope key={account ?? ''} userHash={account}>{children}</AllowanceScope>
}
