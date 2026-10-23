import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  Box3,
  Color,
  Group,
  Mesh,
  Object3D,
  Sphere,
  Vector3,
} from 'three'
import type { Material } from 'three'
import type {
  BrainHemisphere,
  BrainRegion,
  BrainSelection,
  NeuronFocus,
} from './types'

const MODEL_URL = '/models/brain.glb'
const DISPLAY_SIZE = 7.2

type BrainOverviewProps = {
  selection: BrainSelection | null
  orientation: { current: { x: number; y: number } }
  onSelect: (selection: BrainSelection) => void
  onFocus: (focus: NeuronFocus, startDirection: Vector3) => void
  onLoaded: () => void
}

type PreparedBrain = {
  root: Group
  focus: NeuronFocus
  startDirection: Vector3
  materials: Array<{
    material: Material & { emissive?: Color; emissiveIntensity?: number }
    region: BrainRegion | null
    hemisphere: BrainHemisphere | null
    originalEmissive: Color | null
    originalIntensity: number
  }>
}

function regionMetadata(object: Object3D) {
  let current: Object3D | null = object
  while (current) {
    const { component, region, hemisphere } = current.userData
    let brainRegion: BrainRegion | null = null
    if (component === 'cerebral_lobe' && typeof region === 'string') {
      if (
        region === 'frontal' ||
        region === 'parietal' ||
        region === 'temporal' ||
        region === 'occipital'
      ) {
        brainRegion = region
      }
    } else if (component === 'cerebellar_hemisphere' || component === 'vermis') {
      brainRegion = 'cerebellum'
    } else if (component === 'spinal_cord' || region === 'spinal_cord') {
      brainRegion = 'spinalCord'
    } else if (
      component === 'brainstem' ||
      component === 'midbrain' ||
      component === 'pons' ||
      component === 'medulla'
    ) {
      brainRegion = 'brainstem'
    } else if (component === 'cerebellum') {
      brainRegion = 'cerebellum'
    }

    if (brainRegion) {
      return {
        region: brainRegion,
        hemisphere: hemisphere === 'left' || hemisphere === 'right'
          ? hemisphere
          : null,
      }
    }
    current = current.parent
  }
  return { region: null, hemisphere: null }
}

function prepareBrain(source: Object3D): PreparedBrain {
  const scene = source.clone(true)
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene, true)
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const largestDimension = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(largestDimension) || largestDimension <= 0) {
    throw new Error('The brain model does not contain visible geometry.')
  }

  const fitScale = DISPLAY_SIZE / largestDimension
  const root = new Group()
  root.name = 'BrainOverviewPresentation'
  root.scale.setScalar(fitScale)
  root.position.copy(center).multiplyScalar(-fitScale)
  root.add(scene)
  root.updateMatrixWorld(true)

  const materials: PreparedBrain['materials'] = []
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const metadata = regionMetadata(object)
    object.userData.brainRegion = metadata.region
    object.userData.brainHemisphere = metadata.hemisphere
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => {
        const copy = material.clone()
        const colorMaterial = copy as Material & {
          emissive?: Color
          emissiveIntensity?: number
        }
        materials.push({
          material: colorMaterial,
          region: metadata.region,
          hemisphere: metadata.hemisphere,
          originalEmissive: colorMaterial.emissive?.clone() ?? null,
          originalIntensity: colorMaterial.emissiveIntensity ?? 0,
        })
        return copy
      })
      : (() => {
        const copy = object.material.clone()
        const colorMaterial = copy as Material & {
          emissive?: Color
          emissiveIntensity?: number
        }
        materials.push({
          material: colorMaterial,
          region: metadata.region,
          hemisphere: metadata.hemisphere,
          originalEmissive: colorMaterial.emissive?.clone() ?? null,
          originalIntensity: colorMaterial.emissiveIntensity ?? 0,
        })
        return copy
      })()
  })

  const anchors = new Map<string, Object3D>()
  root.traverse((object) => {
    const partId = object.userData.part_id
    if (typeof partId === 'string') anchors.set(partId, object)
  })
  const targetAnchor = anchors.get('view_target')
  const anteriorAnchor = anchors.get('view_anterior')
  const leftAnchor = anchors.get('view_left')
  const target = targetAnchor?.getWorldPosition(new Vector3()) ?? new Vector3()
  const startDirection = new Vector3(0.55, 0.3, -0.78)
  if (anteriorAnchor && leftAnchor) {
    const anterior = anteriorAnchor.getWorldPosition(new Vector3())
    const left = leftAnchor.getWorldPosition(new Vector3())
    startDirection.copy(anterior.add(left).multiplyScalar(0.5).sub(target))
  }
  startDirection.normalize()
  const fittedBounds = new Box3().setFromObject(root, true)
  const fittedSphere = fittedBounds.getBoundingSphere(new Sphere())

  return {
    root,
    focus: {
      center: target,
      radius: target.distanceTo(fittedSphere.center) + fittedSphere.radius,
      width: size.x * fitScale,
      height: size.y * fitScale,
    },
    startDirection,
    materials,
  }
}

function selectionMatches(
  material: PreparedBrain['materials'][number],
  selection: BrainSelection | null,
) {
  return Boolean(
    selection &&
    material.region === selection.region &&
    (!selection.hemisphere || material.hemisphere === selection.hemisphere),
  )
}

function updateHighlights(
  materials: PreparedBrain['materials'],
  selection: BrainSelection | null,
) {
  for (const item of materials) {
    if (!item.material.emissive) continue
    const emissive = item.originalEmissive?.clone() ?? new Color('#000000')
    item.material.emissiveIntensity = item.originalIntensity
    if (selectionMatches(item, selection)) {
      emissive.lerp(new Color('#fff0c9'), 0.16)
      item.material.emissiveIntensity = 0.12
    }
    item.material.emissive = emissive
  }
}

function updateKeyboardRotation(
  root: Group,
  orientation: { x: number; y: number },
) {
  root.rotation.x = orientation.x
  root.rotation.y = orientation.y
}

export function BrainOverview({
  selection,
  orientation,
  onSelect,
  onFocus,
  onLoaded,
}: BrainOverviewProps) {
  const gltf = useGLTF(MODEL_URL)
  const prepared = useMemo(() => prepareBrain(gltf.scene), [gltf.scene])

  useFrame(() => {
    updateKeyboardRotation(prepared.root, orientation.current)
  })

  useEffect(() => {
    onFocus(prepared.focus, prepared.startDirection)
    onLoaded()
  }, [onFocus, onLoaded, prepared])

  useEffect(() => () => {
    for (const item of prepared.materials) item.material.dispose()
  }, [prepared])

  useEffect(() => updateHighlights(prepared.materials, selection), [prepared, selection])

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 5) return
    let object: Object3D | null = event.object
    while (object && object !== prepared.root) {
      const region = object.userData.brainRegion as BrainRegion | null
      if (region) {
        event.stopPropagation()
        const hemisphere = object.userData.brainHemisphere as BrainHemisphere | null
        onSelect({ region, hemisphere })
        return
      }
      object = object.parent
    }
  }

  return <primitive object={prepared.root} dispose={null} onClick={handleClick} />
}
