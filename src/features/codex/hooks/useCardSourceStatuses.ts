import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { scopedApi } from '@/shared/hooks/useScopedApi'
import type { CardIdentity, CardSourceStatus } from '@/shared/types/workspace.types'

export type SourceCheckState = 'unchecked' | 'checking' | 'ready' | 'failed'

/** Advisory metadata only. No source read changes a frozen card or a conversation. */
export function useCardSourceStatuses(cards: readonly CardIdentity[], workspaceId?: string | null) {
    const workspace = useContext(WorkspaceContext)
    const targetWorkspace = workspaceId ?? workspace?.selectedWorkspaceId
    const capturedApi = useMemo(() => scopedApi(workspaceId), [workspaceId])
    const api = capturedApi ?? workspace?.api
    const owner = workspace?.capture()
    const identities = JSON.stringify([...new Map(cards.map((card) => [`${card.card_type}:${card.card_id}`, card])).values()]
        .sort((a, b) => `${a.card_type}:${a.card_id}`.localeCompare(`${b.card_type}:${b.card_id}`)))
    const [revision, setRevision] = useState(0)
    const key = JSON.stringify([owner?.accountKey, owner?.authEpoch, owner?.workspaceEpoch, targetWorkspace, identities, revision])
    const [result, setResult] = useState<{ key: string; state: SourceCheckState; statuses: ReadonlyMap<string, CardSourceStatus> }>({
        key: '', state: 'unchecked', statuses: new Map(),
    })
    const recheck = useCallback(() => setRevision((value) => value + 1), [setRevision])
    const capture = workspace?.capture
    const isCurrent = workspace?.isCurrent

    useEffect(() => {
        const requested: CardIdentity[] = JSON.parse(identities)
        if (!api || !targetWorkspace || !capture || !isCurrent || requested.length === 0) return
        const captured = capture()
        if (!captured) return
        const controller = new AbortController()
        let active = true
        void api.getCardSourceStatuses(targetWorkspace, requested, controller.signal).then((response) => {
            if (active && isCurrent(captured)) setResult({ key, state: 'ready',
                statuses: new Map(response.items.map((item) => [`${item.card_type}:${item.card_id}`, item])) })
        }).catch(() => {
            if (active && isCurrent(captured)) setResult({ key, state: 'failed', statuses: new Map() })
        })
        return () => { active = false; controller.abort() }
    }, [api, targetWorkspace, key, identities, revision, capture, isCurrent])

    return { state: result.key === key ? result.state : (api && targetWorkspace && owner && cards.length ? 'checking' : 'unchecked') as SourceCheckState,
        statuses: result.key === key ? result.statuses : new Map<string, CardSourceStatus>(), recheck }
}
