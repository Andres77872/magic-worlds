import type { Adventure } from '../types'
import '../App.css'

export function TemplateList({
  templates,
  onStart,
}: {
  templates: Adventure[]
  onStart: (a: Adventure) => void
}) {
  if (templates.length === 0) {
    return <p>No adventure templates yet.</p>
  }
  return (
    <ul className="list">
      {templates.map((t, idx) => (
        <li key={idx} className="list-item">
          <span>{t.scenario}</span>
          <button className="start-button" onClick={() => onStart(t)}>
            Start
          </button>
        </li>
      ))}
    </ul>
  )
}