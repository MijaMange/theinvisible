import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { AnatomicalNavigation } from './features/neuron/components/AnatomicalNavigation'
import { BrainOverviewControls } from './features/neuron/components/BrainOverviewControls'
import { ExhibitNavigation } from './features/neuron/components/ExhibitNavigation'
import { StructureInfoPanel } from './features/neuron/components/StructureInfoPanel'
import { SynapseControls } from './features/neuron/components/SynapseControls'
import { useNeuronSelection } from './features/neuron/hooks/useNeuronSelection'
import { NeuronScene } from './features/neuron/NeuronScene'
import type { BrainSelection, ExhibitView } from './features/neuron/types'
import './App.css'

type ModelStatusProps = {
  state: 'loading' | 'loaded' | 'error'
}

function ModelStatus({ state, view }: ModelStatusProps & { view: ExhibitView }) {
  const { progress } = useProgress()
  if (state === 'loaded') return null

  const isError = state === 'error'
  const modelName = view === 'brain'
    ? 'brain model'
    : view === 'synapse'
      ? 'synapse model'
      : 'neuron model'
  const message = isError
    ? `The ${modelName} could not be loaded. Check your connection and reload the page.`
    : progress > 0
      ? `Loading the ${modelName} ${Math.round(progress)}%`
      : `Loading the ${modelName}...`

  return (
    <p className="model-status" role={isError ? 'alert' : 'status'}>
      {message}
    </p>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

function App() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const orientation = useRef({ x: 0, y: 0 })
  const brainOrientation = useRef({ x: 0, y: 0 })
  const navigationRef = useRef<HTMLButtonElement>(null)
  const [modelStatus, setModelStatus] = useState<ModelStatusProps['state']>('loading')
  const [view, setView] = useState<ExhibitView>('neuron')
  const [brainSelection, setBrainSelection] = useState<BrainSelection | null>(null)
  const [brainResetKey, setBrainResetKey] = useState(0)
  const [runState, setRunState] = useState<'idle' | 'playing' | 'paused' | 'complete'>('idle')
  const [slowMotion, setSlowMotion] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const { state, select, hover, close } = useNeuronSelection()

  const handleModelLoaded = useCallback(() => setModelStatus('loaded'), [])
  const handleModelError = useCallback(() => setModelStatus('error'), [])
  const handleBrainSelect = useCallback((selection: BrainSelection) => {
    setBrainSelection(selection)
  }, [])
  const handleSynapseProgress = useCallback((time: number) => setElapsed(time), [])
  const handleSynapseComplete = useCallback(() => setRunState('complete'), [])

  const handleClose = useCallback(() => {
    close()
    navigationRef.current?.focus()
  }, [close])
  const handleBackToNeuron = useCallback(() => {
    setView('neuron')
    setRunState('idle')
    setElapsed(0)
    setModelStatus('loading')
  }, [])
  const handleNavigate = useCallback((nextView: ExhibitView) => {
    setView(nextView)
    setModelStatus('loading')
    setBrainSelection(null)
    if (nextView === 'brain') {
      brainOrientation.current.x = 0
      brainOrientation.current.y = 0
      setBrainResetKey((key) => key + 1)
    }
    if (nextView !== 'synapse') {
      setRunState('idle')
      setElapsed(0)
    }
    if (nextView === 'brain') close()
  }, [close])

  useEffect(() => {
    if (!state.selected && view !== 'synapse') return

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (view === 'synapse') handleBackToNeuron()
      else if (view === 'brain' && brainSelection) setBrainSelection(null)
      else handleClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [brainSelection, handleBackToNeuron, handleClose, state.selected, view])

  const handleExploreSynapse = useCallback(() => {
    setView('synapse')
    setModelStatus('loading')
    setBrainSelection(null)
    setRunState('idle')
    setElapsed(0)
  }, [])

  const handleSendSignal = useCallback(() => {
    setElapsed(0)
    setResetKey((key) => key + 1)
    setRunState('playing')
  }, [])

  const handlePauseResume = useCallback(() => {
    setRunState((current) => current === 'paused' ? 'playing' : 'paused')
  }, [])

  const handleResetSignal = useCallback(() => {
    setElapsed(0)
    setResetKey((key) => key + 1)
    setRunState('idle')
  }, [])

  function handleSceneKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (view === 'brain') {
      switch (event.key) {
        case 'ArrowLeft':
          brainOrientation.current.y = Math.min(0.8, brainOrientation.current.y + 0.08)
          break
        case 'ArrowRight':
          brainOrientation.current.y = Math.max(-0.8, brainOrientation.current.y - 0.08)
          break
        case 'ArrowUp':
          brainOrientation.current.x = Math.min(0.55, brainOrientation.current.x + 0.06)
          break
        case 'ArrowDown':
          brainOrientation.current.x = Math.max(-0.55, brainOrientation.current.x - 0.06)
          break
        case 'Home':
          brainOrientation.current.x = 0
          brainOrientation.current.y = 0
          setBrainResetKey((key) => key + 1)
          break
        default:
          return
      }
      event.preventDefault()
      return
    }
    if (view !== 'neuron') return
    const step = 0.08

    switch (event.key) {
      case 'ArrowLeft':
        orientation.current.y = Math.min(0.38, orientation.current.y + step)
        break
      case 'ArrowRight':
        orientation.current.y = Math.max(-0.38, orientation.current.y - step)
        break
      case 'ArrowUp':
        orientation.current.x = Math.min(0.26, orientation.current.x + step)
        break
      case 'ArrowDown':
        orientation.current.x = Math.max(-0.26, orientation.current.x - step)
        break
      case 'Home':
        orientation.current.x = 0
        orientation.current.y = 0
        break
      default:
        return
    }

    event.preventDefault()
  }

  return (
    <main className="experience" aria-labelledby="page-title">
      <div
        className="scene-frame"
        role="group"
        tabIndex={0}
        aria-label={view === 'brain'
          ? 'Interactive three-dimensional brain model'
          : view === 'synapse'
            ? 'Interactive three-dimensional synapse model'
            : 'Interactive three-dimensional cortical pyramidal neuron'}
        aria-describedby="scene-description"
        aria-keyshortcuts={view === 'synapse'
          ? 'Escape'
          : 'ArrowLeft ArrowRight ArrowUp ArrowDown Home Escape'}
        onKeyDown={handleSceneKeyDown}
      >
        <Canvas
          className="scene-canvas"
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, 20], fov: 38, near: 0.1, far: 80 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          aria-hidden="true"
        >
          <NeuronScene
            orientation={orientation}
            prefersReducedMotion={prefersReducedMotion}
            view={view}
            brainSelection={brainSelection}
            brainOrientation={brainOrientation}
            brainResetKey={brainResetKey}
            selected={state.selected}
            playing={runState === 'playing'}
            slowMotion={slowMotion}
            resetKey={resetKey}
            onSelect={select}
            onBrainSelect={handleBrainSelect}
            onHover={hover}
            onExploreSynapse={handleExploreSynapse}
            onSynapseProgress={handleSynapseProgress}
            onSynapseComplete={handleSynapseComplete}
            onModelLoaded={handleModelLoaded}
            onModelError={handleModelError}
          />
        </Canvas>
        <ModelStatus state={modelStatus} view={view} />
        <p className="visually-hidden" id="scene-description">
          {view === 'brain'
            ? 'A schematic brain model with selectable cerebral lobes, cerebellum, brainstem and a separate spinal cord continuation. Use the region controls to explore, arrow keys to rotate, and Home to reset the view.'
            : view === 'synapse'
              ? 'A detailed synapse cutaway shows a presynaptic terminal, synaptic vesicles, the synaptic cleft, and postsynaptic receptors. Use the signal controls to explore transmission.'
              : 'A pearl-toned cortical pyramidal neuron with an irregular cell body, branching dendrites, and a single tapered axon. Use the arrow keys to adjust its orientation or Home to reset it.'}
        </p>
      </div>

      <header className="editorial">
        <h1 id="page-title">THE INVISIBLE</h1>
        <p>An exploration of the architecture of thought.</p>
      </header>
      <ExhibitNavigation view={view} onNavigate={handleNavigate} />
      {view === 'neuron' && (
        <p className="scale-note">
          A representative neuron; the link between brain and cellular scales is educational.
        </p>
      )}
      {view === 'brain' ? (
        <BrainOverviewControls
          selection={brainSelection}
          onSelect={handleBrainSelect}
          onResetView={() => {
            brainOrientation.current.x = 0
            brainOrientation.current.y = 0
            setBrainResetKey((key) => key + 1)
          }}
        />
      ) : view === 'neuron' ? (
        <>
          <AnatomicalNavigation
            selected={state.selected}
            onSelect={select}
            overviewButtonRef={navigationRef}
          />
          <StructureInfoPanel
            structure={state.selected}
            onClose={handleClose}
          />
        </>
      ) : (
        <SynapseControls
          runState={runState}
          elapsed={elapsed}
          modelLoaded={modelStatus === 'loaded'}
          slowMotion={slowMotion}
          onBack={handleBackToNeuron}
          onSend={handleSendSignal}
          onPauseResume={handlePauseResume}
          onReset={handleResetSignal}
          onSlowMotionChange={() => setSlowMotion((current) => !current)}
        />
      )}
    </main>
  )
}

export default App
