import { Component, Suspense, useEffect, useRef, useState } from 'react'
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
import { Neuron } from './Neuron'
import type { NeuronFocusTargets, NeuronStructure } from './types'

type Orientation = { x: number; y: number }

type NeuronSceneProps = {
  orientation: { current: Orientation }
  prefersReducedMotion: boolean
  selected: NeuronStructure | null
  onSelect: (structure: NeuronStructure) => void
  onHover: (structure: NeuronStructure | null) => void
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
    console.error('Unable to load the neuron model.', error)
    this.props.onError(error)
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

function CameraRig({
  focusTargets,
  selected,
  prefersReducedMotion,
}: {
  focusTargets: NeuronFocusTargets | null
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
    if (!currentCamera || !currentControls || !focusTargets) return

    const focus = focusTargets[selected ?? 'overview']
    const verticalHalfFov = (currentCamera.fov * Math.PI) / 360
    const aspect = Math.max(0.35, size.width / size.height)
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect)
    const distance = Math.max(
      focus.height / (2 * Math.tan(verticalHalfFov) * 0.82),
      focus.width / (2 * Math.tan(horizontalHalfFov) * 0.82),
      1.6,
    )
    const target = focus.center.clone()

    if (selected && aspect > 0.85) {
      target.x -= distance * Math.tan(horizontalHalfFov) * 0.32
    } else if (selected) {
      target.y -= distance * Math.tan(verticalHalfFov) * 0.32
    }

    destination.current.target.copy(target)
    destination.current.camera.set(target.x, target.y, target.z + distance)
    currentCamera.updateProjectionMatrix()

    if (prefersReducedMotion) {
      currentCamera.position.copy(destination.current.camera)
      currentControls.target.copy(destination.current.target)
      currentControls.update()
      destination.current.transitioning = false
    } else {
      destination.current.transitioning = true
    }
  }, [focusTargets, prefersReducedMotion, selected, size.height, size.width])

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
        minDistance={2.5}
        maxDistance={55}
        rotateSpeed={0.24}
        minAzimuthAngle={-0.4}
        maxAzimuthAngle={0.4}
        minPolarAngle={Math.PI / 2 - 0.3}
        maxPolarAngle={Math.PI / 2 + 0.3}
        onStart={() => { orbitActive.current = true }}
        onEnd={() => { orbitActive.current = false }}
      />
    </>
  )
}

export function NeuronScene({
  orientation,
  prefersReducedMotion,
  selected,
  onSelect,
  onHover,
  onModelLoaded,
  onModelError,
}: NeuronSceneProps) {
  const [focusTargets, setFocusTargets] = useState<NeuronFocusTargets | null>(null)

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

      <CameraRig
        focusTargets={focusTargets}
        selected={selected}
        prefersReducedMotion={prefersReducedMotion}
      />
      <ModelErrorBoundary onError={onModelError}>
        <Suspense fallback={null}>
          <Neuron
            orientation={orientation}
            prefersReducedMotion={prefersReducedMotion}
            onSelect={onSelect}
            onHover={onHover}
            onFocusTargets={setFocusTargets}
            onLoaded={onModelLoaded}
          />
        </Suspense>
      </ModelErrorBoundary>
    </>
  )
}
