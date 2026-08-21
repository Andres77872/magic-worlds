/**
 * Process-wide authentication ownership coordinator.
 *
 * React owns presentation state, but requests, blobs, streams, and WebSockets
 * can outlive a provider render. This coordinator gives every transport a
 * synchronous epoch/account snapshot so work started by one session can never
 * complete or recover under another.
 */

const TOKEN_STORAGE_KEY = 'magic_worlds:token'
const USER_STORAGE_KEY = 'magic_worlds:user'

export type AuthSessionPhase = 'authenticated' | 'expired' | 'signed_out' | 'logging_out'

export interface AuthSessionSnapshot {
    sessionPhase: AuthSessionPhase
    authEpoch: number
    accountKey: string
    userHash: string | null
    token: string
}

type Listener = (snapshot: AuthSessionSnapshot) => void

function storedToken(): string {
    const value = localStorage.getItem(TOKEN_STORAGE_KEY)
    return value ? value.replace(/"/g, '') : ''
}

function storedUserHash(): string | null {
    const value = localStorage.getItem(USER_STORAGE_KEY)
    if (!value) return null
    try {
        const user = JSON.parse(value) as { user_hash?: unknown }
        return typeof user.user_hash === 'string' && user.user_hash ? user.user_hash : null
    } catch {
        return null
    }
}

let sessionPhase: AuthSessionPhase = storedToken() ? 'authenticated' : 'signed_out'
let authEpoch = 0
let accountSequence = 0
let userHash = storedUserHash()
let accountKey = userHash ? `user:${userHash}:${accountSequence}` : `signed-out:${accountSequence}`
let logoutInFlight: Promise<void> | null = null
const listeners = new Set<Listener>()

function snapshot(): AuthSessionSnapshot {
    return {
        sessionPhase,
        authEpoch,
        accountKey,
        userHash,
        token: storedToken(),
    }
}

function publish(): AuthSessionSnapshot {
    const next = snapshot()
    for (const listener of listeners) listener(next)
    return next
}

function nextAccountKey(nextUserHash: string | null): string {
    accountSequence += 1
    return nextUserHash ? `user:${nextUserHash}:${accountSequence}` : `signed-out:${accountSequence}`
}

export const authSession = {
    getSnapshot(): AuthSessionSnapshot {
        return snapshot()
    },

    subscribe(listener: Listener): () => void {
        listeners.add(listener)
        return () => listeners.delete(listener)
    },

    /**
     * Establish an interactive login. Reauthenticating the same expired user
     * preserves accountKey (and therefore the mounted Story Studio), while an
     * explicit logout or different user always receives a fresh owner key.
     */
    authenticate(nextUserHash: string, nextToken: string): AuthSessionSnapshot {
        const sameExpiredOwner = sessionPhase === 'expired' && userHash === nextUserHash
        if (!sameExpiredOwner && userHash !== nextUserHash) {
            accountKey = nextAccountKey(nextUserHash)
        }
        userHash = nextUserHash
        sessionPhase = 'authenticated'
        authEpoch += 1
        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
        return publish()
    },

    /** A token rotation is not an ownership transition and must keep the epoch. */
    rotateToken(nextToken: string, nextUserHash?: string | null): AuthSessionSnapshot {
        if (nextUserHash && userHash && nextUserHash !== userHash) {
            throw new Error('Authentication refresh changed account ownership.')
        }
        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
        return publish()
    },

    expire(): AuthSessionSnapshot {
        if (sessionPhase !== 'expired') authEpoch += 1
        sessionPhase = 'expired'
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        return publish()
    },

    /**
     * Invalidate synchronously before the logout request waits on refresh. The
     * previous user hash is deliberately forgotten so even a quick same-user
     * login after explicit logout gets a new accountKey.
     */
    beginLogout(): AuthSessionSnapshot {
        sessionPhase = 'logging_out'
        authEpoch += 1
        userHash = null
        accountKey = nextAccountKey(null)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
        return publish()
    },

    finishLogout(): AuthSessionSnapshot {
        if (sessionPhase !== 'signed_out') authEpoch += 1
        sessionPhase = 'signed_out'
        return publish()
    },

    continueSignedOut(): AuthSessionSnapshot {
        sessionPhase = 'signed_out'
        authEpoch += 1
        userHash = null
        accountKey = nextAccountKey(null)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
        return publish()
    },

    retainLogout<T>(promise: Promise<T>): Promise<T> {
        let tracked: Promise<void>
        tracked = promise.then(
            () => undefined,
            () => undefined,
        ).finally(() => {
            if (logoutInFlight === tracked) logoutInFlight = null
        })
        logoutInFlight = tracked
        return promise
    },

    async waitForLogout(): Promise<void> {
        if (logoutInFlight) await logoutInFlight
    },

    isCurrent(initiating: Pick<AuthSessionSnapshot, 'authEpoch' | 'accountKey' | 'userHash'>): boolean {
        const current = snapshot()
        return current.authEpoch === initiating.authEpoch
            && current.accountKey === initiating.accountKey
            && current.userHash === initiating.userHash
    },
}
