import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { Material } from 'three'
import type { NeuronFocus } from './types'

const MODEL_URL = '/models/synaps.glb'
const MODEL_SCALE = 0.82
const TIMELINE_DURATION = 12
const CALCIUM_COUNT = 5
const GLUTAMATE_COUNT = 16
const RESPONSE_COUNT = 8
const RECEPTOR_TARGETS = [
  new Vector3(-0.72, -0.11, -0.18),
  new Vector3(-0.38, -0.11, -0.18),
  new Vector3(0, -0.11, -0.16),
  new Vector3(0.36, -0.11, -0.18),
  new Vector3(0.71, -0.11, -0.19),
]

type SynapseSceneProps = {
  playing: boolean
  slowMotion: boolean
  reducedMotion: boolean
  resetKey: number
  onLoaded: () => void
  onFocus: (focus: NeuronFocus) => void
  onProgress: (elapsed: number) => void
  onComplete: () => void
}

type AnimatedPart = {
  object: Object3D
  materials: Array<{
    material: MeshPhysicalMaterial
    emissive: Color
    intensity: number
  }>
}

type PreparedModel = {
  scene: Object3D
  center: Vector3
  focus: NeuronFocus
  calciumChannels: AnimatedPart[]
  receptors: AnimatedPart[]
  dockedVesicle: Object3D
  materials: Material[]
}

const particleTransform = new Object3D()

function partMaterials(object: Object3D): AnimatedPart['materials'] {
  const materials: AnimatedPart['materials'] = []
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    for (const material of Array.isArray(child.material)
      ? child.material
      : [child.material]) {
      if (!(material instanceof MeshPhysicalMaterial)) continue
      materials.push({
        material,
        emissive: material.emissive.clone(),
        intensity: material.emissiveIntensity,
      })
    }
  })
  return materials
}

function prepareModel(scene: Object3D): PreparedModel {
  const clone = scene.clone(true)
  const materials: Material[] = []
  const calciumChannels: AnimatedPart[] = []
  const receptors: AnimatedPart[] = []
  let dockedVesicle: Object3D | undefined
  clone.traverse((object) => {
    if (object instanceof Mesh) {
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => {
          const copy = material.clone()
          materials.push(copy)
          return copy
        })
        : (() => {
          const copy = object.material.clone()
          materials.push(copy)
          return copy
        })()
    }

    const component = object.userData.component
    if (component === 'calcium_channel') {
      calciumChannels.push({ object, materials: partMaterials(object) })
    }
    if (component === 'ampa_receptor') {
      receptors.push({ object, materials: partMaterials(object) })
    }
    if (
      component === 'synaptic_vesicle' &&
      object.userData.part_id === 'vesicle_docked_002'
    ) {
      dockedVesicle = object
    }
  })

  if (!dockedVesicle) {
    materials.forEach((material) => material.dispose())
    throw new Error('The synapse model is missing the vesicle_docked_002 animation anchor.')
  }

  clone.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(clone)
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3()).multiplyScalar(MODEL_SCALE)
  const focus: NeuronFocus = {
    center: new Vector3(),
    radius: size.length() / 2,
    width: size.x,
    height: size.y,
  }
  return { scene: clone, center, focus, calciumChannels, receptors, dockedVesicle, materials }
}

function smoothstep(start: number, end: number, value: number) {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return amount * amount * (3 - 2 * amount)
}

function setEmissive(parts: AnimatedPart[], intensity: number, color: Color) {
  for (const part of parts) {
    for (const entry of part.materials) {
      entry.material.emissive.copy(intensity > 0 ? color : entry.emissive)
      entry.material.emissiveIntensity = intensity > 0 ? intensity : entry.intensity
    }
  }
}

function updateParticles(
  mesh: InstancedMesh | null,
  count: number,
  elapsed: number,
  stageStart: number,
  stageEnd: number,
  reducedMotion: boolean,
  positionAt: (index: number, progress: number) => Vector3,
  persistAtEnd = false,
) {
  if (!mesh) return

  for (let index = 0; index < count; index += 1) {
    const stagger = index / count * (stageEnd - stageStart) * 0.46
    const particleStart = stageStart + stagger
    const progress = smoothstep(
      particleStart,
      Math.min(stageEnd, particleStart + 0.9),
      elapsed,
    )
    const visible = elapsed >= particleStart &&
      (persistAtEnd || elapsed <= stageEnd + 0.3)
    particleTransform.position.copy(
      positionAt(index, reducedMotion && visible ? 1 : progress),
    )
    particleTransform.scale.setScalar(visible ? 1 : 0)
    particleTransform.updateMatrix()
    mesh.setMatrixAt(index, particleTransform.matrix)
  }

  mesh.instanceMatrix.needsUpdate = true
}

export function SynapseScene({
  playing,
  slowMotion,
  reducedMotion,
  resetKey,
  onLoaded,
  onFocus,
  onProgress,
  onComplete,
}: SynapseSceneProps) {
  const group = useRef<Group>(null)
  const calciumParticles = useRef<InstancedMesh>(null)
  const glutamateParticles = useRef<InstancedMesh>(null)
  const responseParticles = useRef<InstancedMesh>(null)
  const pulse = useRef<Mesh>(null)
  const fusionPore = useRef<Mesh>(null)
  const fusionMaterial = useRef<MeshPhysicalMaterial>(null)
  const responseHalo = useRef<Mesh>(null)
  const responseMaterial = useRef<MeshPhysicalMaterial>(null)
  const elapsed = useRef(0)
  const lastProgressUpdate = useRef(0)
  const completeCalled = useRef(false)
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => prepareModel(scene), [scene])
  const particleGeometry = useMemo(() => new SphereGeometry(0.035, 10, 8), [])
  const pulseGeometry = useMemo(() => new SphereGeometry(0.12, 16, 12), [])
  const fusionGeometry = useMemo(() => new TorusGeometry(0.12, 0.035, 10, 28), [])
  const responseGeometry = useMemo(() => new TorusGeometry(0.48, 0.018, 8, 40), [])
  const calciumColor = useMemo(() => new Color('#74c9ff'), [])
  const glutamateColor = useMemo(() => new Color('#ffd071'), [])
  const responseColor = useMemo(() => new Color('#68e5d7'), [])
  const pulseMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#a6c9ff', toneMapped: false }),
    [],
  )
  const calciumMaterial = useMemo(
    () => new MeshBasicMaterial({ color: calciumColor, toneMapped: false }),
    [calciumColor],
  )
  const glutamateMaterial = useMemo(
    () => new MeshBasicMaterial({ color: glutamateColor, toneMapped: false }),
    [glutamateColor],
  )
  const responseParticleMaterial = useMemo(
    () => new MeshBasicMaterial({ color: responseColor, toneMapped: false }),
    [responseColor],
  )
  const fusionPoreMaterial = useMemo(
    () => new MeshPhysicalMaterial({
      color: '#f5d0ff',
      emissive: '#c781ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 0.3,
    }),
    [],
  )
  const responseHaloMaterial = useMemo(
    () => new MeshPhysicalMaterial({
      color: '#72e8d8',
      emissive: '#44cabb',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: 0.8,
    }),
    [],
  )

  useEffect(() => {
    onFocus(model.focus)
    onLoaded()
  }, [model.focus, onFocus, onLoaded])

  useEffect(() => () => {
    model.materials.forEach((material) => material.dispose())
    for (const geometry of [
      particleGeometry,
      pulseGeometry,
      fusionGeometry,
      responseGeometry,
    ]) geometry.dispose()
    for (const material of [
      pulseMaterial,
      calciumMaterial,
      glutamateMaterial,
      responseParticleMaterial,
      fusionPoreMaterial,
      responseHaloMaterial,
    ]) material.dispose()
  }, [
    calciumMaterial,
    fusionGeometry,
    fusionPoreMaterial,
    glutamateMaterial,
    model.materials,
    particleGeometry,
    pulseGeometry,
    pulseMaterial,
    responseGeometry,
    responseHaloMaterial,
    responseParticleMaterial,
  ])

  useEffect(() => {
    elapsed.current = 0
    completeCalled.current = false
    lastProgressUpdate.current = 0
    onProgress(0)
  }, [onProgress, resetKey])

  useFrame((_, delta) => {
    if (playing && !completeCalled.current) {
      const speed = slowMotion ? 0.48 : 1
      elapsed.current = Math.min(
        TIMELINE_DURATION,
        elapsed.current + Math.min(delta, 0.1) * speed,
      )
      if (elapsed.current >= TIMELINE_DURATION) {
        completeCalled.current = true
        onComplete()
        onProgress(TIMELINE_DURATION)
      }
      if (elapsed.current - lastProgressUpdate.current >= 0.08) {
        lastProgressUpdate.current = elapsed.current
        onProgress(elapsed.current)
      }
    }

    const time = elapsed.current
    const pulseProgress = smoothstep(0, 1.6, time)
    const calciumProgress = smoothstep(1.6, 3.2, time)
    const calciumActivation = calciumProgress * (1 - smoothstep(3.25, 3.85, time))
    const fusionProgress = smoothstep(3.2, 4.8, time)
    const receptorProgress = smoothstep(7.8, 9.8, time)
    const responseProgress = smoothstep(9.8, 11.2, time)

    if (pulse.current) {
      pulse.current.position.set(
        0.28,
        2.65 - pulseProgress * 2.28,
        0.24,
      )
      pulse.current.scale.setScalar(
        time > 0 && time <= 1.65
          ? 1 + (reducedMotion ? 0 : Math.sin(time * 18) * 0.18)
          : 0,
      )
    }

    setEmissive(model.calciumChannels, calciumActivation * 1.5, calciumColor)
    setEmissive(model.receptors, receptorProgress * 0.95, responseColor)

    if (fusionPore.current && fusionMaterial.current) {
      const poreOpen = fusionProgress * (1 - smoothstep(7.8, 8.7, time))
      fusionPore.current.scale.setScalar(0.2 + poreOpen * 1.9)
      fusionMaterial.current.opacity = poreOpen * 0.95
      fusionMaterial.current.emissiveIntensity = poreOpen * 1.6
    }

    if (responseHalo.current && responseMaterial.current) {
      const responsePulse = reducedMotion ? 0 : Math.sin(time * 7) * 0.08
      responseHalo.current.scale.setScalar(0.35 + responseProgress * (0.65 + responsePulse))
      responseMaterial.current.opacity = responseProgress * 0.24
      responseMaterial.current.emissiveIntensity = responseProgress * 0.8
    }

    updateParticles(
      calciumParticles.current,
      CALCIUM_COUNT,
      time,
      1.6,
      3.2,
      reducedMotion,
      (index, progress) => new Vector3(
        [-0.82, -0.48, 0.14, 0.52, 0.77][index],
        -0.2 + progress * 0.9,
        [-0.23, -0.42, -0.68, -0.26, -0.42][index] + 0.12,
      ),
    )
    updateParticles(
      glutamateParticles.current,
      GLUTAMATE_COUNT,
      time,
      4.8,
      7.8,
      reducedMotion,
      (index, progress) => {
        const target = RECEPTOR_TARGETS[index % RECEPTOR_TARGETS.length]
        const spread = (Math.floor(index / RECEPTOR_TARGETS.length) - 1) * 0.12
        return new Vector3(
          -0.05 + (target.x + spread + 0.05) * progress,
          0.38 + (-0.52) * progress + Math.sin(progress * Math.PI) * (index % 2 ? 0.08 : -0.08),
          0.08 + (target.z + 0.18) * progress,
        )
      },
      true,
    )
    updateParticles(
      responseParticles.current,
      RESPONSE_COUNT,
      time,
      8.5,
      10.7,
      reducedMotion,
      (index, progress) => {
        const target = RECEPTOR_TARGETS[index % RECEPTOR_TARGETS.length]
        return new Vector3(
          target.x + Math.sin(index * 2.1) * 0.06,
          -0.12 - progress * 0.52,
          target.z + 0.04,
        )
      },
      true,
    )
  })

  return (
    <group ref={group} dispose={null}>
      <group
        position={model.center.clone().multiplyScalar(-MODEL_SCALE)}
        scale={MODEL_SCALE}
      >
        <primitive object={model.scene} />

        <mesh ref={pulse} geometry={pulseGeometry} material={pulseMaterial} />

        <mesh
          ref={fusionPore}
          position={[-0.05, 0.19, 0.08]}
          rotation={[0, 0, 0]}
          geometry={fusionGeometry}
        >
          <primitive
            object={fusionPoreMaterial}
            attach="material"
            ref={fusionMaterial}
          />
        </mesh>

        <mesh
          ref={responseHalo}
          position={[0, -0.55, 0.06]}
          geometry={responseGeometry}
        >
          <primitive
            object={responseHaloMaterial}
            attach="material"
            ref={responseMaterial}
          />
        </mesh>

        <instancedMesh
          ref={calciumParticles}
          args={[particleGeometry, calciumMaterial, CALCIUM_COUNT]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={glutamateParticles}
          args={[particleGeometry, glutamateMaterial, GLUTAMATE_COUNT]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={responseParticles}
          args={[particleGeometry, responseParticleMaterial, RESPONSE_COUNT]}
          frustumCulled={false}
        />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
