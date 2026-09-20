import { useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MediaStudioSection } from '../components/MediaStudioSection'
import { SessionLorebookPanel } from '@/features/lorebook/components/SessionLorebookPanel'
import { HighlightedTextarea } from '@/features/lorebook/components/HighlightedTextarea'
import { LoreTriggerMark } from '@/features/lorebook/components/LoreTriggerMark'
import { buildTriggerMatcher, scanText } from '@/features/lorebook/loreTriggers'
import { FloatingWindowsLayer } from '@/features/floatingWindows'
import { SectionHeader } from '@/ui/primitives'
import { AuthoringProviders, auditEntry, auditLorebook, installAuthoringApi, noop, type AuditState } from './authoringFixtures'

function EmbeddedAuthoring({view,state}:{view:'media'|'session-lore';state:AuditState}) {
    const [text,setText] = useState('I follow the keeper through Silverwood toward the moonwell.')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const matcher = buildTriggerMatcher([{entry:auditEntry,lorebookId:auditLorebook.id,lorebookName:auditLorebook.name}])
    const match = scanText('moonwell',matcher)[0]
    return <AuthoringProviders state={state}>
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            {view==='media' ? <MediaStudioSection cardType="character" noun="character" template={{name:'Lyra Dawnwhisper',description:'A traveler following a silver path.'}} onImageUrl={noop} onThemeSongUrl={noop} ensureSaved={async ()=>'fixture'} themeTargetId="fixture" isAuthenticated onAuthRequired={noop} />
                : <><SectionHeader title="Lore in a scene" /><SessionLorebookPanel targetKind="character_chat" targetId="fixture" framed={false} /><p className="font-narrative text-body">The keeper waits beside the <LoreTriggerMark match={match} />.</p><HighlightedTextarea value={text} matcher={matcher} textareaRef={textareaRef} onChange={event=>setText(event.target.value)} ariaLabel="Message with lore references" rows={3} /></>}
        </div>
        <FloatingWindowsLayer />
    </AuthoringProviders>
}
const meta = {title:'Authoring/Embedded',component:EmbeddedAuthoring,parameters:{layout:'fullscreen'},args:{view:'media',state:'populated'},beforeEach:({args})=>installAuthoringApi(args.state)} satisfies Meta<typeof EmbeddedAuthoring>
export default meta
type Story=StoryObj<typeof meta>
export const MediaFull: Story={}
export const MediaEmpty: Story={args:{state:'empty'}}
export const MediaError: Story={args:{state:'error'}}
export const SessionLore: Story={args:{view:'session-lore'}}
export const SessionLoreEmpty: Story={args:{view:'session-lore',state:'empty'}}
export const SessionLoreError: Story={args:{view:'session-lore',state:'error'}}
