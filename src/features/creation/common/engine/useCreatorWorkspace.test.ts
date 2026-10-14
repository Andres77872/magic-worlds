import { describe, expect, it } from 'vitest'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import { ApiError, WorkspaceApiError } from '@/infrastructure/api'
import { voiceSaveErrorKey, workspaceSaveErrorKey } from './useCreatorWorkspace'

function lookup(locale: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        locale,
    )
}

const VOICE_KEYS: [string, string][] = [
    ['voice_not_eligible', 'voices.picker.eligibilityError'],
    ['voice_plan_locked', 'voices.errors.planLocked'],
    ['voice_invalid', 'voices.errors.invalid'],
]

describe('voiceSaveErrorKey', () => {
    it.each(VOICE_KEYS)('maps the 422 %s to %s', (code, key) => {
        expect(voiceSaveErrorKey(new ApiError(422, 'refused', { code }))).toBe(key)
    })

    it('reads the code from a bare {detail: {code, message, path}} too', () => {
        const error = new ApiError(422, 'refused', { details: { code: 'voice_plan_locked', message: 'Locked.', path: 'voice' } })
        expect(voiceSaveErrorKey(error)).toBe('voices.errors.planLocked')
    })

    it('ignores other errors, other statuses and unknown codes', () => {
        expect(voiceSaveErrorKey(new Error('boom'))).toBeNull()
        expect(voiceSaveErrorKey(new ApiError(500, 'down'))).toBeNull()
        expect(voiceSaveErrorKey(new ApiError(422, 'refused', { code: 'content_blocked' }))).toBeNull()
        expect(voiceSaveErrorKey(new ApiError(409, 'conflict', { code: 'voice_plan_locked' }))).toBeNull()
        expect(voiceSaveErrorKey(new WorkspaceApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' }))).toBeNull()
    })

    it('keeps the workspace save mapping', () => {
        expect(workspaceSaveErrorKey(new WorkspaceApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' }))).toBe(
            'workspaceContent.saveErrors.archived',
        )
        expect(workspaceSaveErrorKey(new ApiError(422, 'refused', { code: 'voice_plan_locked' }))).toBeNull()
    })

    it('points every key at en and es copy', () => {
        for (const [, key] of VOICE_KEYS) {
            expect(typeof lookup(en, key)).toBe('string')
            expect(typeof lookup(es, key)).toBe('string')
        }
    })
})
