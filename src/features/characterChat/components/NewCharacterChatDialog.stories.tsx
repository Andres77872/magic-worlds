import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { i18n } from '@/app/i18n'
import { Button } from '@/ui/primitives'
import { characters } from '@/ui/components/lists/fixtures'
import { NewCharacterChatDialog } from './NewCharacterChatDialog'

const library = characters.map((character, index) => ({
    ...character,
    role: index >= 2 ? 'persona' as const : 'character' as const,
    is_default_persona: index === 3,
    ...(index === 0 ? { default_persona_id: characters[2].id, greeting: 'The fire has been waiting for you. What brings you to our door?' } : {}),
}))

function DialogDemo(args: ComponentProps<typeof NewCharacterChatDialog>) {
    const [open, setOpen] = useState(true)
    return (
        <>
            <Button onClick={() => setOpen(true)}>{i18n.t('characterChat.newChat.title')}</Button>
            {open && (
                <NewCharacterChatDialog
                    {...args}
                    onClose={() => { args.onClose(); setOpen(false) }}
                    onBrowseCharacters={() => { args.onBrowseCharacters(); setOpen(false) }}
                    onStart={async (character, persona) => { await args.onStart(character, persona); setOpen(false) }}
                />
            )}
        </>
    )
}

const meta = {
    title: 'Features/CharacterChat/New chat',
    component: NewCharacterChatDialog,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Start a separate saved conversation by choosing an AI character and confirming who you play. Arcane portraits identify the AI; ember selection and persona portraits identify player choices. Character-specific or library persona defaults stay visible and can be changed.',
            },
        },
    },
    argTypes: {
        characters: { control: false },
        loading: { control: 'boolean' },
        loadError: { control: 'text' },
        onRetry: { control: false },
        onStart: { control: false },
        onClose: { control: false },
        onBrowseCharacters: { control: false },
    },
    args: {
        characters: library,
        loading: false,
        loadError: null,
        onRetry: () => {},
        onStart: async () => {},
        onClose: () => {},
        onBrowseCharacters: () => {},
    },
    render: (args) => <DialogDemo {...args} />,
} satisfies Meta<typeof NewCharacterChatDialog>

export default meta
type Story = StoryObj<typeof meta>

export const CharacterSelection: Story = {}

export const OpeningLinePreview: Story = {
    play: async ({ canvasElement }) => {
        const body = within(canvasElement.ownerDocument.body)
        await userEvent.click(body.getByRole('button', { name: i18n.t('characterChat.newChat.selectCharacter', { name: library[0].name }) }))
    },
}

export const PersonaSelection: Story = {
    play: async ({ canvasElement }) => {
        const body = within(canvasElement.ownerDocument.body)
        await userEvent.click(body.getByRole('button', { name: i18n.t('characterChat.newChat.selectCharacter', { name: library[0].name }) }))
        await userEvent.click(body.getByRole('button', { name: i18n.t('characterChat.newChat.continue') }))
    },
}

export const EmptyLibrary: Story = { args: { characters: [] } }
export const LoadingLibrary: Story = { args: { characters: [], loading: true } }
export const LoadFailure: Story = { args: { loadError: 'The library is unavailable.' } }
export const StartFailure: Story = {
    args: { onStart: async () => { throw new Error('The conversation could not be created.') } },
    play: async ({ canvasElement }) => {
        const body = within(canvasElement.ownerDocument.body)
        await userEvent.click(body.getByRole('button', { name: i18n.t('characterChat.newChat.selectCharacter', { name: library[0].name }) }))
        await userEvent.click(body.getByRole('button', { name: i18n.t('characterChat.newChat.continue') }))
        await userEvent.click(body.getByRole('button', { name: i18n.t('characterChat.newChat.start') }))
    },
}
