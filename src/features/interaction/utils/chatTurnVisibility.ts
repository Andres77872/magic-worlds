import type { TurnEntry } from '@/shared'

/**
 * The transcript mirrors the agent's context. Only completed rows reach the
 * model; a failed or stopped reply is stored empty and skipped, so it is an
 * attempt, not a message.
 */
export function isUnsavedReply(turn: TurnEntry | undefined): boolean {
    return Boolean(turn && turn.type === 'ai' && !turn.isStreaming && turn.metadata?.interrupted === true)
}

/** Why an unsaved reply ended: the player stopped it, or it failed. */
export function unsavedReplyReason(turn: TurnEntry): 'stopped' | 'failed' {
    return turn.metadata?.error_category === 'cancelled' ? 'stopped' : 'failed'
}

/**
 * Regenerating keeps every reply to a player message as a version. The server
 * flags all but the active one; flagged versions never reach the model.
 */
export function isInactiveVersion(turn: TurnEntry): boolean {
    return turn.type === 'ai' && turn.metadata?.inactive_variant === true
}

/** The stored versions of the latest reply, oldest first, and which one is shown. */
export interface ReplyVersions {
    ids: string[]
    index: number
}

export type TranscriptItem =
    | { kind: 'message'; turn: TurnEntry; versions?: ReplyVersions }
    | { kind: 'unsaved'; turn: TurnEntry }

function isStoredReply(turn: TurnEntry): boolean {
    return turn.type === 'ai' && !turn.isStreaming && !isUnsavedReply(turn)
}

/**
 * The reply shown for the latest player message: the one being written, else
 * the active version (the newest, should the server have none flagged active).
 */
export function latestExchangeReply(turns: TurnEntry[]): { shown?: TurnEntry; versions: ReplyVersions } {
    const start = lastUserIndex(turns)
    const replies = start < 0 ? [] : turns.slice(start + 1)
    const stored = replies.filter(isStoredReply)
    const writing = replies.find((turn) => turn.type === 'ai' && turn.isStreaming)
    const candidates = writing ? [...stored, writing] : stored
    const active = stored.filter((turn) => !isInactiveVersion(turn))
    const shown = writing ?? active[active.length - 1] ?? stored[stored.length - 1]
    return { shown, versions: { ids: candidates.map((turn) => turn.id), index: shown ? candidates.indexOf(shown) : -1 } }
}

/**
 * What the reader sees. Inactive versions and unsaved replies collapse: the
 * latest player message shows one reply (with its versions to switch between),
 * and only an unsaved reply at the tail remains, as a notice offering a retry.
 */
export function transcriptItems(turns: TurnEntry[]): TranscriptItem[] {
    const start = lastUserIndex(turns)
    const latest = latestExchangeReply(turns)
    const items: TranscriptItem[] = []
    turns.forEach((turn, index) => {
        if (isUnsavedReply(turn)) {
            if (index === turns.length - 1) items.push({ kind: 'unsaved', turn })
            return
        }
        if (start >= 0 && index > start && turn.type === 'ai') {
            if (turn !== latest.shown) return
            items.push(latest.versions.ids.length > 1 ? { kind: 'message', turn, versions: latest.versions } : { kind: 'message', turn })
            return
        }
        if (!isInactiveVersion(turn)) items.push({ kind: 'message', turn })
    })
    return items
}

/** Index of the player message the trailing replies answer, or -1. */
export function lastUserIndex(turns: TurnEntry[]): number {
    for (let index = turns.length - 1; index >= 0; index--) {
        if (turns[index].type === 'user') return index
    }
    return -1
}
