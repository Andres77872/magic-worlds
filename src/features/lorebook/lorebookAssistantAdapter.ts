import type { Lorebook } from '@/shared/types/lorebook.types'
import type { AssistantAdapter } from '@/features/creation/common/components/assistant/assistantModel'
import { lorebookToApiPayload } from './lorebookTransforms'

/** The live draft in its stored (camelCase) shape, without resource metadata, plus its id once saved. */
function currentLorebookPayload(lorebook: Lorebook): Record<string, unknown> {
    const stored = lorebookToApiPayload(lorebook)
    delete stored.metadata
    const id = typeof lorebook.id === 'string' && lorebook.id.trim() ? lorebook.id : undefined
    return id ? { id, ...stored } : stored
}

/**
 * The lorebook studio's copilot. Every turn carries the live draft; once the
 * book is saved, it also carries the saved revision so the server can refuse
 * edits made elsewhere meanwhile.
 */
export const lorebookAssistantAdapter: AssistantAdapter<'lorebook'> = {
    kind: 'lorebook',
    lifecycle: 'panel',
    scope: (binding) => ({ kind: 'lorebook', ...(binding.targetId ? { lorebook_id: binding.targetId } : {}) }),
    title: (binding) => binding.title,
    turnBody: (binding, message, bound) => ({
        kind: 'lorebook',
        message,
        current: currentLorebookPayload(binding.current),
        ...(bound ? { expected_revision: bound.cas.revision, expected_content_hash: bound.cas.content_hash } : {}),
    }),
}
