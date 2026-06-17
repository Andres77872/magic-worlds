import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CardUsageLine } from './CardUsageLine'

afterEach(cleanup)

describe('CardUsageLine', () => {
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
