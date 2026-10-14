import { describe, expect, it, vi } from 'vitest'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import { ApiError, WorkspaceApiError } from '@/infrastructure/api'
import { VOICE_RELOAD_REQUIRED, voiceSaveError, workspaceSaveErrorKey } from './useCreatorWorkspace'

function lookup(locale: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        locale,
    )
}

const reloadRequired = (metadata: Partial<Pick<ApiError, 'code' | 'details'>> = { code: VOICE_RELOAD_REQUIRED }) =>
    new ApiError(409, 'This voice was updated since you opened it. Reload to see the current voice.', metadata)

describe('voiceSaveError', () => {
    it('maps the 409 voice_reload_required to the reload copy with a Reload action that refetches', () => {
        const reload = vi.fn()
        const mapped = voiceSaveError(reloadRequired(), reload)
        expect(mapped?.key).toBe('voices.errors.reloadRequired')
        expect(mapped?.action?.labelKey).toBe('voices.errors.reloadAction')
        mapped?.action?.run()
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('reads the code from a bare {detail: {code, message, path}} too', () => {
        const error = reloadRequired({ details: { code: VOICE_RELOAD_REQUIRED, message: 'Reload.', path: 'voice' } })
        expect(voiceSaveError(error, () => undefined)?.key).toBe('voices.errors.reloadRequired')
    })

    it('offers no action without a refetch', () => {
        expect(voiceSaveError(reloadRequired())).toEqual({ key: 'voices.errors.reloadRequired', action: null })
    })

    it.each([
        ['voice_v1_not_allowed', 'voices.errors.v1NotAllowed'],
        ['voice_not_eligible', 'voices.picker.eligibilityError'],
        ['voice_plan_locked', 'voices.errors.planLocked'],
        ['voice_invalid', 'voices.errors.invalid'],
    ])('maps the 422 %s to %s without an action', (code, key) => {
        const reload = vi.fn()
        expect(voiceSaveError(new ApiError(422, 'refused', { code }), reload)).toEqual({ key, action: null })
        expect(reload).not.toHaveBeenCalled()
    })

    it('ignores other errors, other statuses and unknown codes', () => {
        expect(voiceSaveError(new Error('boom'))).toBeNull()
        expect(voiceSaveError(new ApiError(500, 'down'))).toBeNull()
        expect(voiceSaveError(new ApiError(422, 'refused', { code: 'content_blocked' }))).toBeNull()
        expect(voiceSaveError(new ApiError(422, 'refused', { code: VOICE_RELOAD_REQUIRED }))).toBeNull()
        expect(voiceSaveError(new ApiError(409, 'conflict', { code: 'voice_v1_not_allowed' }))).toBeNull()
        expect(
            voiceSaveError(new WorkspaceApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' })),
        ).toBeNull()
    })

    it('keeps the workspace save mapping', () => {
        expect(workspaceSaveErrorKey(new WorkspaceApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' }))).toBe(
            'workspaceContent.saveErrors.archived',
        )
        expect(workspaceSaveErrorKey(reloadRequired())).toBeNull()
    })

    it('points every key at en and es copy', () => {
        const keys = [
            'voices.errors.reloadRequired',
            'voices.errors.reloadAction',
            'voices.errors.v1NotAllowed',
            'voices.picker.eligibilityError',
            'voices.errors.planLocked',
            'voices.errors.invalid',
        ]
        for (const key of keys) {
            expect(typeof lookup(en, key)).toBe('string')
            expect(typeof lookup(es, key)).toBe('string')
        }
    })
})
