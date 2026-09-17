import type { Meta, StoryObj } from '@storybook/react-vite'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { NovelEditor } from './NovelEditor'

const meta = {
  title: 'Novel/NovelEditor',
  component: NovelEditor,
  tags: ['autodocs'],
  parameters: { layout: 'padded', docs: { description: { component: 'The Story Studio manuscript uses arcane accents for AI suggestions. This delayed fixture previews text outside the document, then enters Accept/Reject review.' } } },
  decorators: [(Story) => <FloatingWindowsProvider><div className="h-screen max-w-4xl"><Story /></div></FloatingWindowsProvider>],
  args: {
    initialBody: 'The gate held.', codexEntries: [], onBodyChange: () => {},
    onRequestSaveFlush: async () => true, onAcceptGeneration: async () => {}, onDiscardGeneration: async () => {}, onCritiqueResult: () => {},
    onGenerate: async (request, options) => {
      const chunks = ['Beyond the gate, ', 'the ink still whispered ', 'to those who listened.']
      const wait = () => new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(options?.signal?.reason) }
        const timer = setTimeout(() => { options?.signal?.removeEventListener('abort', abort); resolve() }, 2000)
        if (options?.signal?.aborted) abort()
        else options?.signal?.addEventListener('abort', abort, { once: true })
      })
      for (const delta of chunks) { await wait(); options?.onEvent?.({ type: 'delta', delta, request_id: 'story-fixture' }) }
      options?.onEvent?.({ type: 'progress', stage: 'saving', request_id: 'story-fixture' })
      await wait()
      return { id: 'fixture-generation', storyId: 'fixture-story', inputRange: null, contextTrace: { cards: [], loreEntries: [], chapters: [], totalEstimatedTokens: 0 }, chapterId: 'fixture-chapter', command: request.command, status: 'candidate', output: chunks.join(''), createdAt: new Date().toISOString(), promptSummary: 'Continue at the gate.' }
    },
  },
} satisfies Meta<typeof NovelEditor>
export default meta
type Story = StoryObj<typeof meta>
export const LivePreview: Story = {}
