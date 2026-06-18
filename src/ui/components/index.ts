/**
 * UI components barrel export
 */

export { Sidebar } from './Sidebar'
export { ApiStatusMonitor } from './ApiStatusMonitor'
export { AppUpdateBanner } from './AppUpdateBanner'
export { LoadingSpinner } from './LoadingSpinner'
export { Markdown } from './Markdown'
export { LoginModal } from './LoginModal'
export { LanguageMenu } from './LanguageMenu'
export { LogoutConfirmDialog } from './LogoutConfirmDialog'
export { ConfirmDialog } from './ConfirmDialog'
export { PersonaPickerDialog } from './PersonaPickerDialog'

// List components
export * from './lists'

// Common components
export * from './common/EmptyState'
export * from './common/ModeBadge'
export * from './common/CopyTextButton'

// Reference panel building blocks (codex / lorebook rows + groups)
export * from './reference'

// Floating window shell (draggable, non-modal preview windows)
export { FloatingWindow } from './windows/FloatingWindow'

// Audio playback
export * from './audio'
