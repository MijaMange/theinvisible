import type { RefObject } from 'react'
import { ANATOMY_ORDER, ANATOMY } from '../data/anatomy'
import type { NeuronStructure } from '../types'

type AnatomicalNavigationProps = {
  selected: NeuronStructure | null
  onSelect: (structure: NeuronStructure) => void
  overviewButtonRef: RefObject<HTMLButtonElement | null>
}

export function AnatomicalNavigation({
  selected,
  onSelect,
  overviewButtonRef,
}: AnatomicalNavigationProps) {
  return (
    <nav className="anatomy-navigation" aria-label="Explore neuron anatomy">
      {ANATOMY_ORDER.map((structure) => {
        const entry = ANATOMY[structure]
        return (
          <button
            className="anatomy-navigation__button"
            type="button"
            key={structure}
            ref={structure === ANATOMY_ORDER[0] ? overviewButtonRef : undefined}
            aria-pressed={selected === structure}
            onClick={() => onSelect(structure)}
          >
            {entry.shortName}
          </button>
        )
      })}
    </nav>
  )
}
