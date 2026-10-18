import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { NovelAssistantRequestState } from './NovelAssistantRequestState'
import type { NovelAssistantPendingTurn } from '../persistence/assistantDraftJournal'
import type { NovelAssistantTerminalState } from '@/shared/types/novelAssistantControl.types'
import type { StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
const pending=():NovelAssistantPendingTurn=>({requestId:'request-stop',draftSequence:1,conversationId:7,
    body:{kind:'novel',message:wire.preview.context.request.message,source:wire.preview.context.request as StoryAssistantContextRequest,
        expected_packet_hash:wire.preview.context.packetHash,expected_prompt_hash:wire.preview.promptHash,expected_conversation_version:0},
    llm:{selection:{mode:'inherit'},expected_revision_id:wire.preview.profile.revision_id}})
const terminal=():NovelAssistantTerminalState=>({status:'cancelled',request_id:'request-stop',recovery_required:false,
    execution_id:'00000000-0000-4000-8000-000000000001',control:{stop_requested:true,executor_stopped:true,settlement:'pending',usage:null,usage_complete:false}})
const actions=()=>({onStop:vi.fn(),onCheck:vi.fn(),onResume:vi.fn(),busy:false,stopping:false,canStop:true,canResume:true})

it('allows Stop while the request is streaming, even when other actions are busy',()=>{
    const props=actions();render(<NovelAssistantRequestState {...props} busy pending={pending()} />)
    expect(screen.getByRole('button',{name:'Check saved result'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Stop request'}))
    expect(props.onStop).toHaveBeenCalledOnce()
})
it('never offers Resume for a retained Stop and labels unconfirmed cancellation truthfully',()=>{
    const props=actions();render(<NovelAssistantRequestState {...props} pending={{...pending(),stopRequested:true}} />)
    expect(screen.queryByRole('button',{name:'Resume original request'})).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Stop is not confirmed yet')
    fireEvent.click(screen.getByRole('button',{name:'Retry stop'}));expect(props.onStop).toHaveBeenCalledOnce()
})
it('uses a status read for late usage without enabling another generation',()=>{
    const props=actions();render(<NovelAssistantRequestState {...props} pending={{...pending(),stopRequested:true,terminal:terminal()}} />)
    expect(screen.getByRole('status')).toHaveTextContent('The request stopped')
    expect(screen.getByRole('status')).toHaveTextContent('Usage is still being confirmed')
    expect(screen.queryByRole('button',{name:'Resume original request'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Check usage'}));expect(props.onCheck).toHaveBeenCalledOnce();expect(props.onResume).not.toHaveBeenCalled()
})
it('reports completed work without claiming that Stop cancelled it',()=>{
    render(<NovelAssistantRequestState {...actions()} pending={null} outcome={{conversationId:7,result:{status:'completed',request_id:'request-stop',execution_id:'00000000-0000-4000-8000-000000000001'}}} />)
    expect(screen.getByRole('status')).toHaveTextContent('The reply finished before Stop')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
it('does not offer a second Stop while its control request is pending',()=>{
    render(<NovelAssistantRequestState {...actions()} pending={{...pending(),stopRequested:true}} stopping busy canStop={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('Stopping this request')
    expect(screen.getByRole('button',{name:'Retry stop'})).toBeDisabled()
})
it('says the reply is arriving, with only Stop, while it streams into this tab',()=>{
    const props=actions();render(<NovelAssistantRequestState {...props} busy live pending={pending()} />)
    expect(screen.getByRole('status')).toHaveTextContent('The reply is arriving')
    expect(screen.getByRole('status')).not.toHaveTextContent('uncertain result')
    expect(screen.queryByRole('button',{name:'Check saved result'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Resume original request'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Stop request'}))
    expect(props.onStop).toHaveBeenCalledOnce()
})
