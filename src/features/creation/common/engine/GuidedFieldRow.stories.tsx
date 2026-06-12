import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { GuidedFieldRow } from './GuidedFieldRow'
import type { CardFieldDefinition } from './types'

const meta = {
  title: 'Creation/GuidedFieldRow',
  component: GuidedFieldRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One active guided field: label + remove ×, the input by kind, a play-focused helper, and a one-click "Use example" ghost action while the field is empty. Guided fields serialize into the card\'s `category` payload.',
      },
    },
  },
  decorators: [(Story) => <div className="w-[480px]"><Story /></div>],
} satisfies Meta<typeof GuidedFieldRow>

export default meta
type Story = StoryObj<typeof meta>

const MOTIVATION: CardFieldDefinition = {
  id: 'personality.motivation',
  label: 'Motivation',
  helper: 'What they want right now — desire is what makes the AI act instead of just describe.',
  input: 'text',
  binding: { group: 'Personality', key: 'Motivation' },
}

const SPEECH: CardFieldDefinition = {
  id: 'voice.speech',
  label: 'Speech style',
  helper: 'How they sound — the AI mirrors this in every line of dialogue.',
  input: 'suggest',
  options: [
    { value: 'Gruff & warm', label: 'Gruff & warm', description: 'Short sentences, rough edges, soft center.' },
    { value: 'Menacingly polite', label: 'Menacingly polite', description: 'Never raises their voice; lowers it.' },
    { value: 'Terse', label: 'Terse', description: 'Wastes no words; silence does the talking.' },
  ],
  binding: { group: 'Voice', key: 'Speech Style' },
}

function Controlled(props: { field: CardFieldDefinition; hint?: string; offRole?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <GuidedFieldRow
      field={props.field}
      value={value}
      hint={props.hint}
      offRole={props.offRole}
      onChange={setValue}
      onRemove={() => setValue('')}
      onUseExample={() => props.hint && setValue(props.hint)}
    />
  )
}

export const TextWithExample: Story = {
  args: { field: MOTIVATION, value: '', onChange: () => {} },
  render: () => (
    <Controlled field={MOTIVATION} hint="To buy back the family forge before winter, whatever it takes." />
  ),
}

export const SuggestSelect: Story = {
  args: { field: SPEECH, value: '', onChange: () => {} },
  render: () => <Controlled field={SPEECH} hint="Gruff & warm" />,
}

export const OffRole: Story = {
  args: { field: MOTIVATION, value: '', onChange: () => {} },
  render: () => (
    <GuidedFieldRow
      field={{ ...MOTIVATION, label: 'Player agency', roles: ['persona'] }}
      value="Never write my dialogue or decisions."
      offRole
      onChange={() => {}}
      onRemove={() => {}}
    />
  ),
}
