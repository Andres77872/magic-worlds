import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenText, Globe, Link2, Pencil, Trash2, Users } from 'lucide-react'
import { Badge, Icon, IconButton, IconTile, Switch } from '@/ui/primitives'
import { ReferenceRow } from './ReferenceRow'

const meta = {
    title: 'Components/Reference/ReferenceRow',
    component: ReferenceRow,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'One dense line in a reference list (codex card, lorebook attachment, novel codex entry). Borderless with a faint hover wash so stacked rows read as one surface. Slots: `leading` glyph, title/description, always-visible `trailing` controls, and an optional `hoverReveal` cluster that fades in on hover/focus.',
            },
        },
    },
    argTypes: {
        title: { control: 'text' },
        description: { control: 'text' },
        dimmed: { control: 'boolean', description: 'Dim a disabled item.' },
        leading: { control: false },
        trailing: { control: false },
        hoverReveal: { control: false },
        onTitleClick: { control: false },
    },
    args: {
        title: 'Aria Vex',
        description: 'Court mage, sworn to the glass throne',
        dimmed: false,
        leading: <IconTile icon={Users} tone="ember" size="sm" />,
        trailing: <Switch checked size="sm" onChange={() => {}} aria-label="Toggle Aria Vex" />,
    },
} satisfies Meta<typeof ReferenceRow>

export default meta
type Story = StoryObj<typeof meta>

/** A codex card: ember glyph, delete + enable toggle always visible. */
export const CodexCard: Story = {
    args: {
        leading: <IconTile icon={Users} tone="ember" size="sm" />,
        trailing: (
            <>
                <IconButton label="Remove Aria Vex" size="sm" tone="danger">
                    <Icon icon={Trash2} size={14} />
                </IconButton>
                <Switch checked size="sm" onChange={() => {}} aria-label="Toggle Aria Vex" />
            </>
        ),
    },
}

/** A linked lorebook attachment: arcane glyph, status badge, delete. */
export const LorebookAttachment: Story = {
    args: {
        title: 'Glass Courts',
        description: 'Court etiquette and old pacts',
        leading: <IconTile icon={BookOpenText} tone="arcane" size="sm" />,
        trailing: (
            <>
                <Badge tone="arcane" icon={<Icon icon={Link2} size={11} />}>
                    Linked
                </Badge>
                <IconButton label="Remove Glass Courts" size="sm" tone="danger">
                    <Icon icon={Trash2} size={14} />
                </IconButton>
            </>
        ),
    },
}

/** A novel codex entry: title opens the editor; edit/remove fade in on hover. */
export const NovelEntry: Story = {
    args: {
        title: 'Ironhold',
        description: 'The mountain capital',
        leading: <IconTile icon={Globe} tone="arcane" size="sm" />,
        onTitleClick: () => {},
        titleAriaLabel: 'Open Ironhold',
        hoverReveal: (
            <>
                <IconButton label="Edit Ironhold" size="sm">
                    <Icon icon={Pencil} size={14} />
                </IconButton>
                <IconButton label="Remove Ironhold" size="sm" tone="danger">
                    <Icon icon={Trash2} size={14} />
                </IconButton>
            </>
        ),
        trailing: <Switch checked size="sm" onChange={() => {}} aria-label="Toggle Ironhold" />,
    },
}

/** Disabled items dim to half opacity. */
export const Dimmed: Story = { args: { dimmed: true } }
