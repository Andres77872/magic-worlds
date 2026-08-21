import { LockKeyhole } from 'lucide-react'
import { Button, Card, Icon } from '@/ui/primitives'

interface StoryReauthenticationGateProps {
    onLogin: () => void
    onContinueSignedOut: () => void
}

export function StoryReauthenticationGate({
    onLogin,
    onContinueSignedOut,
}: StoryReauthenticationGateProps) {
    return (
        <div className="absolute inset-0 z-[10] flex min-h-full items-center justify-center bg-ink-800/95 p-5">
            <Card className="w-full max-w-lg">
                <div className="flex flex-col items-center gap-4 p-6 text-center">
                    <span className="rounded-lg bg-amber-500/15 p-3 text-amber-500">
                        <Icon icon={LockKeyhole} size={24} />
                    </span>
                    <div>
                        <h2 className="font-display text-h3 text-parchment-50">Reauthentication required</h2>
                        <p className="mt-2 font-ui text-sm text-parchment-300">
                            Your chapter draft is still here. Log back in with the same account to continue writing.
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="primary" onClick={onLogin}>Log in again</Button>
                        <Button variant="ghost" onClick={onContinueSignedOut}>Continue signed out</Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
