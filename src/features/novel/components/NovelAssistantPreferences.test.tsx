import { fireEvent,render,screen,waitFor } from '@testing-library/react'
import { expect,it,vi } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import type { StoryAssistantPreferences } from '@/shared/types/storyAssistant.types'
import { NovelAssistantPreferences,type AssistantPreferencesApi } from './NovelAssistantPreferences'

const brief:StoryAssistantPreferences={length:'brief',format:'any',tone:'neutral',replyLanguage:'question',note:''}
function api():AssistantPreferencesApi{
    return {get:vi.fn(async()=>({schemaVersion:1 as const,preferences:null,version:0})),
        save:vi.fn(async(preferences:StoryAssistantPreferences,version:number)=>({schemaVersion:1 as const,preferences,version:version+1})),
        clear:vi.fn(async()=>({schemaVersion:1 as const,preferences:null,version:0}))}
}
const open=()=>fireEvent.click(screen.getByText('Reply style'))
const choose=(field:string,option:string)=>{fireEvent.click(screen.getByRole('combobox',{name:field}));fireEvent.click(screen.getByRole('option',{name:option}))}

it('reads the account preferences only when opened and saves the changed choices at the version read',async()=>{
    const client=api()
    render(<NovelAssistantPreferences api={client}/>)
    expect(client.get).not.toHaveBeenCalled()
    open()
    expect(await screen.findByText('No reply style is saved; the assistant uses its defaults.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Save reply style'})).toBeDisabled()
    choose('Length','Brief')
    fireEvent.change(screen.getByRole('textbox',{name:'Anything else about how you like answers'}),{target:{value:'Call me Sam. 🙂'}})
    fireEvent.click(screen.getByRole('button',{name:'Save reply style'}))
    await waitFor(()=>expect(client.save).toHaveBeenCalledWith({...brief,note:'Call me Sam. 🙂'},0))
    expect(await screen.findByText(/Reply style saved/)).toBeInTheDocument()
    expect(screen.getByText('Reply style · Brief, Neutral')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Use defaults'}))
    await waitFor(()=>expect(client.clear).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/Reply style cleared/)).toBeInTheDocument()
    expect(screen.getByRole('combobox',{name:'Length'})).toHaveTextContent('Balanced')
})

it('shows what another tab saved instead of overwriting it, and refuses an over-long note',async()=>{
    const client=api()
    vi.mocked(client.get).mockResolvedValueOnce({schemaVersion:1,preferences:brief,version:2}).mockResolvedValueOnce({schemaVersion:1,preferences:{...brief,length:'detailed'},version:3})
    vi.mocked(client.save).mockRejectedValueOnce(new ApiError(409,'changed',{code:'STORY_ASSISTANT_PREFERENCES_CHANGED',retryable:false}))
    render(<NovelAssistantPreferences api={client}/>)
    open()
    await screen.findByText('Saved for your account.')
    choose('Tone','Direct')
    fireEvent.click(screen.getByRole('button',{name:'Save reply style'}))
    expect(await screen.findByText(/changed in another tab or device/)).toBeInTheDocument()
    await waitFor(()=>expect(screen.getByRole('combobox',{name:'Length'})).toHaveTextContent('Detailed'))
    expect(screen.getByRole('combobox',{name:'Tone'})).toHaveTextContent('Neutral')
    expect(client.save).toHaveBeenCalledWith({...brief,tone:'direct'},2)
    fireEvent.change(screen.getByRole('textbox',{name:'Anything else about how you like answers'}),{target:{value:'x'.repeat(501)}})
    expect(screen.getByText('Shorten the note.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Save reply style'})).toBeDisabled()
})
