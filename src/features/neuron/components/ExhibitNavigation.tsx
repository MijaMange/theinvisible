import type { ExhibitView } from '../types'

type ExhibitNavigationProps = {
  view: ExhibitView
  onNavigate: (view: ExhibitView) => void
}

export function ExhibitNavigation({ view, onNavigate }: ExhibitNavigationProps) {
  return (
    <nav className="exhibit-navigation" aria-label="Explore the exhibition">
      {view !== 'brain' && (
        <button type="button" onClick={() => onNavigate('brain')}>
          Brain overview
        </button>
      )}
      {view === 'brain' && (
        <button type="button" onClick={() => onNavigate('neuron')}>
          Explore a neuron
        </button>
      )}
    </nav>
  )
}
