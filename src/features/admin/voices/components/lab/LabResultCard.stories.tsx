import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SILENT_WAV } from '../../fixtures'
import { LabResultCard, type LabResult } from './LabResultCard'

const SILENT_BYTES = Uint8Array.from(atob(SILENT_WAV.slice(SILENT_WAV.indexOf(',') + 1)), (char) => char.charCodeAt(0))

/** A silent render in the given format, so the player works without any network request. */
function result(overrides: Partial<LabResult> = {}): LabResult {
    return {
        id: 1,
        title: 'Maren, Flash v2.5',
        blob: new Blob([SILENT_BYTES], { type: 'audio/wav' }),
        contentType: 'audio/wav',
        outputFormat: 'wav_24000',
        requestId: 'req-7f3a9c',
        characterCost: 112,
        ...overrides,
    }
}

/** Raw 16-bit PCM (no header): it plays through a WAV header and downloads as `.pcm`. */
const PCM = result({
    id: 2,
    title: 'Maren, v4',
    blob: new Blob([new Uint8Array(4800)], { type: 'audio/pcm' }),
    contentType: 'audio/pcm;rate=24000',
    outputFormat: 'pcm_24000',
    requestId: 'req-2b81d4',
    characterCost: 96,
})

const meta = {
    title: 'Admin/Voices/LabResultCard',
    component: LabResultCard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'One synth lab render (05 §8.11): a player, download, the request ID and character cost when the provider sends them, the output format, and a pin to compare up to three renders side by side. MP3 and WAV play as served; raw PCM plays through a WAV header and downloads as raw bytes. Replaces the classic voice result card (and drops its activation step).',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[420px] max-w-full">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        result: { control: false },
        pinned: { control: 'boolean' },
        canPin: { control: 'boolean', description: 'False once three renders are pinned: an unpinned card cannot be pinned.' },
        onTogglePin: { action: 'pin toggled', control: false },
    },
    args: { result: result(), pinned: false, canPin: true, onTogglePin: fn() },
} satisfies Meta<typeof LabResultCard>

export default meta
type Story = StoryObj<typeof meta>

/** A WAV render with its request ID and character cost. */
export const Default: Story = {}

/** Pinned for comparison: the action reads "Unpin". */
export const Pinned: Story = { args: { pinned: true } }

/** Three renders already pinned: this one cannot be pinned until another is unpinned. */
export const CompareFull: Story = { args: { canPin: false } }

/** Raw PCM: played through a WAV header, downloaded as `.pcm`. */
export const RawPcm: Story = { args: { result: PCM } }

/** No provider metadata: only the format is listed. */
export const WithoutMetadata: Story = { args: { result: result({ requestId: null, characterCost: null }) } }
