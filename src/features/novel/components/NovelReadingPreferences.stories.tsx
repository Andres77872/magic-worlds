import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button } from '@/ui/primitives'
import { manuscript } from '@/test/fixtures/story'
import { NovelEditor } from '../editor/NovelEditor'
import { DEFAULT_READING, readingAttributes } from '../utils/readingPreferences'
import { NovelReadingPreferences } from './NovelReadingPreferences'

const initialDocument = manuscript('The sealed letter waited by the window. Outside, the last lantern swayed in the rain.\n\nMara had promised to leave it unopened. She turned the envelope over and recognized the handwriting.')
function ReadingRoom({ readOnly = false, storageUnavailable = false }: { readOnly?: boolean; storageUnavailable?: boolean }) {
    const { t } = useTranslation()
    const [value, setValue] = useState(DEFAULT_READING)
    const [open, setOpen] = useState(false)
    return <FloatingWindowsProvider><div className="novel-reading-room novel-reading-surface flex min-h-screen flex-col" {...readingAttributes(value)}>
        <div className="p-4"><Button variant="secondary" onClick={() => setOpen(true)}>{t('novelEditor.reading.title')}</Button></div>
        <NovelEditor initialDocument={initialDocument} codexEntries={[]} readOnly={readOnly} onDocumentChange={() => {}}
            onGenerate={async () => { throw new Error('Generation is unavailable in this local reading fixture') }}
            onRequestSaveFlush={async () => true} onAcceptGeneration={async () => {}} onDiscardGeneration={async () => {}} onCritiqueResult={() => {}} />
        <NovelReadingPreferences open={open} onClose={() => setOpen(false)} value={value} onChange={setValue} storageUnavailable={storageUnavailable} />
    </div></FloatingWindowsProvider>
}
const meta = {
    title: 'Novel/Reading preferences', component: ReadingRoom, tags: ['autodocs'],
    parameters: { layout: 'fullscreen', docs: { description: { component: 'Device-local reading presets over the real manuscript editor. Adjust font, size, spacing, width and contrast without replacing the document; this fixture uses local callbacks and no backend writes.' } } },
} satisfies Meta<typeof ReadingRoom>
export default meta
type Story = StoryObj<typeof meta>
export const Writing: Story = {}
export const ArchivedReader: Story = { args: { readOnly: true } }
export const SessionOnly: Story = { args: { storageUnavailable: true } }
