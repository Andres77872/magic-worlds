import { createContext, type ComponentType } from 'react'
import type { MarkdownLinkProps } from '@/ui/components'

/**
 * Optional link renderer for assistant replies. A surface provides one to make
 * its links richer (the app assistant previews card links on hover); without a
 * provider replies keep plain links. The value must be a stable component.
 */
export const AssistantLinkContext = createContext<ComponentType<MarkdownLinkProps> | null>(null)
