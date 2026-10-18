import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyAssistantTurn } from './assistantContract'
import { verifyNovelAssistantPreview,verifyNovelAssistantRecord } from './novelAssistantContract'

const file=process.env.NOVEL_ASSISTANT_TURNS_PERSISTENCE
it.skipIf(!file)('guards actual native conversation, prompt, candidate and historical replay wires',()=>{
    const wire=JSON.parse(readFileSync(file!,'utf8'))
    expect(wire.projectDatabaseWrites).toBe(0)
    expect(wire.providerRequests).toBe(0)
    expect(wire.previewTablesUnchanged).toBe(112)
    expect(wire.lateRollbackVerified).toBe(true)
    expect(wire.automaticApplication).toBe(false)
    for(const preview of wire.previews)expect(verifyNovelAssistantPreview(preview,preview.conversationId,wire.index,preview.context.request)).toBe(true)
    for(const {requestId,turn,status} of wire.turns){
        expect(verifyAssistantTurn(turn,'novel',turn.conversation.conversation_id,requestId)).toBe(true)
        expect(verifyAssistantTurn(status.turn,'novel',turn.conversation.conversation_id,requestId)).toBe(true)
        expect(verifyNovelAssistantRecord(turn.assistant_message.metadata.novel,wire.index.id,turn.llm_execution.execution_id)).toBe(true)
    }
    const historical=wire.historyAfterWritingChange.turn
    expect(verifyAssistantTurn(historical,'novel',historical.conversation.conversation_id,'native-suggest')).toBe(true)
    expect(wire.sameAcceptanceReplayed).toBe(true)
    expect(historical.assistant_message.metadata.novel.result.proposal.baseRevision+1).toBe(wire.reviewedAcceptance.revision)
})
