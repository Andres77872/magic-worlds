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

export type PageType = 'landing' | 'character' | 'world' | 'adventure' | 'interaction'

export interface NavigationState {
    currentPage: PageType
    previousPage?: PageType
}

export interface LoadingState {
    isLoading: boolean
    error?: string
}
