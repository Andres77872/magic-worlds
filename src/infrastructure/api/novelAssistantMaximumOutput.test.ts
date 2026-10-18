import { describe,expect,it } from 'vitest'
import wire from '@/test/fixtures/novelAssistantMaximumTurn.json'
import { verifyAssistantTurn } from './assistantContract'
import { readEventStream } from './sse'

/** Public fictional response captured from the two-service MySQL/fake-provider proof. */
describe('maximum-size native novel assistant response',()=>{
    it('retains the exact answer, proposed writing and literal saved evidence',()=>{
        const {type,...turn}=wire
        const record=turn.assistant_message.metadata.novel
        expect(type).toBe('final')
        expect(verifyAssistantTurn(turn,'novel',turn.conversation.conversation_id,turn.request_id)).toBe(true)
        expect(Array.from(record.result.answer)).toHaveLength(20_000)
        expect(Array.from(record.result.proposal.markdown)).toHaveLength(120_000)
        expect(record.context.packet.sources[0].passages[0].quote).toContain('{{env.FAKE_JOINT_LITERAL}}')
        expect(new TextEncoder().encode(JSON.stringify(wire)).length).toBeGreaterThan(1024*1024)
        expect(JSON.stringify(wire)).not.toContain('FAKE_JOINT_PROVIDER_CREDENTIAL')
    })

    it('passes a complete large final event through fragmented UTF-8 SSE framing',async()=>{
        const bytes=new TextEncoder().encode(`event: final\ndata: ${JSON.stringify(wire)}\n\n`)
        let position=0,count=0
        const stream=new ReadableStream<Uint8Array>({pull(controller){
            if(position===bytes.length){controller.close();return}
            const next=Math.min(position+4093,bytes.length)
            controller.enqueue(bytes.slice(position,next));position=next
        }})
        await readEventStream<{type:string}>(new Response(stream,{headers:{'Content-Type':'text/event-stream'}}),event=>{
            const {type,...turn}=event
            expect(type).toBe('final');count++
            expect(verifyAssistantTurn(turn,'novel',wire.conversation.conversation_id,wire.request_id)).toBe(true)
        })
        expect(count).toBe(1)
    })
})
