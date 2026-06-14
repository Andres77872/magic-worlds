import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatMessage } from './ChatMessage'

const GM_PROSE = `The tavern door groans shut behind you. *Rain drips from your cloak onto the warped floorboards.* A hooded figure in the corner looks up.

"You're late," she says, not unkindly. "Sit. We have little time."

**She's measuring you — every word a test.**`

const GM_MARKDOWN = `## The Sunken Library

You descend into the \`archive\`. The water is *waist-deep* and cold, and the ink still moves.

> Somewhere below, a page turns on its own.

You could:
- Light the lantern
- Follow the ink-trail
- Turn back while you still can`

const meta = {
  title: 'Interaction/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A single chat turn. The **player** turn is an ember candlelit bubble (UI sans). The **Game Master** turn is literary narrative prose (`.chat-prose`, Spectral serif) rendered from markdown, where `"quotes"` become bright dialogue, *italics* become muted action, and **bold** becomes arcane-tinted thought. See Design System → Foundations → Narrative Prose.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[640px] max-w-full"><Story /></div>],
  argTypes: {
    content: { control: 'text' },
    isUser: { control: 'boolean', description: 'true = player ember bubble · false = Game Master prose.' },
    isStreaming: { control: 'boolean', description: 'Shows the arcane "thinking" dots after the prose.' },
  },
  args: { content: GM_PROSE, isUser: false, isStreaming: false },
} satisfies Meta<typeof ChatMessage>

export default meta
type Story = StoryObj<typeof meta>

/** The player's voice — an ember candlelit bubble. */
export const PlayerTurn: Story = {
  args: { isUser: true, content: 'I push the door open and step into the rain-warm dark, hand resting on my blade.' },
}

/** The Game Master — narrative prose with dialogue, action, and thought. */
export const GameMasterProse: Story = {}

/** Markdown support: headings, lists, blockquotes, and inline code. */
export const Markdown: Story = { args: { content: GM_MARKDOWN } }

/** XML-derived response segments: narrator, spoken dialogue, and visible thought. */
export const StructuredSegments: Story = {
  args: {
    content: 'Lyra: The door listens.',
    segments: [
      { kind: 'narrator', content: 'The tavern hushes as rain taps against the leaded glass.' },
      { kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: '"The door listens," she says. "Ask it gently."' },
      { kind: 'thought', speaker_id: 'morrow', speaker_name: 'Morrow', content: 'It remembers my hands on the old lock.' },
    ],
  },
}

/** The arcane "thinking" pulse while a reply streams in. */
export const Streaming: Story = {
  args: { content: 'The figure leans forward, and the candle gutters as if it, too, is listening', isStreaming: true },
}
