type SynapseRunState = 'idle' | 'playing' | 'paused' | 'complete'

type SynapseControlsProps = {
  runState: SynapseRunState
  elapsed: number
  modelLoaded: boolean
  slowMotion: boolean
  onBack: () => void
  onSend: () => void
  onPauseResume: () => void
  onReset: () => void
  onSlowMotionChange: () => void
}

const STAGES = [
  { time: 1.6, label: 'An action potential reaches the presynaptic terminal.' },
  { time: 3.2, label: 'Calcium channels open and calcium enters the terminal.' },
  { time: 4.8, label: 'A docked vesicle fuses with the presynaptic membrane.' },
  { time: 7.8, label: 'Glutamate crosses the synaptic cleft by diffusion.' },
  { time: 9.8, label: 'Glutamate binds AMPA receptors and opens their channels.' },
  { time: 12, label: 'A local postsynaptic response appears.' },
]

function stageAt(elapsed: number) {
  return STAGES.find((stage) => elapsed < stage.time)?.label ?? STAGES[STAGES.length - 1].label
}

export function SynapseControls({
  runState,
  elapsed,
  modelLoaded,
  slowMotion,
  onBack,
  onSend,
  onPauseResume,
  onReset,
  onSlowMotionChange,
}: SynapseControlsProps) {
  const progress = Math.min(100, (elapsed / 12) * 100)

  return (
    <>
      <header className="synapse-heading">
        <p className="structure-panel__eyebrow">THE INVISIBLE / SYNAPTIC TRANSMISSION</p>
        <h2>From nerve impulse to local response</h2>
        <p className="synapse-heading__stage" aria-live="polite">
          {runState === 'idle' ? 'Ready to send a signal.' : stageAt(elapsed)}
        </p>
        <p className="synapse-heading__note">
          Illustrative colors and timing. One synaptic event does not automatically trigger
          an action potential in the receiving neuron.
        </p>
      </header>

      <section className="synapse-controls" aria-label="Signal animation controls">
        <button
          className="synapse-controls__back"
          type="button"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
          Back to neuron
        </button>
        <div
          className="synapse-controls__progress"
          role="progressbar"
          aria-label="Signal transmission progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="synapse-controls__actions">
          {runState === 'idle' || runState === 'complete' ? (
            <button type="button" onClick={onSend} disabled={!modelLoaded}>
              Send signal
            </button>
          ) : (
            <button type="button" onClick={onPauseResume} disabled={!modelLoaded}>
              {runState === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            disabled={!modelLoaded || (runState === 'idle' && elapsed === 0)}
          >
            Reset
          </button>
          <label className="synapse-controls__slow">
            <input
              type="checkbox"
              checked={slowMotion}
              onChange={onSlowMotionChange}
            />
            <span>Slow motion</span>
          </label>
        </div>
      </section>
    </>
  )
}
