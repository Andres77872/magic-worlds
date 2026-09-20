import { useState } from 'react'
import { BookOpenText, ExternalLink } from 'lucide-react'
import { Badge, Chip, Drawer, Icon } from '@/ui/primitives'

type ReferenceBadge = 'Available' | 'Not wired' | 'Root only'

interface ReferenceItem {
    label: string
    detail: string
    badge?: ReferenceBadge
}

interface ReferenceLink {
    label: string
    href: string
}

interface ReferenceSection {
    key: string
    label: string
    summary: string
    items: ReferenceItem[]
    links: ReferenceLink[]
}

const SECTIONS: ReferenceSection[] = [
    {
        key: 'voice-sources',
        label: 'Voice sources',
        summary: 'Voice IDs come from MiniMax system voices, voice cloning, and voice design.',
        items: [
            { label: 'System voices', detail: 'Built-in MiniMax voices. Browse them in the library or the System Voice ID list.', badge: 'Available' },
            { label: 'Cloned voices', detail: 'Custom voices created from an uploaded sample. They list only after a successful synthesis.', badge: 'Available' },
            { label: 'Designed voices', detail: 'Text-to-voice IDs from Voice Design. They list only after a successful synthesis.', badge: 'Available' },
        ],
        links: [
            { label: 'Get Voice', href: 'https://platform.minimax.io/docs/api-reference/voice-management-get' },
            { label: 'System voice list', href: 'https://platform.minimax.io/docs/faq/system-voice-id.md' },
        ],
    },
    {
        key: 'text-artifacts',
        label: 'Text artifacts',
        summary: 'Synthesis text supports more than prose: pauses, pronunciation overrides, and sound tags.',
        items: [
            { label: 'Length caps', detail: 'Voice tests accept up to 1,000 characters here; MiniMax T2A accepts under 10,000.' },
            { label: 'Pause markers', detail: 'Use markers like <#0.4#> between segments. Valid range is 0.01 to 99.99 seconds.', badge: 'Available' },
            { label: 'Interjection tags', detail: 'speech-2.8 models support tags such as (laughs), (sighs), (gasps), (inhale), (exhale), (humming).', badge: 'Available' },
            { label: 'Inline pronunciation', detail: 'Half-width parentheses carry IPA, Mandarin pinyin tone numbers, or Cantonese Jyutping tones.', badge: 'Available' },
        ],
        links: [{ label: 'T2A HTTP', href: 'https://platform.minimax.io/docs/api-reference/speech-t2a-http.md' }],
    },
    {
        key: 'voice-controls',
        label: 'Voice controls',
        summary: 'The synthesis lab exposes the voice_setting fields that change delivery without changing the voice.',
        items: [
            { label: 'Speed', detail: 'Range 0.5 to 2.0. Higher values speak faster.', badge: 'Available' },
            { label: 'Volume', detail: 'Range greater than 0 up to 10. Default 1.', badge: 'Available' },
            { label: 'Pitch', detail: 'Range -12 to 12. Default 0 keeps the original pitch.', badge: 'Available' },
            { label: 'Emotion', detail: 'happy, sad, angry, fearful, disgusted, surprised, calm. (fluent/whisper need speech-2.6 and are not offered here.)', badge: 'Available' },
        ],
        links: [{ label: 'T2A HTTP', href: 'https://platform.minimax.io/docs/api-reference/speech-t2a-http.md' }],
    },
    {
        key: 'audio-output',
        label: 'Audio output',
        summary: 'The lab can request different formats and sample rates for the rendered preview.',
        items: [
            { label: 'Audio formats', detail: 'mp3, wav, and flac are selectable here.', badge: 'Available' },
            { label: 'Sample rate', detail: '8000, 16000, 22050, 24000, 32000, and 44100 Hz.', badge: 'Available' },
            { label: 'Language boost', detail: 'Bias decoding toward a named language, or leave on auto.', badge: 'Available' },
        ],
        links: [{ label: 'T2A HTTP', href: 'https://platform.minimax.io/docs/api-reference/speech-t2a-http.md' }],
    },
    {
        key: 'cloning',
        label: 'Cloning',
        summary: 'Clone a custom voice from an uploaded audio sample.',
        items: [
            { label: 'Source audio', detail: 'mp3, m4a, or wav, 10 seconds to 5 minutes, up to 20 MB.', badge: 'Available' },
            { label: 'Prompt audio', detail: 'Optional clip under 8 seconds with a matching transcript for better similarity.', badge: 'Available' },
            { label: 'Activation', detail: 'Cloned voices stay inactive until their first synthesis and auto-delete after 7 unused days.', badge: 'Root only' },
            { label: 'Timbre mixing', detail: 'Blending up to four voices with weights is not wired in this console.', badge: 'Not wired' },
        ],
        links: [
            { label: 'Voice clone', href: 'https://platform.minimax.io/docs/api-reference/voice-cloning-clone.md' },
            { label: 'File upload', href: 'https://platform.minimax.io/docs/api-reference/file-management-upload.md' },
        ],
    },
    {
        key: 'admin-support',
        label: 'Current support',
        summary: 'This console exposes a root-only subset of the MiniMax voice surface; provider keys stay server-side.',
        items: [
            { label: 'Implemented here', detail: 'Voice design, audio cloning, voice testing with full controls, inventory, and deletion.', badge: 'Root only' },
            { label: 'Not implemented here', detail: 'Async long-form T2A, subtitle retrieval, timbre mixing, and voice_modify sound effects.', badge: 'Not wired' },
        ],
        links: [
            { label: 'Voice design', href: 'https://platform.minimax.io/docs/api-reference/voice-design-design' },
            { label: 'Delete voice', href: 'https://platform.minimax.io/docs/api-reference/voice-management-delete' },
        ],
    },
]

function badgeTone(value: ReferenceBadge): 'arcane' | 'ember' | 'neutral' {
    if (value === 'Available') return 'arcane'
    if (value === 'Root only') return 'ember'
    return 'neutral'
}

export function MiniMaxReferenceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [activeKey, setActiveKey] = useState(SECTIONS[0].key)
    const active = SECTIONS.find((section) => section.key === activeKey) ?? SECTIONS[0]

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow="MiniMax"
            icon={<Icon icon={BookOpenText} size={18} className="text-ember-400" />}
            title="Voice reference"
        >
            <div className="flex flex-col gap-4">
                <p className="font-ui text-sm leading-relaxed text-parchment-300">
                    Quick reference for the MiniMax inputs, controls, outputs, and workflows around voice synthesis.
                </p>

                <div className="flex flex-wrap gap-2" role="group" aria-label="Reference sections">
                    {SECTIONS.map((section) => (
                        <Chip key={section.key} active={activeKey === section.key} onClick={() => setActiveKey(section.key)}>
                            {section.label}
                        </Chip>
                    ))}
                </div>

                <section className="border-t border-parchment-50/10 pt-5">
                    <h3 className="font-heading text-xl text-parchment-50">{active.label}</h3>
                    <p className="mt-1 font-ui text-sm leading-relaxed text-parchment-300">{active.summary}</p>

                    <dl className="mt-4 divide-y divide-parchment-50/10">
                        {active.items.map((item) => (
                            <div key={item.label} className="py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <dt className="font-ui text-sm font-semibold text-parchment-100">{item.label}</dt>
                                    {item.badge && <Badge tone={badgeTone(item.badge)}>{item.badge}</Badge>}
                                </div>
                                <dd className="mt-1 font-ui text-sm leading-relaxed text-parchment-300">{item.detail}</dd>
                            </div>
                        ))}
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2" aria-label={`${active.label} docs`}>
                        {active.links.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 font-ui text-sm font-semibold text-parchment-100 transition-colors hover:bg-parchment-50/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400"
                            >
                                {link.label}
                                <Icon icon={ExternalLink} size={13} />
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </Drawer>
    )
}
