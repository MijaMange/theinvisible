import type { ExhibitView } from '../types'

type ExhibitNavigationProps = {
  view: ExhibitView
  creatorActive?: boolean
  onNavigate: (view: ExhibitView) => void
  onCreator: () => void
}

export function ExhibitNavigation({
  view,
  creatorActive = false,
  onNavigate,
  onCreator,
}: ExhibitNavigationProps) {
  return (
    <nav className="exhibit-navigation" aria-label="Explore the exhibition">
      <button
        type="button"
        aria-current={!creatorActive && view === 'brain' ? 'page' : undefined}
        onClick={() => onNavigate('brain')}
      >
        Brain
      </button>
      <button
        type="button"
        aria-current={!creatorActive && view === 'neuron' ? 'page' : undefined}
        onClick={() => onNavigate('neuron')}
      >
        Neuron
      </button>
      <button
        type="button"
        aria-current={!creatorActive && view === 'synapse' ? 'page' : undefined}
        onClick={() => onNavigate('synapse')}
      >
        Synapse
      </button>
      <a
        href="/creator"
        aria-current={creatorActive ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault()
          onCreator()
        }}
      >
        Creator
      </a>
    </nav>
  )
}
