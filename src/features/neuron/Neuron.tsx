import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import {
  Box3,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Vector3,
} from 'three'
import type { Material } from 'three'
import type {
  NeuronFocus,
  NeuronFocusTargets,
  NeuronStructure,
} from './types'

type Orientation = { x: number; y: number }

type NeuronProps = {
  orientation: { current: Orientation }
  prefersReducedMotion: boolean
  onSelect: (structure: NeuronStructure) => void
  onHover: (structure: NeuronStructure | null) => void
  onFocusTargets: (targets: NeuronFocusTargets) => void
  onLoaded: () => void
  onExploreSynapse: () => void
}

const MODEL_SCALE = 0.52
const MEMBRANE_GRADIENT = [
  new Color('#9b5de5'),
  new Color('#456ee8'),
  new Color('#64e5d5'),
]

function createMembraneMaterial(material: Material) {
  const gradientMaterial = material.clone()
  const gradient = MEMBRANE_GRADIENT.map((color) =>
    `vec3(${color.r.toFixed(6)}, ${color.g.toFixed(6)}, ${color.b.toFixed(6)})`,
  )

  gradientMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vNeuronPosition;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvNeuronPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vNeuronPosition;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float neuronRadius = length(vNeuronPosition);
        float violetToBlue = smoothstep(0.75, 3.2, neuronRadius);
        float blueToTurquoise = smoothstep(1.9, 4.7, neuronRadius);
        vec3 membraneGradient = mix(${gradient[0]}, ${gradient[1]}, violetToBlue);
        membraneGradient = mix(membraneGradient, ${gradient[2]}, blueToTurquoise);
        diffuseColor.rgb *= membraneGradient;`,
      )
  }
  gradientMaterial.customProgramCacheKey = () => 'nervcell-membrane-gradient-v1'
  return gradientMaterial
}

function createMyelinMaterial(material: Material) {
  const myelinMaterial = material.clone()
  if (myelinMaterial instanceof MeshPhysicalMaterial) {
    myelinMaterial.color.set('#f1e6d2')
    myelinMaterial.sheen = Math.max(myelinMaterial.sheen, 0.2)
    myelinMaterial.sheenColor.set('#fff3df')
    myelinMaterial.sheenRoughness = 0.38
    myelinMaterial.clearcoat = Math.max(myelinMaterial.clearcoat, 0.4)
  }
  return myelinMaterial
}

function prepareModelMaterials(scene: Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const component = object.userData.component
    if (component !== 'soma' && component !== 'soma_junctions' &&
      component !== 'dendrites' && component !== 'dendritic_spines' &&
      component !== 'axon') {
      if (component !== 'myelin') return
      object.material = Array.isArray(object.material)
        ? object.material.map(createMyelinMaterial)
        : createMyelinMaterial(object.material)
      return
    }

    object.material = Array.isArray(object.material)
      ? object.material.map(createMembraneMaterial)
      : createMembraneMaterial(object.material)
  })
}

function structureForComponent(component: unknown): NeuronStructure | null {
  switch (component) {
    case 'soma':
    case 'nucleus':
    case 'soma_junctions':
      return 'soma'
    case 'dendrites':
    case 'dendritic_spines':
      return 'dendrite'
    case 'axon':
    case 'axon_terminals':
    case 'myelin':
      return 'axon'
    default:
      return null
  }
}

function createFocusTargets(scene: Object3D) {
  const bounds = {
    overview: new Box3(),
    soma: new Box3(),
    dendrite: new Box3(),
    axon: new Box3(),
  }
  scene.updateMatrixWorld(true)
  const overview = new Box3().setFromObject(scene)
  bounds.overview.copy(overview)

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const structure = structureForComponent(object.userData.component)
    if (!structure) return
    bounds[structure].union(new Box3().setFromObject(object))
  })

  const center = overview.getCenter(new Vector3())
  const createFocus = (objectBounds: Box3): NeuronFocus => {
    const normalizedBounds = objectBounds.clone()
    normalizedBounds.min.sub(center).multiplyScalar(MODEL_SCALE)
    normalizedBounds.max.sub(center).multiplyScalar(MODEL_SCALE)
    const dimensions = normalizedBounds.getSize(new Vector3())
    return {
      center: normalizedBounds.getCenter(new Vector3()),
      radius: dimensions.length() / 2,
      width: dimensions.x,
      height: dimensions.y,
    }
  }
  const focusTargets: NeuronFocusTargets = {
    overview: createFocus(bounds.overview),
    soma: createFocus(bounds.soma),
    dendrite: createFocus(bounds.dendrite),
    axon: createFocus(bounds.axon),
  }

  return { center, focusTargets }
}

export function Neuron({
  orientation,
  prefersReducedMotion,
  onSelect,
  onHover,
  onFocusTargets,
  onLoaded,
  onExploreSynapse,
}: NeuronProps) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const { scene } = useGLTF('/models/nervcell.glb')
  const model = useMemo(() => {
    const clone = scene.clone(true)
    prepareModelMaterials(clone)
    return { scene: clone, ...createFocusTargets(clone) }
  }, [scene])

  useEffect(() => {
    onFocusTargets(model.focusTargets)
    onLoaded()
  }, [model.focusTargets, onFocusTargets, onLoaded])

  useFrame((_, delta) => {
    const currentGroup = group.current
    if (!currentGroup) return

    elapsed.current += delta
    const revealProgress = prefersReducedMotion
      ? 1
      : MathUtils.clamp(elapsed.current / 2.4, 0, 1)
    const reveal = 1 - Math.pow(1 - revealProgress, 3)
    const breathing = prefersReducedMotion ? 0 : Math.sin(elapsed.current * 0.52) * 0.003
    currentGroup.scale.setScalar(0.91 + reveal * (0.09 + breathing))
    if (prefersReducedMotion) {
      currentGroup.rotation.x = 0.035 + orientation.current.x
      currentGroup.rotation.y = -0.08 + orientation.current.y
    } else {
      currentGroup.rotation.x = MathUtils.damp(
        currentGroup.rotation.x,
        0.035 + orientation.current.x,
        2.2,
        delta,
      )
      currentGroup.rotation.y = MathUtils.damp(
        currentGroup.rotation.y,
        -0.08 + orientation.current.y,
        2.2,
        delta,
      )
    }
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const structure = structureForComponent(event.object.userData.component)
    if (!structure) return
    event.stopPropagation()
    onSelect(structure)
  }
  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    const structure = structureForComponent(event.object.userData.component)
    if (!structure) return
    event.stopPropagation()
    onHover(structure)
  }
  const handlePointerLeave = (event: ThreeEvent<PointerEvent>) => {
    onHover(null)
    if (event.nativeEvent.target instanceof HTMLElement) {
      event.nativeEvent.target.style.cursor = ''
    }
  }
  const handlePointerEnter = (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.target instanceof HTMLElement) {
      event.nativeEvent.target.style.cursor = 'pointer'
    }
  }

  return (
    <>
      <group ref={group} dispose={null}>
        <group
          position={model.center.clone().multiplyScalar(-MODEL_SCALE)}
          scale={MODEL_SCALE}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <primitive object={model.scene} />
        </group>
      </group>
      <Html
        position={[
          (3.55 - model.center.x) * MODEL_SCALE,
          (-9.45 - model.center.y) * MODEL_SCALE,
          (0.25 - model.center.z) * MODEL_SCALE,
        ]}
        center
        zIndexRange={[3, 3]}
      >
        <button
          className="synapse-explore"
          type="button"
          aria-label="Explore synapse"
          onClick={(event) => {
            event.stopPropagation()
            onExploreSynapse()
          }}
        >
          Explore synapse
        </button>
      </Html>
    </>
  )
}
