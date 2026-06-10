import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModeBadge } from './ModeBadge'

afterEach(cleanup)

describe('ModeBadge', () => {
    it('labels the adventure mode', () => {
        render(<ModeBadge mode="adventure" />)
        expect(screen.getByText('Adventure')).toBeInTheDocument()
        expect(screen.getByTitle('Game Master–led sessions')).toBeInTheDocument()
    })

    it('labels the chat mode', () => {
        render(<ModeBadge mode="chat" />)
        expect(screen.getByText('Chat')).toBeInTheDocument()
        expect(screen.getByTitle('One-on-one conversations')).toBeInTheDocument()
    })

    it('compact variant drops the text label but keeps the name as a tooltip', () => {
        render(<ModeBadge mode="adventure" compact />)
        expect(screen.queryByText('Adventure')).not.toBeInTheDocument()
        expect(screen.getByTitle('Adventure')).toBeInTheDocument()
    })
})
