import { expect, it } from 'vitest'
import { referenceKeeping } from './referenceKeeping'

const LABELS = ['Mara', 'Mara Vell', 'Gull Point', 'Tide_Bell']

it('counts each @reference by its longest label, as the editor reads it back into a mention', () => {
    const original = '@Mara Vell kept the lamp at @Gull Point. @mara read the letter; @Tide_Bell rang. Mara@home is not one.'
    expect(referenceKeeping(original, '@Mara Vell guardaba la lámpara en @Gull Point. @Mara leyó la carta; sonó @Tide\\_Bell.', LABELS)).toEqual([
        { label: 'Mara Vell', before: 1, after: 1 }, { label: 'Gull Point', before: 1, after: 1 },
        { label: 'Mara', before: 1, after: 1 }, { label: 'Tide_Bell', before: 1, after: 1 },
    ])
})

it('reports a reference the proposal translated or dropped, and nothing for text without references', () => {
    expect(referenceKeeping('@Gull Point and @Gull Point again', 'Punta Gaviota y @Gull Point otra vez', LABELS)).toEqual([{ label: 'Gull Point', before: 2, after: 1 }])
    expect(referenceKeeping('@Gull Pointless is not a reference.', '', LABELS)).toEqual([])
    expect(referenceKeeping('No references here.', '@Mara', LABELS)).toEqual([])
})
