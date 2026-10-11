import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProviderPropsField } from './ProviderPropsField'

const meta = {
    title: 'Profile/Models/Custom provider props',
    component: ProviderPropsField,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'Model-agnostic editor for the extra fields a profile sends with every provider request, as a JSON object. Validates like the server: an object of at most 16 lowercase fields, no reserved fields (model, messages, api_key, temperature…), no placeholders, at most 4 KB. Errors use the blood tone; nothing is reported upward while the text is invalid.' } },
    },
    decorators: [Story => <div className="max-w-xl"><Story /></div>],
    argTypes: { value: { control: 'object' }, onChange: { action: 'change' }, onValidityChange: { action: 'validity' } },
    args: { value: undefined, onChange: () => {}, onValidityChange: () => {} },
} satisfies Meta<typeof ProviderPropsField>

export default meta
type Story = StoryObj<typeof meta>

/** No custom props: the profile sends nothing extra. */
export const Empty: Story = {}
/** Provider-specific options, nested values allowed. */
export const WithProps: Story = { args: { value: { provider_routing: { order: ['fast', 'cheap'] }, transforms: ['middle-out'] } } }
/** A reserved field is refused before anything is saved. Type in the field to see the other checks. */
export const ReservedField: Story = { args: { value: { api_key: 'not allowed here' } } }
/** The server refused the configuration after saving. */
export const ServerRejected: Story = {
    args: { value: { provider_flag: true },
        serverError: 'The server rejected this configuration. Check the custom provider props for reserved fields or unsupported values.' },
}
