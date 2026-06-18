import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NavigationProvider } from './NavigationProvider'
import { useNavigation } from '../hooks/useNavigation'

function Probe() {
    const { currentPage, previousPage, setPage, goBack, cardEdit, resourceEdit, replaceHash } = useNavigation()

    return (
        <div>
            <span data-testid="page">{currentPage}</span>
            <span data-testid="previous">{previousPage ?? 'none'}</span>
            <span data-testid="card-edit">{cardEdit ? `${cardEdit.cardType}:${cardEdit.cardId}:${cardEdit.version ?? 'default'}` : 'none'}</span>
            <span data-testid="resource-edit">{resourceEdit ? `${resourceEdit.resourceId}:${resourceEdit.createType ?? 'none'}` : 'none'}</span>
            <button type="button" onClick={() => setPage('gallery-characters')}>
                Open gallery
            </button>
            <button
                type="button"
                onClick={() => setPage('gallery-resources', { hash: '#/gallery/resources?resource=res-1' })}
            >
                Open resource
            </button>
            <button
                type="button"
                onClick={() => setPage('gallery-characters', { hash: '#/gallery/characters?card=c99' })}
            >
                Open linked gallery
            </button>
            <button type="button" onClick={() => setPage('character-chat')}>
                Open chat
            </button>
            <button type="button" onClick={() => setPage('character')}>
                Open character editor
            </button>
            <button
                type="button"
                onClick={() => setPage('character', { hash: '#/character?card=char-1' })}
            >
                Open card editor
            </button>
            <button type="button" onClick={() => replaceHash('#/character?card=char-1&version=2')}>
                View version 2
            </button>
            <button type="button" onClick={() => goBack('landing')}>
                Go back
            </button>
        </div>
    )
}

function renderNavigation() {
    return render(
        <NavigationProvider>
            <Probe />
        </NavigationProvider>,
    )
}

describe('NavigationProvider origin stack', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '#/')
    })

    it('returns to the origin gallery with its hash state intact', () => {
        renderNavigation()

        fireEvent.click(screen.getByRole('button', { name: /open linked gallery/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('gallery-characters')
        expect(window.location.hash).toBe('#/gallery/characters?card=c99')

        fireEvent.click(screen.getByRole('button', { name: /open character editor/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('character')
        expect(screen.getByTestId('previous')).toHaveTextContent('gallery-characters')

        fireEvent.click(screen.getByRole('button', { name: /go back/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('gallery-characters')
        expect(window.location.hash).toBe('#/gallery/characters?card=c99')
    })

    it('falls back to landing when a creator is opened directly', () => {
        window.history.replaceState(null, '', '#/character')
        renderNavigation()

        expect(screen.getByTestId('page')).toHaveTextContent('character')

        fireEvent.click(screen.getByRole('button', { name: /go back/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('landing')
        expect(window.location.hash).toBe('#/')
    })

    it('derives cardEdit params from the hash and updates on replaceHash', () => {
        renderNavigation()
        expect(screen.getByTestId('card-edit')).toHaveTextContent('none')

        fireEvent.click(screen.getByRole('button', { name: /open card editor/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('character')
        expect(window.location.hash).toBe('#/character?card=char-1')
        expect(screen.getByTestId('card-edit')).toHaveTextContent('character:char-1:default')

        // replaceHash stamps the version in place (no history push) and re-derives cardEdit.
        fireEvent.click(screen.getByRole('button', { name: /view version 2/i }))
        expect(window.location.hash).toBe('#/character?card=char-1&version=2')
        expect(screen.getByTestId('card-edit')).toHaveTextContent('character:char-1:2')
    })

    it('re-derives cardEdit from a deep-linked hash on mount', () => {
        window.history.replaceState(null, '', '#/world?card=w-9&version=latest')
        renderNavigation()
        expect(screen.getByTestId('page')).toHaveTextContent('world')
        expect(screen.getByTestId('card-edit')).toHaveTextContent('world:w-9:latest')
    })

    it('derives resourceEdit params from the resources hash', () => {
        renderNavigation()
        expect(screen.getByTestId('resource-edit')).toHaveTextContent('none')

        fireEvent.click(screen.getByRole('button', { name: /open resource/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('gallery-resources')
        expect(window.location.hash).toBe('#/gallery/resources?resource=res-1')
        expect(screen.getByTestId('resource-edit')).toHaveTextContent('res-1:none')
    })

    it('re-derives resourceEdit (create form) from a deep-linked hash on mount', () => {
        window.history.replaceState(null, '', '#/gallery/resources?resource=new&type=md')
        renderNavigation()
        expect(screen.getByTestId('page')).toHaveTextContent('gallery-resources')
        expect(screen.getByTestId('resource-edit')).toHaveTextContent('new:md')
    })

    it('resolves the removed assets hub hash to not found', () => {
        window.history.replaceState(null, '', '#/gallery/assets')
        renderNavigation()

        expect(screen.getByTestId('page')).toHaveTextContent('not-found')
    })

    it('keeps nested origins in order', () => {
        renderNavigation()

        fireEvent.click(screen.getByRole('button', { name: /^open gallery$/i }))
        fireEvent.click(screen.getByRole('button', { name: /open chat/i }))
        fireEvent.click(screen.getByRole('button', { name: /open character editor/i }))

        fireEvent.click(screen.getByRole('button', { name: /go back/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('character-chat')

        fireEvent.click(screen.getByRole('button', { name: /go back/i }))
        expect(screen.getByTestId('page')).toHaveTextContent('gallery-characters')
        expect(window.location.hash).toBe('#/gallery/characters')
    })
})
