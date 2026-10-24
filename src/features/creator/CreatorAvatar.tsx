import { Component, Suspense, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Box3, Vector3 } from 'three'

const MODEL_URL = '/models/mija_avatar.glb'

function AvatarModel({ onLoaded }: { onLoaded: () => void }) {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  const center = useMemo(() => {
    model.updateWorldMatrix(true, true)
    return new Box3().setFromObject(model).getCenter(new Vector3())
  }, [model])

  useEffect(() => {
    onLoaded()
  }, [onLoaded])

  return (
    <group>
      <primitive
        object={model}
        position={[-center.x, -center.y, -center.z]}
      />
    </group>
  )
}

type AvatarErrorBoundaryProps = {
  children: ReactNode
  onError: (error: Error) => void
}

type AvatarErrorBoundaryState = {
  hasError: boolean
}

class AvatarErrorBoundary extends Component<
  AvatarErrorBoundaryProps,
  AvatarErrorBoundaryState
> {
  state: AvatarErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AvatarErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('Unable to load the creator avatar.', error)
    this.props.onError(error)
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

type CreatorAvatarProps = {
  prefersReducedMotion: boolean
  onLoaded: () => void
  onError: (error: Error) => void
}

export function CreatorAvatar({
  prefersReducedMotion,
  onLoaded,
  onError,
}: CreatorAvatarProps) {
  return (
    <div className="creator-avatar">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 2.4], fov: 34, near: 0.1, far: 20 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        aria-hidden="true"
      >
        <ambientLight intensity={0.72} color="#f0e8dc" />
        <hemisphereLight args={['#eee4d6', '#645b57', 1.1]} />
        <directionalLight position={[-2.5, 3.5, 4]} intensity={1.35} color="#fff1dd" />
        <directionalLight position={[3, 1, -2]} intensity={0.55} color="#b8c4c9" />
        <AvatarErrorBoundary onError={onError}>
          <Suspense fallback={null}>
            <AvatarModel onLoaded={onLoaded} />
          </Suspense>
        </AvatarErrorBoundary>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping={!prefersReducedMotion}
          dampingFactor={0.08}
          rotateSpeed={0.38}
          minPolarAngle={Math.PI / 2 - 0.16}
          maxPolarAngle={Math.PI / 2 + 0.16}
        />
      </Canvas>
    </div>
  )
}
