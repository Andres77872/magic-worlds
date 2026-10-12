/**
 * The live voice call of this tab, for the workspace switch coordinator
 * (Workspace R1, document 08 "Selected URL and browser-history algorithm",
 * step 6): after the editor guards approve a switch, the coordinator ends an
 * active call and awaits the server's end/quota-release acknowledgement before
 * it commits; if that fails it keeps the source workspace and offers retry.
 * A cancelled switch never touches the call. Archiving a workspace with a live
 * call is refused by the API (`WORKSPACE_ACTIVE_CALL`) until the call ends.
 *
 *     if (hasActiveVoiceCall()) {
 *         try { await endActiveVoiceCall() }        // resolves once the call is over server-side
 *         catch { return keepSourceAndOfferRetry() } // calling again retries the acknowledgement
 *     }
 *     commitWorkspace(target)
 *
 * The account/application one-live-call policy is unchanged; the call screen's
 * controller (`useVoiceCallController`) registers itself here while a call is
 * starting, live, or still waiting for its end acknowledgement.
 */
import { useSyncExternalStore } from 'react'

export interface ActiveVoiceCall {
    /** The workspace of the call's chat; null only when it was unknown. */
    workspaceId: string | null
    /**
     * Ends the call (local teardown first) and resolves once the server
     * acknowledged the end, which releases its quota reservation. Rejects when
     * that could not be confirmed; the call stays registered so a retry can
     * confirm it again.
     */
    end: () => Promise<void>
}

let current: { call: ActiveVoiceCall } | null = null
const listeners = new Set<() => void>()

function notify(): void {
    for (const listener of listeners) listener()
}

/** Registers the live call; the returned function unregisters exactly this registration. */
export function registerActiveVoiceCall(call: ActiveVoiceCall): () => void {
    const entry = { call }
    current = entry
    notify()
    return () => {
        if (current !== entry) return
        current = null
        notify()
    }
}

/** Whether a call is starting, live, or awaiting its end acknowledgement. */
export function hasActiveVoiceCall(): boolean {
    return current !== null
}

/** The workspace of the active call's chat, or null without one. */
export function activeVoiceCallWorkspaceId(): string | null {
    return current?.call.workspaceId ?? null
}

/**
 * Ends the active call and resolves once the server confirmed the end (quota
 * released). Resolves immediately without an active call. Rejects when the
 * end could not be confirmed — the caller keeps the source workspace and may
 * call it again to retry.
 */
export async function endActiveVoiceCall(): Promise<void> {
    const entry = current
    if (!entry) return
    await entry.call.end()
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** Re-renders when a call starts or ends (e.g. to explain that switching ends the call). */
export function useHasActiveVoiceCall(): boolean {
    return useSyncExternalStore(subscribe, hasActiveVoiceCall, hasActiveVoiceCall)
}
