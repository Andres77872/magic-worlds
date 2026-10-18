import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { NovelProposalReferences } from './NovelProposalReferences'

const LABELS = ['Mara', 'Gull Point']

it('says which references a proposal keeps', () => {
    render(<NovelProposalReferences original="@Mara and @Mara at @Gull Point." proposed="@Mara y @Mara en @Gull Point." labels={LABELS} />)
    expect(screen.getByRole('status')).toHaveTextContent('References kept: @Mara (2), @Gull Point.')
})

it('warns when accepting would leave a reference as plain text', () => {
    render(<NovelProposalReferences original="@Mara at @Gull Point." proposed="@Mara en Punta Gaviota." labels={LABELS} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Not kept as references: @Gull Point (0 of 1). Accepting leaves them as plain text unless you write them back as @name.')
})

it('shows nothing when the original has no references', () => {
    const view = render(<NovelProposalReferences original="Mara at the lamp." proposed="Mara en la lámpara." labels={LABELS} />)
    expect(view.container).toBeEmptyDOMElement()
})
