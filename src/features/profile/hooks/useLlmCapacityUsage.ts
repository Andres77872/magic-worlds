/**
 * Loads `GET /llm/capacity-usage` — the account's own LLM request counts split
 * by payer — while the Usage tab is open. Results are keyed by account so a
 * switched account never sees the previous account's counts while reloading.
 */
import { useEffect, useState } from 'react'
import { apiService } from '@/infrastructure'
import type { LlmCapacityUsage } from '@/shared/types/llmProfile.types'

export type LlmCapacityUsageState =
    | { status: 'loading'; usage: null }
    | { status: 'ready'; usage: LlmCapacityUsage }
    | { status: 'unavailable'; usage: null }

/**
 * @param accountKey  Stable account identity (user hash); null while unknown.
 * @param enabled     Fetch only while the consuming view is visible.
 * @param reloadToken Any value that changes when the caller re-fetched its own data.
 */
export function useLlmCapacityUsage(accountKey: string | null, enabled: boolean, reloadToken?: unknown): LlmCapacityUsageState {
    const [loaded, setLoaded] = useState<{ accountKey: string; usage: LlmCapacityUsage | null } | null>(null)

    useEffect(() => {
        if (!enabled || !accountKey) return
        let cancelled = false
        apiService
            .getLlmCapacityUsage()
            .then((usage) => {
                if (!cancelled) setLoaded({ accountKey, usage })
            })
            .catch(() => {
                // Disabled profiles (503), auth expiry or a contract violation all
                // read as "unavailable"; the credit view above stays authoritative.
                if (!cancelled) setLoaded({ accountKey, usage: null })
            })
        return () => {
            cancelled = true
        }
    }, [accountKey, enabled, reloadToken])

    if (!accountKey || loaded?.accountKey !== accountKey) return { status: 'loading', usage: null }
    return loaded.usage ? { status: 'ready', usage: loaded.usage } : { status: 'unavailable', usage: null }
}
