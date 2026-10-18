import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import type { TurnEntry } from '../../../shared'
import type { ChatTurnImagesView } from '../hooks/useChatImages'
import { ChatImageActionsContext } from './chatImageActions'
import { ChatComposer } from './ChatComposer'
import { ChatTurn } from './ChatTurn'
import scene from '@/assets/marketing/features/adventures.webp'

// Mirrors ChatTurn's local ExtendedTurnEntry shape.
type DemoTurn = TurnEntry & {
  forwardOptions?: { label: string; message: string }[]
  isStreaming?: boolean
}

const sceneImages = (status: 'completed' | 'in_progress'): ChatTurnImagesView => ({
  messageId: 101,
  generations: [
    { job_id: 'img-1', status: 'completed', assets: [{ asset_id: 'a1', url: new URL(scene, window.location.href).href, content_type: 'image/webp', width: 1536, height: 1024 }], credit_cost: 1 },
    ...(status === 'in_progress' ? [{ job_id: 'img-2', status: 'in_progress' as const, assets: [], trigger: 'regenerate' as const }] : []),
  ],
  selectedJobId: status === 'in_progress' ? 'img-2' : 'img-1',
  scheduled: false,
  stalled: false,
})

const gmTurn: DemoTurn = {
  id: 't-ai-1',
  type: 'ai',
  content: `The hooded figure slides a damp envelope across the table. "Read it here," she says. *Her eyes never leave the door.* **She doesn't trust the road either.**`,
  timestamp: '2026-06-06T21:47:00Z',
  forwardOptions: [
    { label: 'Open the envelope', message: 'Open the envelope now and read what is inside.' },
    { label: 'Ask who sent it', message: 'Ask the hooded figure who sent the message.' },
  ],
}

const userTurn: DemoTurn = {
  id: 't-user-1',
  type: 'user',
  content: 'I take the seat across from her and keep my hood up.',
  timestamp: '2026-06-06T21:46:00Z',
}

const structuredTurn: DemoTurn = {
  ...gmTurn,
  id: 't-ai-structured',
  content: 'Lyra: The door listens.',
  segments: [
    { kind: 'narrator', content: 'The tavern hushes as rain taps against the leaded glass.' },
    { kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: '"The door listens," she says. "Ask it gently."' },
    { kind: 'thought', speaker_id: 'morrow', speaker_name: 'Morrow', content: 'It remembers my hands on the old lock.' },
  ],
}

const meta = {
  title: 'Interaction/ChatTurn',
  component: ChatTurn,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'A full conversation turn with speaker metadata above the prose and unframed utilities below it. Suggested replies form one flat list; player turns use a subtle ember surface, and dialogue uses a quiet left edge.' } },
  },
  decorators: [(Story) => <div className="w-[760px] max-w-full"><Story /></div>],
  argTypes: {
    turn: { control: false },
    onForwardOptionClick: { control: false },
    onRegenerateClick: { control: false },
    onDeleteClick: { control: false },
    onEditClick: { control: false },
    images: { control: false },
  },
  args: {
    turn: gmTurn,
    onForwardOptionClick: () => {},
    onRegenerateClick: () => {},
    onDeleteClick: () => {},
    onEditClick: () => {},
  },
} satisfies Meta<typeof ChatTurn>

export default meta
type Story = StoryObj<typeof meta>

/** Game Master turn with suggested forward options. */
export const GameMasterTurn: Story = {}

/** Player turn — ember bubble, right-aligned. */
export const PlayerTurn: Story = { args: { turn: userTurn } }

/** Parsed XML segments with narrator, speech, and visible thought blocks. */
export const StructuredSegments: Story = { args: { turn: structuredTurn } }

/** Streaming — actions are hidden and the thinking dots show. */
export const Streaming: Story = { args: { turn: { ...gmTurn, forwardOptions: undefined, isStreaming: true } } }

/** The reply's scene image under its prose; hover or focus it for Regenerate and Full size. */
export const WithSceneImage: Story = {
  args: { turn: { ...gmTurn, assistantMessageId: 101, imagePrompt: 'A hooded figure in a rain-dark tavern.' }, images: sceneImages('completed') },
  decorators: [(Story) => <ChatImageActionsContext.Provider value={{ canGenerate: true, regenerate: () => {}, select: () => {} }}><Story /></ChatImageActionsContext.Provider>],
}

/** A regenerated image is on its way; ‹ › pages back to the first one meanwhile. */
export const RegeneratingSceneImage: Story = {
  args: { turn: { ...gmTurn, assistantMessageId: 101 }, images: sceneImages('in_progress') },
  decorators: WithSceneImage.decorators,
}

/** Latest reply after two regenerations — ‹ 2 / 3 › switches the version shown and sent to the model. */
export const WithVersions: Story = {
  args: {
    versions: { ids: ['v1', gmTurn.id, 'v3'], index: 1 },
    onSelectVersion: () => {},
  },
}

function ConversationPreview() {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [autoNarrate, setAutoNarrate] = useState(false)
  const selectReply = (message: string) => {
    setDraft(message)
    inputRef.current?.focus()
  }
  return (
    <div>
      <ChatTurn turn={userTurn} onForwardOptionClick={selectReply} onEditClick={() => {}} onDeleteClick={() => {}} />
      <ChatTurn turn={structuredTurn} aiLabel="The keeper of the northern archive" onForwardOptionClick={selectReply} onRegenerateClick={() => {}} onEditClick={() => {}} onDeleteClick={() => {}} />
      <ChatComposer inputRef={inputRef} value={draft} onValueChange={setDraft} onSubmit={() => setDraft('')} onStop={() => {}} isLoading={false} isMutating={false} autoNarrate={autoNarrate} onToggleAutoNarrate={() => setAutoNarrate((value) => !value)} onReset={() => {}} canReset placeholder="What do you do next?" />
    </div>
  )
}

/** The full reading rhythm, including an editable suggested reply and the composer. */
export const Conversation: Story = { render: () => <ConversationPreview /> }

export const NarrowConversation: Story = {
  decorators: [(Story) => <div className="w-80 max-w-full"><Story /></div>],
  render: () => <ConversationPreview />,
}
