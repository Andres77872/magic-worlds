import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatMessage } from './ChatMessage'

const GM_PROSE = `The tavern door groans shut behind you. *Rain drips from your cloak onto the warped floorboards.* A hooded figure in the corner looks up.

"You're late," she says, not unkindly. "Sit. We have little time."

Her gaze returns to the **sealed envelope**.`

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
          'A single chat turn. The **player** turn is an ember candlelit bubble (UI sans). Roleplay JSON segments use Spectral serif: narration is muted and italic, dialogue is brighter and medium weight, and fictional thoughts carry an explicit label. Speech aligns with the prose without quote borders. Group replies retain roster identity; solo replies share the turn header. **Bold** stays emphasis. See Design System → Foundations → Narrative Prose.',
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

/** JSON-derived response segments: narrator, spoken dialogue, and visible thought. */
export const StructuredSegments: Story = {
  args: {
    content: 'Lyra: The door listens.',
    segments: [
      { kind: 'narrator', content: 'The tavern hushes.\n\nRain taps against the leaded glass.' },
      { kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: 'The door listens.\n\nAsk it **gently**.' },
      { kind: 'thought', speaker_id: 'morrow', speaker_name: 'Morrow', content: 'It remembers my hands on the old lock.' },
    ],
  },
}

/** The arcane "thinking" pulse while a reply streams in. */
export const Streaming: Story = {
  args: { content: 'The figure leans forward, and the candle gutters as if it, too, is listening', isStreaming: true },
}

/**
 * A 1:1 character reply. The turn header already names the character, so its
 * speech skips the per-segment name (`soloSpeakerId`). Single-tilde `~actions~`
 * render as muted action, not strikethrough; a playful `hola~` stays as written.
 */
export const OneOnOneCharacter: Story = {
  args: {
    content: '',
    soloSpeakerId: 'kai',
    segments: [
      { kind: 'speech', speaker_id: 'kai', speaker_name: 'Kai', content: '~risita~ ¡Hola, hola~! ~se acomoda el pelo rosa detrás de la oreja~ Pasa, no te quedes en la puerta.' },
      { kind: 'narrator', content: 'Dos gatos negros se asoman curiosos entre los peluches.' },
      { kind: 'speech', speaker_id: 'kai', speaker_name: 'Kai', content: '¿Quieres un pocky? Son de fresa~ ~sonríe~' },
    ],
  },
}

/** Active body text is visible before its JSON string closes. */
export const StreamingGroup: Story = {
  args: { content: '', isStreaming: true, segments: [
    { kind: 'speech', speaker_id: 'lyra', speaker_name: 'Lyra', content: 'El puente es más rápido.' },
    { kind: 'narrator', content: 'Morrow studies the water.\n\nThe lantern flickers.' },
    { kind: 'thought', speaker_id: 'morrow', speaker_name: 'Morrow', content: 'The old path might still be **safe', streaming: true },
  ] },
}

export const NarrowGroup: Story = { ...StreamingGroup, decorators: [(Story) => <div className="w-80 max-w-full"><Story /></div>] }
