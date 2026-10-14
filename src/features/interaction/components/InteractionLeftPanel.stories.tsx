import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { DataContext } from '@/app/providers/DataProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import { createWorkspaceTestState } from '@/shared/hooks/testing/workspaceTestUtils'
import { adventures, characters, worlds } from '@/ui/components/lists/fixtures'
import type { Adventure, EffectiveVoice, StoredCharacterVoice } from '@/shared'
import type { SessionVoiceSettings } from '@/shared/types/sessionVoice.types'
import { effectiveVoice, V1_VOICE, V2_VOICE, VOICE_KEY_MAREN, VOICE_KEY_SELA } from '@/features/voices/fixtures'
import { VoiceStoryProviders } from '@/features/voices/storybook/VoiceStoryProviders'
import { installVoiceStoryApi } from '@/features/voices/storybook/voiceStoryApi'
import { libraryCardToSnapshotCard } from '../utils/adventureSnapshot'
import { InteractionLeftPanel } from './InteractionLeftPanel'
import { SessionNarrationTierView } from './SessionNarrationTierToggle'

type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
const previewData = { characters, worlds, lorebooks: [], setLorebooks: () => {} } as unknown as DataValue
// The session lorebook panel reads the selected workspace ("Main library").
const previewWorkspace = createWorkspaceTestState().value()

const meta = {
  title: 'Interaction/InteractionLeftPanel',
  component: InteractionLeftPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The left rail in an adventure uses open scenario prose and compact portrait rows for the persona, world, and cast. Selecting a reference opens its card preview.' } },
  },
  decorators: [(Story) => (
    <WorkspaceContext.Provider value={previewWorkspace}>
    <DataContext.Provider value={previewData}>
      <FloatingWindowsProvider>
        <div className="w-80 max-w-full"><Story /></div>
      </FloatingWindowsProvider>
    </DataContext.Provider>
    </WorkspaceContext.Provider>
  )],
  argTypes: {
    adventure: { control: false },
    onBack: { control: false },
    narrationTierSlot: { control: false },
  },
  // Empty session ID keeps the isolated lorebook panel offline.
  args: {
    adventure: {
      ...adventures[0],
      id: '',
      snapshot: {
        schema_version: 2,
        source: 'resolved_library_clone',
        template_card_id: 'preview-template',
        template: {
          id: 'preview-template',
          name: adventures[0].scenario,
          description: adventures[0].turns?.[0]?.content ?? adventures[0].scenario,
          persona: libraryCardToSnapshotCard({ ...characters[3], role: 'persona' }, 'character'),
          characters: adventures[0].characters.map((character) => libraryCardToSnapshotCard(character, 'character')),
          world: [libraryCardToSnapshotCard(worlds[0], 'world')],
        },
      },
    },
    onBack: () => {},
  },
} satisfies Meta<typeof InteractionLeftPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

const baseAdventure = meta.args.adventure
const baseTemplate = baseAdventure.snapshot?.template

/**
 * Voice reads (leaving dates) run only for a signed-in reader: the
 * story reader is signed in, so the leaving badges carry their catalog date.
 */
const withSignedInReader: Decorator = function WithSignedInReader(Story) {
  return (
    <VoiceStoryProviders>
      <Story />
    </VoiceStoryProviders>
  )
}

/** The session narration tier control in the narrator section; a choice applies locally. */
function SessionTierDemo() {
  const [settings, setSettings] = useState<SessionVoiceSettings>({
    session_id: 7,
    tier_override: null,
    effective_tier: 'standard',
    tier_fallback_reason: null,
    tiers_allowed: ['standard', 'expressive'],
    provider_route: 'elevenlabs',
    updated_at: null,
  })
  return (
    <SessionNarrationTierView
      settings={settings}
      accountTier="standard"
      onChange={(tier) => setSettings((previous) => ({ ...previous, tier_override: tier, effective_tier: tier ?? 'standard' }))}
    />
  )
}

/** Sela stored as a new-engine voice; her catalog entry is leaving on Dec 1, 2026. */
const SELA_VOICE = { ...V2_VOICE, voice_key: VOICE_KEY_SELA, voice_name: 'Sela' }

/** What the server projects for a stored Sela that still plays (no substitution): `leaving` only. */
const selaLeaving = () => effectiveVoice({ voice_key: VOICE_KEY_SELA, display_name: 'Sela', badges: ['leaving'] })

/**
 * The adventure with a narrator voice and its projection, optionally with the
 * first cast member storing Sela. The server never pairs `leaving` with a
 * substitution: a leaving voice that still plays is badged `leaving`, and a
 * replaced one is badged `replaced`.
 */
function withNarrator(narrator_voice: StoredCharacterVoice, effective_narrator_voice: EffectiveVoice, castLeaving = false): Adventure {
  if (!baseAdventure.snapshot || !baseTemplate) return baseAdventure
  return {
    ...baseAdventure,
    snapshot: {
      ...baseAdventure.snapshot,
      narrator_voice,
      effective_narrator_voice,
      template: castLeaving ? {
        ...baseTemplate,
        characters: (baseTemplate.characters ?? []).map((card, index) => index === 0
          ? { ...card, voice: SELA_VOICE, effective_voice: selaLeaving() }
          : card),
      } : baseTemplate,
    },
  }
}

/** The narrator section is built only when voices are enabled for the build. */
const NEEDS_VOICES_FLAG = 'The narrator section renders only in a build with `VITE_FEATURE_VOICES_ENABLED=true`. With the example env (`false`) this story shows the panel without it.'

/**
 * On the new voices (R1): the narrator's classic voice was removed, so Maren
 * plays instead ("Plays as Maren", replaced), the session tier toggle sits
 * under the narrator voice, and the first cast member's voice is leaving on
 * its catalog date. Needs `VITE_FEATURE_VOICES_ENABLED=true`; the picker runs on fakes.
 */
export const NarratorOnNewVoices: Story = {
  beforeEach: () => installVoiceStoryApi(),
  decorators: [withSignedInReader],
  parameters: { docs: { description: { story: `The narrator voice is replaced and a cast voice is leaving. ${NEEDS_VOICES_FLAG}` } } },
  args: {
    onSnapshotChange: async () => {},
    narrationTierSlot: <SessionTierDemo />,
    adventure: withNarrator(
      V1_VOICE,
      effectiveVoice({ voice_key: VOICE_KEY_MAREN, display_name: 'Maren', substitution_reason: 'voice_removed', badges: ['replaced'] }),
      true,
    ),
  },
}

/**
 * On the new voices (R1): the narrator stores Sela, who still plays and is
 * leaving on her catalog date (no "Plays as" line). Needs
 * `VITE_FEATURE_VOICES_ENABLED=true`; the picker runs on fakes.
 */
export const NarratorLeaving: Story = {
  beforeEach: () => installVoiceStoryApi(),
  decorators: [withSignedInReader],
  parameters: { docs: { description: { story: `The narrator voice is leaving on its catalog date. ${NEEDS_VOICES_FLAG}` } } },
  args: {
    onSnapshotChange: async () => {},
    narrationTierSlot: <SessionTierDemo />,
    adventure: withNarrator(SELA_VOICE, selaLeaving()),
  },
}
