import { BRAIN_ANATOMY } from '../data/brainAnatomy'
import type { BrainSelection } from '../types'

type BrainOverviewControlsProps = {
  selection: BrainSelection | null
}

export function BrainOverviewControls({
  selection,
}: BrainOverviewControlsProps) {
  const selectedRegion = selection ? BRAIN_ANATOMY[selection.region] : null

  if (!selection || !selectedRegion) return null

  return (
    <section className="brain-controls" aria-label="Selected brain region">
      <div className="brain-region-info" aria-live="polite" aria-atomic="true">
        <div className="brain-region-info__heading">
          <h2>{selectedRegion.name}</h2>
          {selectedRegion.hasHemisphere && selection.hemisphere && (
            <p className="brain-region-info__hemisphere">
              {selection.hemisphere === 'left' ? 'Left hemisphere' : 'Right hemisphere'}
            </p>
          )}
        </div>
        <p>{selectedRegion.description}</p>
      </div>
    </section>
  )
}
