import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeuronScene } from './features/neuron/NeuronScene'
import './App.css'

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

  function handleSceneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
        aria-label="Interactive three-dimensional multipolar neuron"
        aria-describedby="scene-description"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home"
        onKeyDown={handleSceneKeyDown}
      >
        <Canvas
          className="scene-canvas"
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, 13], fov: 38, near: 0.1, far: 80 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          aria-hidden="true"
        >
          <NeuronScene
            orientation={orientation}
            prefersReducedMotion={prefersReducedMotion}
          />
        </Canvas>
        <p className="visually-hidden" id="scene-description">
          A pearl-toned multipolar neuron with an irregular cell body, branching
          dendrites, and a single tapered axon. Use the arrow keys to adjust its
          orientation or Home to reset it.
        </p>
      </div>

      <header className="editorial">
        <h1 id="page-title">THE INVISIBLE</h1>
        <p>An exploration of the architecture of thought.</p>
      </header>
    </main>
  )
}

export default App
