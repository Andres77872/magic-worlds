import { expect, it } from 'vitest'
import wire from '@/test/fixtures/novelAssistantStopNative.json'
import { verifyNovelAssistantTurnState } from './novelAssistantControlContract'

it.each(wire.cases)('reads the actual $mode/$payer terminal response without inventing completion or free usage',record=>{
    expect(verifyNovelAssistantTurnState(record.state,record.storyId,record.conversationId,record.requestId)).toBe(true)
    expect(verifyNovelAssistantTurnState(record.state,record.storyId,record.conversationId,'foreign-request')).toBe(false)
    if ('control' in record.state && record.state.control) {
        expect(record.state.recovery_required).toBe(false)
        if (record.mode==='snapshot'||record.mode==='failure') {
            expect(record.state.control.settlement).toBe('pending')
            expect(record.state.control.usage_complete).toBe(false)
        }
    }
})
