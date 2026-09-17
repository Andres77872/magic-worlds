import type { Meta, StoryObj } from '@storybook/react-vite'
import { AiGeneratePanel } from './AiGeneratePanel'

const meta = {
  title: 'Creation/AiGeneratePanel',
  component: AiGeneratePanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The "Generate with AI" affordance shared by every creator. Owns the description input + busy/error state; delegates the call to `onGenerate`, which must throw on failure so the error surfaces inline.' } },
  },
  decorators: [(Story) => <div className="w-[560px] max-w-full"><Story /></div>],
  argTypes: {
    noun: { control: 'text' },
    placeholder: { control: 'text' },
    onGenerate: { control: false },
  },
  args: {
    noun: 'character',
    onGenerate: async (_description: string, _options: import('@/shared').AiCardRequestOptions) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    },
  },
} satisfies Meta<typeof AiGeneratePanel>

export default meta
type Story = StoryObj<typeof meta>

/** Type a description and Generate — the button shows the busy state. */
export const Default: Story = {}

/** When `onGenerate` throws, the message surfaces inline. */
export const ErrorState: Story = {
  args: {
    onGenerate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
      throw new Error('The muse is quiet. Try again in a moment.')
    },
  },
}

/** Delayed transport fixture: Stop keeps the preview; the saved result arrives last. */
export const LiveFieldPreview: Story = {
  args: {
    noun: 'world',
    onGenerate: async (_description, options = {}) => {
      const { readEventStream } = await import('@/infrastructure/api/sse')
      const { worlds } = await import('@/ui/components/lists/fixtures')
      const fixture = worlds[0]
      const frames = [
        { type: 'progress', stage: 'generating' },
        { type: 'preview', path: ['name'], text: fixture.name },
        { type: 'preview', path: ['description'], text: 'A drowned archive where every book remembers' },
        { type: 'preview', path: ['description'], text: fixture.description },
        { type: 'progress', stage: 'validating' },
        { type: 'progress', stage: 'saving' },
        { type: 'final', card: fixture },
      ]
      let cursor = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      let release: (() => void) | undefined
      let canceled = false
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          await new Promise<void>((resolve) => { release = resolve; timer = setTimeout(resolve, cursor === frames.length - 1 ? 15_000 : 1200) })
          if (canceled || options.signal?.aborted) return
          const event = frames[cursor++]
          controller.enqueue(new TextEncoder().encode(`event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`))
          if (cursor === frames.length) controller.close()
        },
        cancel() { canceled = true; clearTimeout(timer); release?.() },
      })
      await readEventStream(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), (event) => {
        if (event.type !== 'final') options.onEvent?.(event as import('@/shared').TextGenerationEvent)
      }, { signal: options.signal })
    },
  },
}
