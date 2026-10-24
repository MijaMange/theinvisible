import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  ShaderMaterial,
} from 'three'

function seededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createPointGeometry(
  count: number,
  seed: number,
  bounds: { halfFov: number; aspect: number; near: number; far: number },
) {
  const random = seededRandom(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const palette = ['#8e9cad', '#b9c1c9', '#d8cfbe', '#e9e2d4'].map(
    (value) => new Color(value),
  )

  for (let index = 0; index < count; index += 1) {
    const depth = bounds.near + random() * (bounds.far - bounds.near)
    const halfHeight = depth * bounds.halfFov * 1.35
    const halfWidth = halfHeight * bounds.aspect
    positions[index * 3] = (random() * 2 - 1) * halfWidth
    positions[index * 3 + 1] = (random() * 2 - 1) * halfHeight
    positions[index * 3 + 2] = -depth
    const color = palette[Math.floor(random() * palette.length)]
    const brightness = 0.55 + random() * 0.4

    colors[index * 3] = color.r * brightness
    colors[index * 3 + 1] = color.g * brightness
    colors[index * 3 + 2] = color.b * brightness
    sizes[index] = 0.035 + random() * 0.065
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pointSize', new Float32BufferAttribute(sizes, 1))
  return geometry
}

function createPointMaterial(opacity: number, scale: number) {
  return new ShaderMaterial({
    uniforms: {
      uScale: { value: scale },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      attribute float pointSize;
      varying vec3 vColor;
      uniform float uScale;

      void main() {
        vColor = color;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(pointSize * uScale / -viewPosition.z, 0.65, 2.2);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;

      void main() {
        float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
        float softness = 1.0 - smoothstep(0.2, 0.5, distanceFromCenter);
        gl_FragColor = vec4(vColor, uOpacity * softness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  })
}

type CosmicEnvironmentProps = {
  prefersReducedMotion: boolean
  closeUp: boolean
}

export function CosmicEnvironment({
  prefersReducedMotion,
  closeUp,
}: CosmicEnvironmentProps) {
  const farLayer = useRef<Group>(null)
  const nearLayer = useRef<Group>(null)
  const elapsed = useRef(0)
  const { camera, size, gl } = useThree()
  const pointScale = size.height * gl.getPixelRatio() * camera.projectionMatrix.elements[5] * 0.5
  const halfFov = 1 / camera.projectionMatrix.elements[5]
  const aspect = size.width / size.height
  const starGeometry = useMemo(
    () => createPointGeometry(1900, 8191, { halfFov, aspect, near: 24, far: 62 }),
    [aspect, halfFov],
  )
  const dustGeometry = useMemo(
    () => createPointGeometry(300, 3127, { halfFov, aspect, near: 18, far: 42 }),
    [aspect, halfFov],
  )
  const starMaterial = useMemo(
    () => createPointMaterial(closeUp ? 0.34 : 0.62, pointScale),
    [closeUp, pointScale],
  )
  const dustMaterial = useMemo(
    () => createPointMaterial(closeUp ? 0.08 : 0.2, pointScale),
    [closeUp, pointScale],
  )

  useEffect(() => {
    return () => {
      starMaterial.dispose()
      dustMaterial.dispose()
    }
  }, [dustMaterial, starMaterial])

  useEffect(() => {
    return () => {
      starGeometry.dispose()
      dustGeometry.dispose()
    }
  }, [dustGeometry, starGeometry])

  useFrame((_, delta) => {
    const far = farLayer.current
    const near = nearLayer.current
    if (!far || !near) return

    if (!prefersReducedMotion) elapsed.current += delta

    far.position.copy(camera.position)
    far.quaternion.copy(camera.quaternion)
    near.position.copy(camera.position)
    near.quaternion.copy(camera.quaternion)

    if (!prefersReducedMotion) {
      const time = elapsed.current
      far.position.x += Math.sin(time * 0.08) * 0.3
      far.position.y += Math.cos(time * 0.06) * 0.2
      near.position.x += Math.sin(time * 0.11 + 1) * 0.55
      near.position.y += Math.cos(time * 0.09 + 1) * 0.35
      far.rotateZ(Math.sin(time * 0.025) * 0.012)
      near.rotateZ(Math.sin(time * 0.035 + 1) * 0.02)
    }
  })

  return (
    <>
      <points
        ref={farLayer}
        geometry={starGeometry}
        material={starMaterial}
        frustumCulled={false}
      />
      <points
        ref={nearLayer}
        geometry={dustGeometry}
        material={dustMaterial}
        frustumCulled={false}
      />
    </>
  )
}
