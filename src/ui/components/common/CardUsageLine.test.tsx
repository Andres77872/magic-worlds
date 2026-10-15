import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CardUsageLine } from './CardUsageLine'

afterEach(cleanup)
beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'true')
    vi.stubEnv('VITE_FEATURE_GROUP_CHATS_ENABLED', 'true')
})
afterEach(() => vi.unstubAllEnvs())

describe('CardUsageLine', () => {
    it.each(['VITE_FEATURE_ADVENTURES_ENABLED', 'VITE_FEATURE_GROUP_CHATS_ENABLED'])(
        'omits combined session counts when %s is disabled', (env) => {
            vi.stubEnv(env, 'false')
            render(<CardUsageLine usage={{ sessions: 5, stories: 2 }} />)
            expect(screen.getByText('Used in 2 stories')).toBeInTheDocument()
            expect(screen.queryByText(/sessions/)).not.toBeInTheDocument()
        },
    )
    it('does not label preserved hidden usage as unused', () => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'false')
        vi.stubEnv('VITE_FEATURE_ADVENTURES_ENABLED', 'false')
        const { container } = render(<CardUsageLine usage={{ sessions: 5, stories: 2 }} showNone />)
        expect(container).toBeEmptyDOMElement()
    })
    it('hides disabled novel counts without altering the stored usage', () => {
        vi.stubEnv('VITE_FEATURE_NOVELS_ENABLED', 'false')
        const usage = { sessions: 1, stories: 2 }
        render(<CardUsageLine usage={usage} />)
        expect(screen.getByText('Used in 1 session')).toBeInTheDocument()
        expect(screen.queryByText(/stories/)).not.toBeInTheDocument()
        expect(usage).toEqual({ sessions: 1, stories: 2 })
    })
    it('renders both clauses joined by a separator', () => {
        render(<CardUsageLine usage={{ sessions: 5, stories: 2 }} />)
        expect(screen.getByText('Used in 5 sessions · 2 stories')).toBeInTheDocument()
    })

    it('omits the zero clause', () => {
        render(<CardUsageLine usage={{ sessions: 1, stories: 0 }} />)
        expect(screen.getByText('Used in 1 session')).toBeInTheDocument()
    })

    it('renders nothing when both counts are zero and showNone is off', () => {
        const { container } = render(<CardUsageLine usage={{ sessions: 0, stories: 0 }} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders "Not used yet" when both are zero and showNone is on', () => {
        render(<CardUsageLine usage={{ sessions: 0, stories: 0 }} showNone />)
        expect(screen.getByText('Not used yet')).toBeInTheDocument()
    })

    it('renders nothing while usage is null (loading/unknown)', () => {
        const { container } = render(<CardUsageLine usage={null} showNone />)
        expect(container).toBeEmptyDOMElement()
    })
})
