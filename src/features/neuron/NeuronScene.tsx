import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  OrbitControls,
  PerspectiveCamera as PerspectiveCameraComponent,
} from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CosmicEnvironment } from './CosmicEnvironment'
import { BrainOverview } from './BrainOverview'
import { Neuron } from './Neuron'
import { SynapseScene } from './SynapseScene'
import type {
  BrainSelection,
  ExhibitView,
  NeuronFocus,
  NeuronFocusTargets,
  NeuronStructure,
} from './types'

type Orientation = { x: number; y: number }

type NeuronSceneProps = {
  orientation: { current: Orientation }
  prefersReducedMotion: boolean
  view: ExhibitView
  brainSelection: BrainSelection | null
  brainOrientation: { current: Orientation }
  brainResetKey: number
  selected: NeuronStructure | null
  playing: boolean
  slowMotion: boolean
  resetKey: number
  onSelect: (structure: NeuronStructure) => void
  onBrainSelect: (selection: BrainSelection) => void
  onHover: (structure: NeuronStructure | null) => void
  onExploreSynapse: () => void
  onSynapseProgress: (elapsed: number) => void
  onSynapseComplete: () => void
  onModelLoaded: () => void
  onModelError: (error: Error) => void
}

type ModelErrorBoundaryProps = {
  children: ReactNode
  onError: (error: Error) => void
}

type ModelErrorBoundaryState = {
  hasError: boolean
}

class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('Unable to load the exhibit model.', error)
    this.props.onError(error)
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

function CameraRig({
  focusTargets,
  synapseFocus,
  brainFocus,
  brainStartDirection,
  brainResetKey,
  view,
  selected,
  prefersReducedMotion,
}: {
  focusTargets: NeuronFocusTargets | null
  synapseFocus: NeuronFocus | null
  brainFocus: NeuronFocus | null
  brainStartDirection: Vector3 | null
  brainResetKey: number
  view: ExhibitView
  selected: NeuronStructure | null
  prefersReducedMotion: boolean
}) {
  const camera = useRef<PerspectiveCamera>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const orbitActive = useRef(false)
  const pointer = useRef({ x: 0, y: 0 })
  const destination = useRef({
    camera: new Vector3(0, 0, 20),
    target: new Vector3(),
    pointerTarget: new Vector3(),
    transitioning: false,
  })
  const { gl, size } = useThree()

  useEffect(() => {
    const element = gl.domElement
    const updatePointer = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      pointer.current.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointer.current.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    const resetPointer = () => {
      pointer.current.x = 0
      pointer.current.y = 0
    }

    if (!prefersReducedMotion) {
      element.addEventListener('pointermove', updatePointer)
      element.addEventListener('pointerleave', resetPointer)
    }
    return () => {
      element.removeEventListener('pointermove', updatePointer)
      element.removeEventListener('pointerleave', resetPointer)
    }
  }, [gl, prefersReducedMotion])

  useEffect(() => {
    const currentCamera = camera.current
    const currentControls = controls.current
    if (!currentCamera || !currentControls) return

    const focus = view === 'brain'
      ? brainFocus
      : view === 'synapse'
        ? synapseFocus
        : focusTargets?.[selected ?? 'overview']
    if (!focus) return
    const verticalHalfFov = (currentCamera.fov * Math.PI) / 360
    const aspect = Math.max(0.35, size.width / size.height)
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect)
    const panelClearance = view === 'synapse' && aspect < 0.7 ? 1.45 : 1
    const target = focus.center.clone()
    const cameraDirection = view === 'brain'
      ? brainStartDirection ?? new Vector3(0.55, 0.3, -0.78).normalize()
      : new Vector3(0, 0, 1)
    const distance = view === 'brain'
      ? Math.max(
        focus.height / (2 * Math.tan(verticalHalfFov) * 0.82),
        focus.width / (2 * Math.tan(horizontalHalfFov) * 0.82),
        focus.radius * 1.5,
      )
      : Math.max(
        focus.height / (2 * Math.tan(verticalHalfFov) * 0.82),
        focus.width / (2 * Math.tan(horizontalHalfFov) * 0.82),
        1.6,
      ) * panelClearance

    if (view === 'brain' && aspect < 0.7) {
      target.y -= distance * Math.tan(verticalHalfFov) * 0.16
    } else if (view === 'synapse' && aspect < 0.7) {
      target.y += distance * Math.tan(verticalHalfFov) * 0.1
    } else if (view === 'neuron' && selected && aspect > 0.85) {
      target.x -= distance * Math.tan(horizontalHalfFov) * 0.32
    } else if (view === 'neuron' && selected) {
      target.y -= distance * Math.tan(verticalHalfFov) * 0.32
    }

    destination.current.target.copy(target)
    destination.current.camera.copy(target).addScaledVector(cameraDirection, distance)
    currentCamera.updateProjectionMatrix()

    if (prefersReducedMotion) {
      currentCamera.position.copy(destination.current.camera)
      currentControls.target.copy(destination.current.target)
      currentControls.update()
      destination.current.transitioning = false
    } else {
      destination.current.transitioning = true
    }
  }, [
    brainFocus,
    brainResetKey,
    brainStartDirection,
    focusTargets,
    prefersReducedMotion,
    selected,
    size.height,
    size.width,
    synapseFocus,
    view,
  ])

  useFrame((_, delta) => {
    const currentCamera = camera.current
    const currentControls = controls.current
    if (!currentCamera || !currentControls || orbitActive.current) return

    const state = destination.current
    const easing = 1 - Math.exp(-delta * (state.transitioning ? 2.3 : 1.2))

    if (state.transitioning) {
      currentCamera.position.lerp(state.camera, easing)
      currentControls.target.lerp(state.target, easing)
      currentCamera.lookAt(currentControls.target)
      currentControls.update()

      if (
        currentCamera.position.distanceToSquared(state.camera) < 0.0004 &&
        currentControls.target.distanceToSquared(state.target) < 0.0004
      ) {
        currentCamera.position.copy(state.camera)
        currentControls.target.copy(state.target)
        currentControls.update()
        state.transitioning = false
      }
      return
    }

    if (prefersReducedMotion) return
    state.pointerTarget.set(
      state.target.x + pointer.current.x * 0.08,
      state.target.y - pointer.current.y * 0.06,
      state.target.z,
    )
    currentControls.target.lerp(state.pointerTarget, easing)
    currentControls.update()
  })

  return (
    <>
      <PerspectiveCameraComponent
        ref={camera}
        makeDefault
        fov={38}
        near={0.1}
        far={80}
        position={[0, 0, 20]}
      />
      <OrbitControls
        ref={controls}
        enableDamping={!prefersReducedMotion}
        dampingFactor={0.045}
        enablePan={false}
        enableZoom
        minDistance={view === 'brain' ? Math.max(1.5, (brainFocus?.radius ?? 3.6) * 1.8) : 2.5}
        maxDistance={view === 'brain' ? (brainFocus?.radius ?? 3.6) * 7 : 55}
        rotateSpeed={view === 'brain' ? 0.55 : 0.24}
        minAzimuthAngle={view === 'neuron' ? -0.4 : -Infinity}
        maxAzimuthAngle={view === 'neuron' ? 0.4 : Infinity}
        minPolarAngle={view === 'neuron' ? Math.PI / 2 - 0.3 : 0.05}
        maxPolarAngle={view === 'neuron' ? Math.PI / 2 + 0.3 : Math.PI - 0.05}
        onStart={() => { orbitActive.current = true }}
        onEnd={() => { orbitActive.current = false }}
      />
    </>
  )
}

export function NeuronScene({
  orientation,
  prefersReducedMotion,
  view,
  brainSelection,
  brainOrientation,
  brainResetKey,
  selected,
  playing,
  slowMotion,
  resetKey,
  onSelect,
  onBrainSelect,
  onHover,
  onExploreSynapse,
  onSynapseProgress,
  onSynapseComplete,
  onModelLoaded,
  onModelError,
}: NeuronSceneProps) {
  const [focusTargets, setFocusTargets] = useState<NeuronFocusTargets | null>(null)
  const [synapseFocus, setSynapseFocus] = useState<NeuronFocus | null>(null)
  const [brainFocus, setBrainFocus] = useState<NeuronFocus | null>(null)
  const [brainStartDirection, setBrainStartDirection] = useState<Vector3 | null>(null)
  const handleBrainFocus = useCallback((focus: NeuronFocus, direction: Vector3) => {
    setBrainFocus(focus)
    setBrainStartDirection(direction)
  }, [])

  return (
    <>
      <color attach="background" args={['#03050a']} />
      <fog attach="fog" args={['#03050a', 32, 95]} />
      <CosmicEnvironment
        prefersReducedMotion={prefersReducedMotion}
        closeUp={selected !== null}
      />
      <ambientLight intensity={0.35} color="#c5cbd2" />
      <directionalLight position={[-4, 6, 7]} intensity={1.2} color="#f0e6d5" />
      <pointLight position={[3, 1, -4]} intensity={2} distance={21} color="#b99b77" />
      <pointLight position={[-4, -2, -3]} intensity={1.5} distance={19} color="#8798aa" />
      <pointLight position={[0, 5, 2]} intensity={0.9} distance={15} color="#fff2df" />
      {view === 'brain' && (
        <>
          <directionalLight position={[-6, 8, -5]} intensity={0.8} color="#e7d9ff" />
          <pointLight position={[5, 1, 5]} intensity={1.2} distance={22} color="#9bc8ff" />
        </>
      )}

      <CameraRig
        focusTargets={focusTargets}
        synapseFocus={synapseFocus}
        brainFocus={brainFocus}
        brainStartDirection={brainStartDirection}
        brainResetKey={brainResetKey}
        view={view}
        selected={selected}
        prefersReducedMotion={prefersReducedMotion}
      />
      <ModelErrorBoundary key={view} onError={onModelError}>
        <Suspense fallback={null}>
          {view === 'brain' ? (
            <BrainOverview
              selection={brainSelection}
              orientation={brainOrientation}
              onSelect={onBrainSelect}
              onFocus={handleBrainFocus}
              onLoaded={onModelLoaded}
            />
          ) : view === 'neuron' ? (
            <Neuron
              orientation={orientation}
              prefersReducedMotion={prefersReducedMotion}
              onSelect={onSelect}
              onHover={onHover}
              onFocusTargets={setFocusTargets}
              onLoaded={onModelLoaded}
              onExploreSynapse={onExploreSynapse}
            />
          ) : (
            <SynapseScene
              playing={playing}
              slowMotion={slowMotion}
              reducedMotion={prefersReducedMotion}
              resetKey={resetKey}
              onLoaded={onModelLoaded}
              onFocus={setSynapseFocus}
              onProgress={onSynapseProgress}
              onComplete={onSynapseComplete}
            />
          )}
        </Suspense>
      </ModelErrorBoundary>
    </>
  )
}
