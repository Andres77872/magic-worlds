import type { Meta, StoryObj } from '@storybook/react-vite'

/** Side-by-side real viewport previews. Scaling changes only the audit display,
 * never the iframe's responsive layout, and isolates parallel reviewers. */
function ResponsiveAudit() {
    const subject = new URLSearchParams(window.location.search).get('subject') ?? 'audit-system--profile-account'
    const src = `/iframe.html?id=${encodeURIComponent(subject)}&viewMode=story`
    return <div className="-m-6 flex gap-4">
        <section className="shrink-0" style={{ width: 896 }}>
            <p className="py-2 text-caption text-fg-muted">Desktop · 1280px</p>
            <div style={{ width: 896, height: 805 }}>
                <iframe title="Desktop preview" src={src} style={{ width: 1280, height: 1150, transform: 'scale(.7)', transformOrigin: 'top left', border: 0 }} />
            </div>
        </section>
        <section className="shrink-0" style={{ width: 390 }}>
            <p className="py-2 text-caption text-fg-muted">Mobile · 390px</p>
            <iframe title="Mobile preview" src={src} style={{ width: 390, height: 844, border: 0 }} />
        </section>
    </div>
}
const meta = { title: 'Audit/Responsive comparison', component: ResponsiveAudit, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof ResponsiveAudit>
export default meta
type Story = StoryObj<typeof meta>
export const Compare: Story = {}
