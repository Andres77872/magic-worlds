import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { LAB_MODELS } from '../../constants'
import { MarkupToolbar } from './MarkupToolbar'

const [V4] = LAB_MODELS
const MODELS_BY_ALIAS = Object.fromEntries(LAB_MODELS.map((profile) => [profile.alias, profile]))

/** The toolbar over a text preview: each insert lands at the end, as the lab inserts at the caret. */
function InsertDemo(props: ComponentProps<typeof MarkupToolbar>) {
    const [text, setText] = useState('The hidden door opens. ')
    return (
        <div className="flex flex-col gap-3">
            <MarkupToolbar
                {...props}
                onInsert={(snippet) => {
                    props.onInsert(snippet)
                    setText((previous) => `${previous}${snippet} `)
                }}
            />
            <p className="rounded-md border border-parchment-50/10 bg-ink-900 p-3 font-mono text-caption text-parchment-200">{text}</p>
        </div>
    )
}

const meta = {
    title: 'Admin/Voices/MarkupToolbar',
    component: MarkupToolbar,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Synth lab markup inserts (05 §3.3), per model. App markup offers the app’s speech markup (pauses and the laugh, sigh and gasp cues), which the pipeline translates per model; model-native mode offers only what the selected model supports: breaks, audio tags, or inline pronunciation. A model with no native inserts shows no toolbar. Replaces the classic text artifact toolbar.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[560px] max-w-full rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        mode: { control: 'inline-radio', options: ['app', 'native'], description: '`app`: app speech markup · `native`: the model’s own syntax.' },
        model: { control: 'select', options: Object.keys(MODELS_BY_ALIAS), mapping: MODELS_BY_ALIAS, description: 'The lab model profile.' },
        onInsert: { action: 'inserted', control: false },
    },
    args: { mode: 'app', model: V4, onInsert: fn() },
} satisfies Meta<typeof MarkupToolbar>

export default meta
type Story = StoryObj<typeof meta>

/** App markup: the same inserts for every model. */
export const AppMarkup: Story = {}

/** v4, model native: audio tags and inline pronunciation. */
export const NativeV4: Story = { args: { mode: 'native', model: V4 } }

/** Every model in model-native mode, side by side. */
export const NativeByModel: Story = {
    parameters: { controls: { disable: true } },
    render: (args) => (
        <ul className="flex flex-col gap-4">
            {LAB_MODELS.map((model) => (
                <li key={model.alias} className="flex flex-col gap-1.5">
                    <code className="font-mono text-caption text-fg-subtle">{model.alias}</code>
                    <MarkupToolbar mode="native" model={model} onInsert={args.onInsert} />
                </li>
            ))}
        </ul>
    ),
}

/** Click an insert to see where it lands. */
export const Inserting: Story = {
    render: (args) => <InsertDemo {...args} />,
}
