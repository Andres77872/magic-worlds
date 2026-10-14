import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeAcceptance } from '../../fixtures'
import { RubricForm } from './RubricForm'

const meta = {
    title: 'Admin/Voices/RubricForm',
    component: RubricForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Acceptance rubric for one voice, model and language: six 1–5 scores, an explicit pass or fail, integrated loudness with the attenuation-only gain, and the call-eligibility preview (Flash only).',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[560px] max-w-full">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        onSubmit: { action: 'submitted', control: false },
        saving: { control: 'boolean' },
        error: { control: 'text', description: 'Save error shown under the form.' },
        measuredLufs: { control: 'number', description: 'Server-measured loudness of the latest renders.' },
    },
    args: {
        modelId: 'eleven_flash_v2_5',
        modelLabel: 'Flash v2.5 (Standard)',
        stored: null,
        measuredLufs: -19.2,
        locale: 'en',
        saving: false,
        error: null,
        onSubmit: () => undefined,
    },
} satisfies Meta<typeof RubricForm>

export default meta
type Story = StoryObj<typeof meta>

export const NewReview: Story = {}

export const StoredPass: Story = {
    args: { stored: makeAcceptance({ integrated_lufs: -18.4, gain_db: -0.4 }) },
}

export const TooLoud: Story = {
    args: { modelId: 'eleven_v4', modelLabel: 'v4 (Expressive)', measuredLufs: -10.5 },
}

export const SaveFailed: Story = {
    args: { error: 'This changed elsewhere in the meantime. Refresh and try again.' },
}
