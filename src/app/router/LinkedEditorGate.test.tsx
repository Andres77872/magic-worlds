import { act, fireEvent, render, screen } from '@testing-library/react'
import { createContext, useContext, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Adventure, Lorebook, Story } from '@/shared'

const setPage = vi.fn()
const openLoginModal = vi.fn()
let authed = true
let hash = ''

interface FakeData {
    templateAdventures: Adventure[]
    lorebooks: Lorebook[]
    editingTemplate: Adventure | null
    editTemplate: (adventure: Adventure | null) => void
    editingLorebook: Lorebook | null
    editLorebook: (lorebook: Lorebook | null) => void
    stories: Story[]
    activeStory: Story | null
    openStory: (story: Story) => Promise<void>
}

const DataContext = createContext<FakeData | null>(null)

vi.mock('../hooks', () => ({
    useAuth: () => ({ isAuthenticated: authed, openLoginModal }),
    useNavigation: () => ({ currentHash: hash, setPage }),
    useData: () => useContext(DataContext),
}))

import { LinkedEditorGate } from './LinkedEditorGate'

const ADVENTURE = { id: 'a-conclave', scenario: 'A grand gathering of wizards.' } as Adventure
const LOREBOOK = { id: 'l-resonance', name: 'Aetheric Resonance' } as Lorebook
const STORY = { id: 's-tides', title: 'The tide archive' } as Story

type Page = 'adventure' | 'lorebook' | 'story'
let loadStory: (story: Story) => Promise<Story> = async (story) => story

/** Reads its record once, at mount, the way the real editors seed their form state. */
function Editor({ page }: { page: Page }) {
    const data = useContext(DataContext)!
    const editing = page === 'adventure' ? data.editingTemplate : page === 'lorebook' ? data.editingLorebook : data.activeStory
    const [mountedWith] = useState(() => editing?.id ?? 'new')
    const startNew = () => (page === 'adventure' ? data.editTemplate(null) : data.editLorebook(null))
    return (
        <div>
            <p>mounted with {mountedWith}</p>
            <p>editing {editing?.id ?? 'nothing'}</p>
            <button type="button" onClick={startNew}>New</button>
        </div>
    )
}

function Harness({ page }: { page: Page }) {
    const [editingTemplate, editTemplate] = useState<Adventure | null>(null)
    const [editingLorebook, editLorebook] = useState<Lorebook | null>(null)
    const [activeStory, setActiveStory] = useState<Story | null>(null)
    const openStory = async (story: Story) => setActiveStory(await loadStory(story))
    const data: FakeData = {
        templateAdventures: [ADVENTURE], lorebooks: [LOREBOOK], stories: [STORY],
        editingTemplate, editTemplate, editingLorebook, editLorebook, activeStory, openStory,
    }
    return (
        <DataContext.Provider value={data}>
            <LinkedEditorGate page={page}>
                <Editor page={page} />
            </LinkedEditorGate>
        </DataContext.Provider>
    )
}

describe('LinkedEditorGate', () => {
    beforeEach(() => {
        setPage.mockReset()
        openLoginModal.mockReset()
        authed = true
        hash = ''
        loadStory = async (story) => story
    })

    it('hands the linked adventure to the editor before it mounts', () => {
        hash = '#/adventure?card=a-conclave'
        render(<Harness page="adventure" />)
        expect(screen.getByText('mounted with a-conclave')).toBeInTheDocument()
        expect(setPage).not.toHaveBeenCalled()
    })

    it('hands the linked lorebook to the studio before it mounts', () => {
        hash = '#/lorebook?lorebook=l-resonance'
        render(<Harness page="lorebook" />)
        expect(screen.getByText('mounted with l-resonance')).toBeInTheDocument()
    })

    it('reads the link only once, so a new record inside the editor does not snap back', () => {
        hash = '#/adventure?card=a-conclave'
        render(<Harness page="adventure" />)
        fireEvent.click(screen.getByRole('button', { name: 'New' }))
        expect(screen.getByText('editing nothing')).toBeInTheDocument()
        expect(screen.getByText('mounted with a-conclave')).toBeInTheDocument()
    })

    it('opens the editor untouched without a link', () => {
        hash = '#/adventure'
        render(<Harness page="adventure" />)
        expect(screen.getByText('mounted with new')).toBeInTheDocument()
        expect(setPage).not.toHaveBeenCalled()
    })

    it('falls back to the gallery when the linked record is not in the library', () => {
        hash = '#/lorebook?lorebook=l-gone'
        render(<Harness page="lorebook" />)
        expect(setPage).toHaveBeenCalledWith('gallery-lorebooks')
    })

    it('loads the linked story before the studio mounts', async () => {
        hash = '#/story?story=s-tides'
        let finish: () => void = () => {}
        loadStory = (story) => new Promise((resolve) => {
            finish = () => resolve(story)
        })
        render(<Harness page="story" />)
        expect(screen.queryByText(/mounted with/)).not.toBeInTheDocument()
        await act(async () => finish())
        expect(screen.getByText('mounted with s-tides')).toBeInTheDocument()
    })

    it('falls back to the stories gallery when the story cannot load', async () => {
        hash = '#/story?story=s-tides'
        loadStory = async () => {
            throw new Error('gone')
        }
        render(<Harness page="story" />)
        await act(async () => {})
        expect(setPage).toHaveBeenCalledWith('gallery-stories')
    })

    it('asks a signed-out reader to sign in', () => {
        authed = false
        hash = '#/adventure?card=a-conclave'
        render(<Harness page="adventure" />)
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(screen.getByText('mounted with new')).toBeInTheDocument()
        expect(setPage).not.toHaveBeenCalled()
    })
})
