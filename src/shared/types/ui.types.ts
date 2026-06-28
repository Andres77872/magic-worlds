/**
 * UI and component-related types
 */

import type { ReactNode } from 'react'

export interface CardOption {
    type: 'custom' | 'edit' | 'delete' | 'start' | 'open'
    icon?: ReactNode
    label?: string
    onClick: () => void
    disabled?: boolean
    danger?: boolean
}

export type ThemeOption = 'light' | 'dark' | 'system'

export type PageType =
    | 'landing'
    | 'character'
    | 'world'
    | 'item'
    | 'adventure'
    | 'lorebook'
    | 'interaction'
    | 'character-chat'
    | 'chatroom'
    | 'active-adventures'
    | 'calls'
    | 'community'
    | 'shared-card'
    | 'profile'
    | 'billing'
    | 'voice-studio'
    | 'admin-voices'
    | 'admin-agents'
    | 'admin-credit-codes'
    | 'docs'
    | 'about'
    | 'contact'
    | 'privacy'
    | 'disclaimer'
    | 'gallery-characters'
    | 'gallery-personas'
    | 'gallery-worlds'
    | 'gallery-items'
    | 'gallery-adventures'
    | 'gallery-lorebooks'
    | 'gallery-resources'
    | 'gallery-media'
    | 'gallery-stories'
    | 'story'
    | 'password-reset'
    | 'verify-email'
    | 'google-callback'
    | 'not-found'

export interface NavigationState {
    currentPage: PageType
    previousPage?: PageType
}

export interface LoadingState {
    isLoading: boolean
    error?: string
}
