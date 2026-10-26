import type { PageType } from '@/shared/types'

/**
 * Which pages hold workspace content (document 08 "Startup handshake").
 *
 * - `private`: workspace content (cards, sessions, chats, calls, lorebooks,
 *   resources, stories, media, assistant). Waits for the workspace handshake and
 *   shows the blocking unavailable/stale states.
 * - `account`: account-wide pages (profile, billing, model/image profiles,
 *   voices, notifications, admin consoles). Never wait for the handshake.
 * - `public`: no sign-in needed (landing, community, shared card, docs, legal,
 *   auth flows). Never wait for the handshake.
 *
 * The landing page doubles as the signed-in dashboard of private content, so it
 * is treated as private while signed in (see `pageNeedsWorkspace`).
 */
export type PageAccess = 'public' | 'account' | 'private'

export const PAGE_ACCESS: Readonly<Record<PageType, PageAccess>> = {
    landing: 'public',
    library: 'private',
    character: 'private',
    world: 'private',
    item: 'private',
    adventure: 'private',
    lorebook: 'private',
    interaction: 'private',
    'character-chat': 'private',
    chatroom: 'private',
    'active-adventures': 'private',
    notifications: 'account',
    calls: 'private',
    community: 'public',
    assistant: 'private',
    'shared-card': 'public',
    profile: 'account',
    'llm-profiles': 'account',
    'admin-llm-profiles': 'account',
    'image-profiles': 'account',
    'admin-image-profiles': 'account',
    billing: 'account',
    'voice-studio': 'account',
    'admin-voices': 'account',
    'admin-agents': 'account',
    'admin-credit-codes': 'account',
    'admin-membership': 'account',
    docs: 'public',
    about: 'public',
    contact: 'public',
    privacy: 'public',
    disclaimer: 'public',
    terms: 'public',
    'gallery-characters': 'private',
    'gallery-personas': 'private',
    'gallery-worlds': 'private',
    'gallery-items': 'private',
    'gallery-adventures': 'private',
    'gallery-lorebooks': 'private',
    'gallery-resources': 'private',
    'gallery-media': 'private',
    'gallery-stories': 'private',
    story: 'private',
    'password-reset': 'public',
    'verify-email': 'public',
    'google-callback': 'public',
    'not-found': 'public',
}

/** Whether `page` shows workspace content for this viewer (and so waits for the handshake). */
export function pageNeedsWorkspace(page: PageType, isAuthenticated: boolean): boolean {
    if (!isAuthenticated) return false
    return PAGE_ACCESS[page] === 'private' || page === 'landing'
}

/**
 * Which sign-in invitation a guest sees in place of a page that only lists their
 * own content. Without it these pages had nothing to load and rendered endless
 * skeletons, "nothing yet" empty states or 401 → "session expired" errors.
 *
 * Pages that already have a guest mode stay off this list: the creators (draft,
 * then sign in to save), story (reauthentication gate), assistant, profile
 * (email credit-claim links), billing, the model/image/voice settings, admin
 * consoles, the card galleries (community view; gated in-page), and the session
 * pages a guest can only reach through a link.
 */
export type GuestGateKind = 'library' | 'play' | 'media' | 'notifications'

const GUEST_GATES: Readonly<Partial<Record<PageType, GuestGateKind>>> = {
    library: 'library',
    'gallery-lorebooks': 'library',
    'gallery-resources': 'library',
    'gallery-stories': 'library',
    'gallery-media': 'media',
    chatroom: 'play',
    'active-adventures': 'play',
    calls: 'play',
    notifications: 'notifications',
}

/** The gate a signed-out viewer sees instead of `page`, or null when the page renders. */
export function guestGateFor(page: PageType, isAuthenticated: boolean): GuestGateKind | null {
    if (isAuthenticated) return null
    return GUEST_GATES[page] ?? null
}
