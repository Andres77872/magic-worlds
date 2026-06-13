/**
 * ResumeBand — "pick up the thread": the sessions still in motion, after the
 * hero has taken the freshest one. A two-column grid of landscape ResumeCards
 * (visibly not discovery), with its own delete confirmation.
 */

import { useState } from 'react'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import type { ResumeSession } from './resumeModel'
import { ResumeCard } from './ResumeCard'
import { ZoneHeader } from './ZoneHeader'

export interface ResumeBandProps {
    sessions: ResumeSession[]
    onOpen: (session: ResumeSession) => void
    onDelete: (session: ResumeSession) => Promise<void> | void
}

export function ResumeBand({ sessions, onOpen, onDelete }: ResumeBandProps) {
    const [pending, setPending] = useState<ResumeSession | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const confirmDelete = async () => {
        const target = pending
        setPending(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            await onDelete(target)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <section className="flex flex-col" data-testid="resume-band">
            <ZoneHeader eyebrow="Pick up the thread" title="Stories in motion" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
                {sessions.map((session) => (
                    <ResumeCard
                        key={`${session.kind}-${session.id}`}
                        session={session}
                        deleting={deletingId === session.id}
                        onContinue={() => onOpen(session)}
                        onDelete={() => setPending(session)}
                    />
                ))}
            </div>

            <ConfirmDialog
                visible={pending !== null}
                title={pending?.kind === 'chat' ? 'Delete chat' : 'Delete adventure'}
                message={
                    pending
                        ? pending.kind === 'chat'
                          ? `Delete your chat with ${pending.title}? The conversation cannot be recovered. ${pending.title}'s card is not affected.`
                          : `Delete "${pending.title}"? This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPending(null)}
            />
        </section>
    )
}
