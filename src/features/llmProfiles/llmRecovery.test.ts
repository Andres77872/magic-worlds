import i18next from 'i18next'
import { expect, it } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { llmRecoveryMessage } from './llmRecovery'

it('explains a request refused for lack of credits instead of a generic failure', () => {
    const t = i18next.t.bind(i18next)
    const refused = new ApiError(402, 'PLATFORM_CREDITS_EXHAUSTED', { code: 'PLATFORM_CREDITS_EXHAUSTED', retryable: false })
    expect(llmRecoveryMessage(refused, t)).toBe('You have no credits left for this request, so it was not sent and nothing was charged. Daily credits renew at 00:00 UTC, or add credits in Plans & credits.')
    expect(llmRecoveryMessage(new ApiError(500, 'boom', { code: 'SOMETHING_ELSE', retryable: false }), t)).toBeNull()
})
