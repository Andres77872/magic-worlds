import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { NavigationProvider } from '@/app/providers/NavigationProvider'
import type { Character, CharacterChatSession } from '@/shared'
import { characterChats, characters } from '@/ui/components/lists/fixtures'
import { ChatroomPage } from './ChatroomPage'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>

const persona: Character = {
    ...characters[3],
    id: 'persona-mirren',
    role: 'persona',
    is_default_persona: true,
}

function ChatroomDemo({ empty = false }: { empty?: boolean }) {
    const [chats, setChats] = useState<CharacterChatSession[]>(empty ? [] : characterChats)
    // Only the fields this page consumes are mocked; no authenticated API is used.
    const data = {
        characters: [...characters, persona],
        characterChats: chats,
        loadingState: { isLoading: false },
        loadData: async () => {},
        resumeCharacterChat: () => {},
        deleteCharacterChat: async (id: string) => setChats((previous) => previous.filter((chat) => chat.id !== id)),
        startCharacterChat: async (character: Character, selectedPersona: Character) => {
            const chat: CharacterChatSession = {
                id: `preview-${Date.now()}`,
                character_id: character.id,
                character,
                persona: selectedPersona,
                turns: [],
                updatedAt: new Date().toISOString(),
            }
            setChats((previous) => [chat, ...previous])
            return chat
        },
    } satisfies Pick<DataValue, 'characters' | 'characterChats' | 'loadingState' | 'loadData' | 'resumeCharacterChat' | 'deleteCharacterChat' | 'startCharacterChat'>

    return (
        <NavigationProvider>
            <AuthContext.Provider value={{ isAuthenticated: true, openLoginModal: () => {} } as AuthValue}>
                <DataContext.Provider value={data as unknown as DataValue}>
                    <ChatroomPage />
                </DataContext.Provider>
            </AuthContext.Provider>
        </NavigationProvider>
    )
}

const meta = {
    title: 'Features/CharacterChat/Chatroom',
    component: ChatroomPage,
    tags: ['autodocs'],
    decorators: [(Story) => <div className="-m-6"><Story /></div>],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'Character conversations with an ember New chat action, arcane saved chats, and a searchable character/persona picker. Preview creation adds a local fixture; no server data is changed.',
            },
        },
    },
} satisfies Meta<typeof ChatroomPage>

export default meta
type Story = StoryObj<typeof meta>

export const SavedConversations: Story = { render: () => <ChatroomDemo /> }
export const FirstConversation: Story = { render: () => <ChatroomDemo empty /> }
