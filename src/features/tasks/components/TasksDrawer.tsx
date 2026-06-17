/**
 * Mobile / small-screen host for the background-tasks UI: a full-height
 * right-anchored Drawer that wraps the shared `TasksPanel`. The desktop rail uses
 * the anchored `SidebarTasksMenu` popover instead; both render the same panel.
 * Opened from the provider's `drawerOpen` state (sidebar nav + mobile entries).
 */
import { Music2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBackgroundTasks } from '@/app/hooks'
import { Drawer, Eyebrow, Icon } from '@/ui/primitives'
import { TasksPanel } from './TasksPanel'

export function TasksDrawer() {
    const { t } = useTranslation()
    const { drawerOpen, closeDrawer } = useBackgroundTasks()

    return (
        <Drawer
            open={drawerOpen}
            onClose={closeDrawer}
            size="md"
            icon={<Icon icon={Music2} size={18} className="text-arcane-300" />}
            eyebrow={<Eyebrow tone="arcane">{t('tasksDrawer.eyebrow')}</Eyebrow>}
            title={t('tasksDrawer.title')}
        >
            <TasksPanel />
        </Drawer>
    )
}
