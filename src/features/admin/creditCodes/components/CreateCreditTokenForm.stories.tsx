import type { Meta, StoryObj } from '@storybook/react-vite'
import { CreateCreditTokenForm } from './CreateCreditTokenForm'

const meta = {
    title: 'Admin/CreditCodes/CreateCreditTokenForm',
    component: CreateCreditTokenForm,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Form to mint a one-time redeem code. On success the raw code is revealed once in an ember panel with a copy affordance and a "shown only once" warning.',
            },
        },
    },
    decorators: [(Story) => <div className="w-[620px] max-w-full"><Story /></div>],
    args: {
        onCreated: () => undefined,
        notify: () => undefined,
        setError: () => undefined,
    },
} satisfies Meta<typeof CreateCreditTokenForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
