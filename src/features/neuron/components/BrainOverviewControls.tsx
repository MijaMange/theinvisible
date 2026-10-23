import { BRAIN_ANATOMY, BRAIN_REGION_ORDER } from '../data/brainAnatomy'
import type { BrainHemisphere, BrainRegion, BrainSelection } from '../types'

type BrainOverviewControlsProps = {
  selection: BrainSelection | null
  onSelect: (selection: BrainSelection) => void
  onResetView: () => void
}

export function BrainOverviewControls({
  selection,
  onSelect,
  onResetView,
}: BrainOverviewControlsProps) {
  const selectedRegion = selection ? BRAIN_ANATOMY[selection.region] : null

  function selectRegion(region: BrainRegion) {
    const entry = BRAIN_ANATOMY[region]
    onSelect({
      region,
      hemisphere: entry.hasHemisphere ? selection?.hemisphere ?? 'left' : null,
    })
  }

  function selectHemisphere(hemisphere: BrainHemisphere) {
    if (!selection || !selectedRegion?.hasHemisphere) return
    onSelect({ ...selection, hemisphere })
  }

  return (
    <section className="brain-controls" aria-label="Brain overview controls">
      <div className="brain-controls__top">
        <p className="brain-controls__eyebrow">BRAIN OVERVIEW</p>
        <button className="brain-controls__reset" type="button" onClick={onResetView}>
          Reset view
        </button>
      </div>
      <div className="brain-regions" role="group" aria-label="Select a brain region">
        {BRAIN_REGION_ORDER.map((region) => {
          const entry = BRAIN_ANATOMY[region]
          return (
            <button
              key={region}
              type="button"
              aria-pressed={selection?.region === region}
              onClick={() => selectRegion(region)}
            >
              {entry.shortName}
            </button>
          )
        })}
      </div>
      {selectedRegion ? (
        <div className="brain-region-info" aria-live="polite" aria-atomic="true">
          <div className="brain-region-info__heading">
            <h2>{selectedRegion.name}</h2>
            {selectedRegion.hasHemisphere && (
              <div className="brain-hemisphere" role="group" aria-label="Select hemisphere">
                {(['left', 'right'] as const).map((hemisphere) => (
                  <button
                    key={hemisphere}
                    type="button"
                    aria-pressed={selection?.hemisphere === hemisphere}
                    onClick={() => selectHemisphere(hemisphere)}
                  >
                    {hemisphere === 'left' ? 'Left' : 'Right'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p>{selectedRegion.description}</p>
        </div>
      ) : (
        <p className="brain-region-info__prompt">
          Select a region or rotate the model to explore.
        </p>
      )}
      <p className="brain-controls__note">
        Schematic anatomy; illustrative colours. Regional specializations work together.
      </p>
    </section>
  )
}
