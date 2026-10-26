import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertLlmCapacityUsage } from '../../../src/infrastructure/api/llmProfileContract.ts'

const live = JSON.parse(readFileSync(new URL('./evidence/capacity-result.json', import.meta.url), 'utf8'))
assert.throws(() => assertLlmCapacityUsage(live), { message: 'Invalid LLM capacity usage.' })
const withoutNovelAssistant = {
    ...live,
    operations: live.operations.map((operation) => ({
        ...operation,
        features: operation.features.filter((feature) => feature !== 'novel_assistant'),
    })),
}
assert.doesNotThrow(() => assertLlmCapacityUsage(withoutNovelAssistant))
console.log('Confirmed: novel_assistant makes the frontend reject the captured valid capacity response.')
