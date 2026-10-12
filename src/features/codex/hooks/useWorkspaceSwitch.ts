/**
 * useWorkspaceSwitch — runs `onSwitch` after every committed workspace switch
 * (never on mount). Pickers use it to drop their selection and filters and to
 * close: what they listed belongs to the previous workspace.
 */

import { useEffect, useRef } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'

export function useWorkspaceSwitch(onSwitch: () => void): void {
    const { workspaceEpoch } = useWorkspace()
    const onSwitchRef = useRef(onSwitch)
    useEffect(() => {
        onSwitchRef.current = onSwitch
    })
    const epochRef = useRef(workspaceEpoch)
    useEffect(() => {
        if (epochRef.current === workspaceEpoch) return
        epochRef.current = workspaceEpoch
        onSwitchRef.current()
    }, [workspaceEpoch])
}
