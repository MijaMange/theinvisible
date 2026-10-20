import { ANATOMY } from '../data/anatomy'
import type { NeuronStructure } from '../types'

type StructureInfoPanelProps = {
  structure: NeuronStructure | null
  onClose: () => void
}

export function StructureInfoPanel({ structure, onClose }: StructureInfoPanelProps) {
  if (!structure) return null

  const entry = ANATOMY[structure]

  return (
    <section
      className="structure-panel"
      aria-labelledby="structure-title"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="structure-panel__eyebrow">NEURON ANATOMY</p>
      <h2 id="structure-title">{entry.name}</h2>
      <p className="structure-panel__summary">{entry.summary}</p>
      <p className="structure-panel__label">FUNCTION</p>
      <p className="structure-panel__copy">{entry.function}</p>
      <p className="structure-panel__label">IN FOCUS</p>
      <p className="structure-panel__copy">{entry.detail}</p>
      <button
        className="structure-panel__back"
        type="button"
        onClick={onClose}
        aria-label="Return to complete neuron view"
      >
        <span aria-hidden="true">←</span>
        <span>Return to the whole neuron</span>
      </button>
    </section>
  )
}
