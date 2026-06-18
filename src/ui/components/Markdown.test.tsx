import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

describe('Markdown', () => {
    it('renders into the .chat-prose wrapper that the theme styles target', () => {
        const { container } = render(<Markdown content="hello" />)
        const wrapper = container.firstElementChild
        expect(wrapper).toHaveClass('chat-prose')
    })

    it('appends extra classes and maps block elements to the markdown-* classes', () => {
        const { container } = render(
            <Markdown content={'# Title\n\n- one\n- two\n\n> quote\n\n`code`'} className="text-[15px]" />,
        )
        const wrapper = container.firstElementChild
        expect(wrapper).toHaveClass('chat-prose')
        expect(wrapper).toHaveClass('text-[15px]')
        expect(container.querySelector('h1')).toHaveClass('markdown-h1')
        expect(container.querySelector('ul')).toHaveClass('markdown-list')
        expect(container.querySelector('li')).toHaveClass('markdown-list-item')
        expect(container.querySelector('blockquote')).toHaveClass('markdown-blockquote')
        expect(container.querySelector('code')).toHaveClass('markdown-code-inline')
    })

    it('renders the trailing slot inside the wrapper', () => {
        const { getByTestId, container } = render(
            <Markdown content="hi" trailing={<span data-testid="dots">…</span>} />,
        )
        expect(container.firstElementChild).toContainElement(getByTestId('dots'))
    })
})
