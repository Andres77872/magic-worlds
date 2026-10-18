import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AccountStorageScope } from '@/shared/workspaceStorage'
import { listRetainedAuthorVariants, subscribeAuthorVariantDrafts, type RetainedAuthorVariants } from '../persistence/authorVariantJournal'

export function useRetainedAuthorVariants(scope: AccountStorageScope, current: () => boolean) {
    const key = JSON.stringify([scope.apiOrigin, scope.userHash]), owner = useRef({ key, scope, current })
    const [loaded, setLoaded] = useState<{ key: string; result: RetainedAuthorVariants }>(() => ({ key, result: listRetainedAuthorVariants(scope) }))
    useLayoutEffect(() => { owner.current = { key, scope, current } })
    useEffect(() => {
        let active = true, sequence = 0
        const refresh = () => {
            const ticket = ++sequence
            void Promise.resolve().then(() => {
                if (!active || owner.current.key !== key || !owner.current.current()) return
                const result = listRetainedAuthorVariants(owner.current.scope)
                if (active && ticket === sequence && owner.current.key === key && owner.current.current()) setLoaded({ key, result })
            })
        }
        refresh()
        const unsubscribe = subscribeAuthorVariantDrafts(refresh)
        return () => { active = false; sequence++; unsubscribe() }
    }, [key])
    return current() && loaded.key === key ? loaded.result : null
}
