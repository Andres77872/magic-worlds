import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { beatInstruction, useBeatComposer } from './useBeatComposer'

const LENGTH_KEY = 'magic_worlds:novel:beatLength'
const OPTIONS_KEY = 'magic_worlds:novel:beatOptions'

/** Enough of an editor for a caret-anchored beat: no selection, so the
 *  markdown-selection path is never taken. */
function fakeEditor(focus = vi.fn()) {
    return {
        state: {
            selection: { from: 4, to: 4 },
            doc: { textBetween: () => 'he agreed.' },
        },
        view: { coordsAtPos: () => ({ left: 120, top: 200, bottom: 218 }) },
        commands: { focus },
    } as unknown as Editor
}

function fakeContainer() {
    const node = document.createElement('div')
    node.getBoundingClientRect = () => ({ left: 20, top: 40, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) })
    Object.defineProperty(node, 'clientWidth', { value: 900, configurable: true })
    node.scrollTop = 60
    return node
}

function setup(submit = vi.fn(async () => {}), focus = vi.fn()) {
    const editorRef = { current: fakeEditor(focus) }
    const containerRef = { current: fakeContainer() }
    const hook = renderHook(() => useBeatComposer({ editorRef, containerRef, submit }))
    return { hook, submit, focus }
}

describe('beatInstruction', () => {
    it('appends the length as a sentence the model can act on', () => {
        expect(beatInstruction('she follows him', 'short')).toBe('she follows him\n\nWrite about one paragraph.')
        expect(beatInstruction('  padded  ', 'long')).toBe('padded\n\nWrite a full scene.')
    })

    it('is just the length when nothing was typed', () => {
        expect(beatInstruction('', 'medium')).toBe('Write two or three paragraphs.')
    })
})

describe('useBeatComposer', () => {
    beforeEach(() => {
        window.localStorage.clear()
        vi.clearAllMocks()
    })

    it('starts folded, because most beats are one sentence and Enter', () => {
        const { hook } = setup()
        expect(hook.result.current.optionsOpen).toBe(false)
        expect(hook.result.current.length).toBe('medium')
    })

    it('persists the disclosure and reads it back on the next open', () => {
        const first = setup()
        act(() => first.hook.result.current.toggleOptions())

        expect(first.hook.result.current.optionsOpen).toBe(true)
        expect(window.localStorage.getItem(OPTIONS_KEY)).toBe('true')
        expect(setup().hook.result.current.optionsOpen).toBe(true)
    })

    it('persists the length', () => {
        const { hook } = setup()
        act(() => hook.result.current.setLength('long'))

        expect(window.localStorage.getItem(LENGTH_KEY)).toBe('long')
        expect(setup().hook.result.current.length).toBe('long')
    })

    it('keeps working when storage refuses to write', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('QuotaExceededError')
        })
        const { hook } = setup()

        act(() => hook.result.current.toggleOptions())
        act(() => hook.result.current.setLength('short'))

        // The choice survives in memory even though nothing was written.
        expect(hook.result.current.optionsOpen).toBe(true)
        expect(hook.result.current.length).toBe('short')
        setItem.mockRestore()
    })

    it('ignores a junk value left in storage', () => {
        window.localStorage.setItem(LENGTH_KEY, 'enormous')
        expect(setup().hook.result.current.length).toBe('medium')
    })

    it('anchors at the caret and describes what it will write after', () => {
        const { hook } = setup()
        act(() => hook.result.current.openAt('she follows him'))

        expect(hook.result.current.open).toBe(true)
        expect(hook.result.current.instruction).toBe('she follows him')
        expect(hook.result.current.target?.anchorPos).toBe(4)
        // Content coordinates: viewport minus the container, plus its scroll,
        // and 6px of gap under the caret line (218 - 40 + 60 + 6).
        expect(hook.result.current.target?.anchor).toEqual({ left: 100, top: 244, caretTop: 220 })
        expect(hook.result.current.contextLine).toBe('after “he agreed.”')
    })

    it('sends a typed beat as a custom instruction, with the length appended', async () => {
        const { hook, submit, focus } = setup()
        act(() => hook.result.current.openAt('she follows him'))
        await act(async () => hook.result.current.write())

        expect(submit).toHaveBeenCalledWith('custom', 'she follows him\n\nWrite two or three paragraphs.', {
            selection: undefined,
            replaceRange: undefined,
            anchorPos: 4,
            // The writer's own words travel alongside the assembled instruction,
            // so the beat can show and store what was asked for.
            prompt: 'she follows him',
        })
        // The review keys are editor keymap bindings — the manuscript must have
        // focus back before the generation lands.
        expect(focus).toHaveBeenCalled()
        expect(hook.result.current.open).toBe(false)
    })

    it('sends an empty beat as a continuation rather than an instruction that says nothing', async () => {
        const { hook, submit } = setup()
        act(() => hook.result.current.openAt(''))
        await act(async () => hook.result.current.write())

        expect(submit).toHaveBeenCalledWith(
            'continue',
            'Write two or three paragraphs.',
            expect.objectContaining({ prompt: '' }),
        )
    })

    it('cancelling closes without submitting, and hands focus back', () => {
        const { hook, submit, focus } = setup()
        act(() => hook.result.current.openAt('unused'))
        act(() => hook.result.current.cancel())

        expect(hook.result.current.open).toBe(false)
        expect(hook.result.current.target).toBeNull()
        expect(submit).not.toHaveBeenCalled()
        expect(focus).toHaveBeenCalled()
    })
})
