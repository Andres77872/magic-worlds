import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LorebookEntry } from '@/shared'
import { blankEntryDraft } from '../lorebookTransforms'
import { LoreEntryEditor } from './LoreEntryEditor'

const entry: LorebookEntry = {
    ...blankEntryDraft(0),
    id: 'moonwell',
    lorebookId: 'silverwood',
    title: 'The moonwell',
    entryType: 'place',
    content: 'At the heart of Silverwood, a still pool reflects constellations that have vanished from the sky. The keeper welcomes anyone who brings a memory to trade.',
    keys: ['moonwell', 'Silverwood'],
    secondaryKeys: ['keeper'],
}

function EditorDemo({ initialEntry }: { initialEntry?: LorebookEntry }) {
    const [draft, setDraft] = useState(initialEntry)
    return <LoreEntryEditor entry={draft} onChange={setDraft} onDelete={() => setDraft(undefined)} />
}

const meta = {
    title: 'Lorebook/EntryEditor',
    component: LoreEntryEditor,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'The lorebook entry editor shares the studio canvas. Content, activation, and placement use headings and dividers, while plain settings rows keep narrow sidebars readable.' } },
    },
    decorators: [(Story) => <div className="max-w-md"><Story /></div>],
    args: { entry, onChange: () => {} },
    argTypes: { entry: { control: false }, onChange: { control: false }, onDelete: { control: false } },
    render: (args) => <EditorDemo initialEntry={args.entry} />,
} satisfies Meta<typeof LoreEntryEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { entry: undefined } }
export const Secret: Story = {
    args: { entry: { ...entry, isSecret: true, revealCondition: 'The keeper receives a memory of the lost queen.' } },
}
