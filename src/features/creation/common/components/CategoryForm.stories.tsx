import type { Meta, StoryObj } from '@storybook/react-vite'
import { CategoryForm } from './CategoryForm'

const meta = {
  title: 'Creation/CategoryForm',
  component: CategoryForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Inline form for adding a new attribute category. Theme tunes the placeholder copy (magical / fire / nature). `useFormWrapper` toggles whether it renders a <form> or a <div> (for nesting inside another form).' } },
  },
  decorators: [(Story) => <div className="w-[560px] max-w-full"><Story /></div>],
  argTypes: {
    theme: { control: 'inline-radio', options: ['magical', 'fire', 'nature'] },
    useFormWrapper: { control: 'boolean' },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
  args: { theme: 'magical', useFormWrapper: true, onSubmit: () => {}, onCancel: () => {} },
} satisfies Meta<typeof CategoryForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NatureTheme: Story = { args: { theme: 'nature' } }
