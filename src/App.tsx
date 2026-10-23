import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { AnatomicalNavigation } from './features/neuron/components/AnatomicalNavigation'
import { StructureInfoPanel } from './features/neuron/components/StructureInfoPanel'
import { useNeuronSelection } from './features/neuron/hooks/useNeuronSelection'
import { NeuronScene } from './features/neuron/NeuronScene'
import './App.css'

type ModelStatusProps = {
  state: 'loading' | 'loaded' | 'error'
}

function ModelStatus({ state }: ModelStatusProps) {
  const { progress } = useProgress()
  if (state === 'loaded') return null

  const isError = state === 'error'
  const message = isError
    ? 'Neuronmodellen kunde inte laddas. Kontrollera anslutningen och ladda om sidan.'
    : progress > 0
      ? `Laddar neuronmodellen ${Math.round(progress)} %`
      : 'Laddar neuronmodellen...'

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
  const navigationRef = useRef<HTMLButtonElement>(null)
  const [modelStatus, setModelStatus] = useState<ModelStatusProps['state']>('loading')
  const { state, select, hover, close } = useNeuronSelection()

  const handleModelLoaded = useCallback(() => setModelStatus('loaded'), [])
  const handleModelError = useCallback(() => setModelStatus('error'), [])

  const handleClose = useCallback(() => {
    close()
    navigationRef.current?.focus()
  }, [close])

  useEffect(() => {
    if (!state.selected) return

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      handleClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleClose, state.selected])

  function handleSceneKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
        aria-label="Interactive three-dimensional cortical pyramidal neuron"
        aria-describedby="scene-description"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
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
            selected={state.selected}
            onSelect={select}
            onHover={hover}
            onModelLoaded={handleModelLoaded}
            onModelError={handleModelError}
          />
        </Canvas>
        <ModelStatus state={modelStatus} />
        <p className="visually-hidden" id="scene-description">
          A pearl-toned cortical pyramidal neuron with an irregular cell body, branching
          dendrites, and a single tapered axon. Use the arrow keys to adjust its
          orientation or Home to reset it.
        </p>
      </div>

      <header className="editorial">
        <h1 id="page-title">THE INVISIBLE</h1>
        <p>An exploration of the architecture of thought.</p>
      </header>
      <AnatomicalNavigation
        selected={state.selected}
        onSelect={select}
        overviewButtonRef={navigationRef}
      />
      <StructureInfoPanel
        structure={state.selected}
        onClose={handleClose}
      />
    </main>
  )
}

export default App
