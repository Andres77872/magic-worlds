import '../App.css'

/**
 * Renders a row of action buttons (open/edit, start, delete) for list items.
 */
export type ListActionType = 'open' | 'edit' | 'start' | 'delete'
export interface ListAction {
  type: ListActionType
  label?: string
  onClick: () => void
}

export function ListItemActions({ actions }: { actions: ListAction[] }) {
  return (
    <div>
      {actions.map((action, idx) => {
        let className = ''
        switch (action.type) {
          case 'start':
            className = 'start-button'
            break
          case 'delete':
            className = 'delete-button'
            break
          case 'edit':
          case 'open':
            className = 'edit-button'
            break
        }
        return (
          <button
            key={idx}
            className={className}
            onClick={action.onClick}
          >
            {action.label ?? action.type.charAt(0).toUpperCase() + action.type.slice(1)}
          </button>
        )
      })}
    </div>
  )
}