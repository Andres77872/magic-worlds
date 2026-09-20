import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActiveAdventuresPage } from '@/features/interaction/components/ActiveAdventuresPage'
import { AdventureInteraction } from '@/features/interaction/components/AdventureInteraction'
import { CharacterChat } from '@/features/characterChat/components/CharacterChat'
import { ChatroomPage } from '@/features/characterChat/components/ChatroomPage'
import { CallsPage } from '@/features/call/components/CallsPage'
import { CallTranscriptView } from '@/features/call/components/CallTranscriptView'
import { VoiceStudioPage } from '@/features/voices/components/VoiceStudioPage'
import { VoicePickerDialog } from '@/features/voices/components/VoicePickerDialog'
import { AddCardModal } from '@/features/interaction/components/AddCardModal'
import { AdventureCardDrawer } from '@/features/interaction/components/AdventureCardDrawer'
import { AdminVoicesPage } from './voices/components/AdminVoicesPage'
import { AdminCreditCodesPage } from './creditCodes/components/AdminCreditCodesPage'
import { characters } from '@/ui/components/lists/fixtures'
import { auditAdventure, auditCall, installPlayAdminAuditApi, PlayAdminAuditProviders, type AuditState } from './playAdminAuditFixtures'

type Scene = 'adventures' | 'adventure' | 'character' | 'chatroom' | 'calls' | 'transcript' | 'voice-studio' | 'voice-picker' | 'admin-voices' | 'credit-codes' | 'add-cast' | 'adventure-card' | 'adventure-world' | 'adventure-persona'
function AuditScene({ scene, state }: { scene: Scene; state: AuditState }) {
    let content
    switch (scene) {
        case 'adventures': content = <ActiveAdventuresPage />; break
        case 'adventure': content = <AdventureInteraction />; break
        case 'character': content = <CharacterChat />; break
        case 'chatroom': content = <ChatroomPage />; break
        case 'calls': content = <CallsPage />; break
        case 'transcript': content = <CallTranscriptView call={auditCall} characters={characters} onBack={() => {}} />; break
        case 'voice-studio': content = <VoiceStudioPage />; break
        case 'voice-picker': content = <VoicePickerDialog open currentVoice={null} onSelect={() => {}} onClose={() => {}} />; break
        case 'admin-voices': content = <AdminVoicesPage />; break
        case 'credit-codes': content = <AdminCreditCodesPage />; break
        case 'add-cast': content = <AddCardModal open title="Add characters" confirmKind="character" candidates={state === 'empty' ? [] : characters.map((character) => ({ id: character.id, name: character.name, badge: character.race, description: character.description }))} emptyHint="Every character is already in this adventure." onClose={() => {}} onConfirm={async () => {}} />; break
        case 'adventure-card': content = <AdventureCardDrawer open entry={{ key: 'c1', ref: { kind: 'character', index: 0 }, card: auditAdventure.snapshot!.template.characters![0] }} onClose={() => {}} onSave={async () => { throw new Error('Offline preview: your draft was not saved.') }} onRemove={async () => {}} />; break
        case 'adventure-world': content = <AdventureCardDrawer open entry={{ key: 'w1', ref: { kind: 'world', index: 0 }, card: auditAdventure.snapshot!.template.world![0] }} onClose={() => {}} onSave={async () => { throw new Error('Offline preview: your draft was not saved.') }} onRemove={async () => {}} />; break
        case 'adventure-persona': content = <AdventureCardDrawer open entry={{ key: 'p1', ref: { kind: 'persona' }, card: auditAdventure.snapshot!.template.persona! }} onClose={() => {}} onSave={async () => { throw new Error('Offline preview: your draft was not saved.') }} onRemove={async () => {}} />; break
    }
    const conversation = scene === 'adventure' || scene === 'character'
    return <PlayAdminAuditProviders state={state}><div className={`flex w-full flex-col ${conversation ? 'h-[calc(100dvh-3rem)] min-h-0' : 'min-h-[760px]'}`}>{content}</div></PlayAdminAuditProviders>
}

const meta = {
    title: 'Audit/Play and admin',
    component: AuditScene,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen', docs: { description: { component: 'Complete route and overlay fixtures for the UI audit. Every API method and chat transport is replaced in beforeEach and restored afterward. Mutating actions fail locally; previews never generate audio, open a microphone, or write server data.' } } },
    beforeEach: ({ args }) => installPlayAdminAuditApi(args.state),
    args: { scene: 'adventures', state: 'populated' },
} satisfies Meta<typeof AuditScene>
export default meta
type Story = StoryObj<typeof meta>
export const Adventures: Story = {}
export const AdventuresEmpty: Story = { args: { state: 'empty' } }
export const AdventuresError: Story = { args: { state: 'error' } }
export const Adventure: Story = { args: { scene: 'adventure' } }
export const AdventureEmpty: Story = { args: { scene: 'adventure', state: 'empty' } }
export const AdventureError: Story = { args: { scene: 'adventure', state: 'error' } }
export const AdventureLoading: Story = { args: { scene: 'adventure', state: 'loading' } }
export const Character: Story = { args: { scene: 'character' } }
export const CharacterEmpty: Story = { args: { scene: 'character', state: 'empty' } }
export const CharacterLoading: Story = { args: { scene: 'character', state: 'loading' } }
export const CharacterError: Story = { args: { scene: 'character', state: 'error' } }
export const Chatroom: Story = { args: { scene: 'chatroom' } }
export const ChatroomEmpty: Story = { args: { scene: 'chatroom', state: 'empty' } }
export const ChatroomLoading: Story = { args: { scene: 'chatroom', state: 'loading' } }
export const ChatroomError: Story = { args: { scene: 'chatroom', state: 'error' } }
export const Calls: Story = { args: { scene: 'calls' } }
export const CallsEmpty: Story = { args: { scene: 'calls', state: 'empty' } }
export const CallsError: Story = { args: { scene: 'calls', state: 'error' } }
export const CallsLoading: Story = { args: { scene: 'calls', state: 'loading' } }
export const Transcript: Story = { args: { scene: 'transcript' } }
export const TranscriptEmpty: Story = { args: { scene: 'transcript', state: 'empty' } }
export const TranscriptError: Story = { args: { scene: 'transcript', state: 'error' } }
export const TranscriptLoading: Story = { args: { scene: 'transcript', state: 'loading' } }
export const Voices: Story = { args: { scene: 'voice-studio' } }
export const VoicesEmpty: Story = { args: { scene: 'voice-studio', state: 'empty' } }
export const VoicesError: Story = { args: { scene: 'voice-studio', state: 'error' } }
export const VoicesLoading: Story = { args: { scene: 'voice-studio', state: 'loading' } }
export const VoicesSignedOut: Story = { args: { scene: 'voice-studio', state: 'signed-out' } }
export const VoicePicker: Story = { args: { scene: 'voice-picker' } }
export const VoicePickerError: Story = { args: { scene: 'voice-picker', state: 'error' } }
export const VoicePickerEmpty: Story = { args: { scene: 'voice-picker', state: 'empty' } }
export const VoicePickerLoading: Story = { args: { scene: 'voice-picker', state: 'loading' } }
export const AdminVoices: Story = { args: { scene: 'admin-voices' } }
export const AdminVoicesEmpty: Story = { args: { scene: 'admin-voices', state: 'empty' } }
export const AdminVoicesError: Story = { args: { scene: 'admin-voices', state: 'error' } }
export const AdminVoicesLoading: Story = { args: { scene: 'admin-voices', state: 'loading' } }
export const AdminVoicesRestricted: Story = { args: { scene: 'admin-voices', state: 'restricted' } }
export const CreditCodes: Story = { args: { scene: 'credit-codes' } }
export const CreditCodesEmpty: Story = { args: { scene: 'credit-codes', state: 'empty' } }
export const CreditCodesError: Story = { args: { scene: 'credit-codes', state: 'error' } }
export const CreditCodesLoading: Story = { args: { scene: 'credit-codes', state: 'loading' } }
export const CreditCodesRestricted: Story = { args: { scene: 'credit-codes', state: 'restricted' } }
export const AddCast: Story = { args: { scene: 'add-cast' } }
export const AddCastEmpty: Story = { args: { scene: 'add-cast', state: 'empty' } }
export const AdventureCard: Story = { args: { scene: 'adventure-card' } }
export const AdventureWorld: Story = { args: { scene: 'adventure-world' } }
export const AdventurePersona: Story = { args: { scene: 'adventure-persona' } }
