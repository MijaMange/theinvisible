import { useEffect, useRef } from 'react'
import { OrbitControls, PerspectiveCamera as PerspectiveCameraComponent } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { CosmicEnvironment } from './CosmicEnvironment'
import { Neuron } from './Neuron'

type Orientation = { x: number; y: number }

type NeuronSceneProps = {
  orientation: { current: Orientation }
  prefersReducedMotion: boolean
}

function CameraRig({
  active,
  prefersReducedMotion,
}: {
  active: { current: boolean }
  prefersReducedMotion: boolean
}) {
  const camera = useRef<PerspectiveCamera>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const { gl, size } = useThree()

  useEffect(() => {
    const currentCamera = camera.current
    if (!currentCamera) return

    const halfFov = (currentCamera.fov * Math.PI) / 360
    const verticalDistance = 12.2 / (2 * Math.tan(halfFov))
    const aspect = Math.max(0.35, size.width / size.height)
    const horizontalBounds = aspect < 0.85 ? 10.5 : 12.2
    const horizontalDistance = horizontalBounds / (2 * Math.tan(halfFov) * aspect)

    currentCamera.position.set(
      0,
      0,
      Math.max(verticalDistance, horizontalDistance) * 1.04,
    )
    currentCamera.lookAt(0, 0, 0)
    currentCamera.updateProjectionMatrix()
  }, [size.height, size.width])

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

  useFrame((_, delta) => {
    const currentCamera = camera.current
    if (!currentCamera || active.current || prefersReducedMotion) return

    const easing = 1 - Math.exp(-delta * 1.15)
    currentCamera.position.x += (pointer.current.x * 0.16 - currentCamera.position.x) * easing
    currentCamera.position.y += (-pointer.current.y * 0.11 - currentCamera.position.y) * easing
    currentCamera.lookAt(0, 0, 0)
  })

  return (
    <PerspectiveCameraComponent
      ref={camera}
      makeDefault
      fov={38}
      near={0.1}
      far={80}
      position={[0, 0, 13]}
    />
  )
}

export function NeuronScene({ orientation, prefersReducedMotion }: NeuronSceneProps) {
  const orbitActive = useRef(false)

  return (
    <>
      <color attach="background" args={['#03050a']} />
      <fog attach="fog" args={['#03050a', 32, 95]} />
      <CosmicEnvironment prefersReducedMotion={prefersReducedMotion} />
      <ambientLight intensity={0.48} color="#c7cbd1" />
      <directionalLight position={[-4, 6, 7]} intensity={2.4} color="#f4eee3" />
      <pointLight position={[3, 1, -4]} intensity={16} distance={21} color="#b99b77" />
      <pointLight position={[-4, -2, -3]} intensity={13} distance={19} color="#8798aa" />
      <pointLight position={[0, 5, 2]} intensity={7} distance={15} color="#fff2df" />

      <CameraRig
        active={orbitActive}
        prefersReducedMotion={prefersReducedMotion}
      />
      <Neuron
        orientation={orientation}
        prefersReducedMotion={prefersReducedMotion}
      />
      <OrbitControls
        enableDamping={!prefersReducedMotion}
        dampingFactor={0.045}
        enablePan={false}
        enableZoom={false}
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