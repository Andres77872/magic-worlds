import type { Adventure } from '../types'
import '../App.css'

export function InProgressList({
  adventures,
}: {
  adventures: Adventure[]
}) {
  if (adventures.length === 0) {
    return <p>No adventures in progress.</p>
  }
  return (
    <ul className="list">
      {adventures.map((a, idx) => (
        <li key={idx} className="list-item">
          <span>{a.scenario}</span>
        </li>
      ))}
    </ul>
  )
}