import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Color, Group, MathUtils, MeshPhysicalMaterial } from 'three'
import { createNeuronGeometry } from './geometry'
import type {
  NeuronFocusTargets,
  NeuronStructure,
} from './types'

type Orientation = { x: number; y: number }

type NeuronProps = {
  orientation: { current: Orientation }
  prefersReducedMotion: boolean
  selected: NeuronStructure | null
  hovered: NeuronStructure | null
  onSelect: (structure: NeuronStructure) => void
  onHover: (structure: NeuronStructure | null) => void
  onFocusTargets: (targets: NeuronFocusTargets) => void
}

function createTissueMaterial(vertexColors = true, opacity = 1) {
  const material = new MeshPhysicalMaterial({
    color: '#ffffff',
    emissive: '#000000',
    emissiveIntensity: 0,
    vertexColors,
    roughness: 0.67,
    metalness: 0,
    transmission: 0.012,
    thickness: 0.24,
    attenuationColor: '#e9d9c4',
    attenuationDistance: 1.8,
    ior: 1.24,
    sheen: 0.1,
    sheenColor: '#f4e6d2',
    sheenRoughness: 0.92,
    clearcoat: 0,
    transparent: opacity < 1,
    opacity,
  })

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vTissuePosition;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTissuePosition = position;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vTissuePosition;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float tissueCloud = sin(vTissuePosition.x * 2.8 + sin(vTissuePosition.y * 3.4)) *
          cos(vTissuePosition.z * 3.1 - vTissuePosition.x * 1.7);
        float membraneGrain = sin(vTissuePosition.x * 47.0 + sin(vTissuePosition.y * 29.0)) *
          cos(vTissuePosition.z * 41.0 + vTissuePosition.y * 23.0);
        diffuseColor.rgb *= vec3(
          0.994 + tissueCloud * 0.012 + membraneGrain * 0.003,
          0.993 + tissueCloud * 0.009 + membraneGrain * 0.0025,
          0.99 + tissueCloud * 0.006 + membraneGrain * 0.002
        );`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(
          roughnessFactor + sin(vTissuePosition.x * 5.0 + vTissuePosition.z * 3.0) * 0.018,
          0.48,
          0.9
        );`,
      )
  }
  material.customProgramCacheKey = () => 'the-invisible-biological-tissue-v2'
  return material
}

function updateHighlight(
  material: MeshPhysicalMaterial,
  structure: NeuronStructure,
  selected: NeuronStructure | null,
  hovered: NeuronStructure | null,
  colors: {
    neutral: Color
    hover: Color
    selected: Color
    hoverGlow: Color
    selectedGlow: Color
    noGlow: Color
  },
  delta: number,
) {
  const isSelected = selected === structure
  const isHovered = hovered === structure
  const colorEase = 1 - Math.exp(-delta * 5)

  material.color.lerp(
    isSelected ? colors.selected : isHovered ? colors.hover : colors.neutral,
    colorEase,
  )
  material.emissive.lerp(
    isSelected
      ? colors.selectedGlow
      : isHovered
        ? colors.hoverGlow
        : colors.noGlow,
    colorEase,
  )
  material.emissiveIntensity = MathUtils.damp(
    material.emissiveIntensity,
    isSelected ? 0.16 : isHovered ? 0.07 : 0,
    5,
    delta,
  )
}

export function Neuron({
  orientation,
  prefersReducedMotion,
  selected,
  hovered,
  onSelect,
  onHover,
  onFocusTargets,
}: NeuronProps) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const geometry = useMemo(() => createNeuronGeometry(2026), [])
  const materials = useMemo(
    () => ({
      soma: createTissueMaterial(),
      dendrite: createTissueMaterial(),
      axon: createTissueMaterial(),
      nucleus: createTissueMaterial(false, 0.56),
      hitArea: new MeshPhysicalMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthWrite: false,
      }),
    }),
    [],
  )
  const highlightColors = useMemo(
    () => ({
      neutral: new Color('#ffffff'),
      hover: new Color('#fff1dc'),
      selected: new Color('#edd4ad'),
      noGlow: new Color('#000000'),
      hoverGlow: new Color('#291d10'),
      selectedGlow: new Color('#49351e'),
    }),
    [],
  )

  useEffect(() => {
    onFocusTargets(geometry.focusTargets)
  }, [geometry.focusTargets, onFocusTargets])

  useEffect(() => {
    return () => [
      geometry.soma,
      geometry.nucleus,
      geometry.dendrites,
      geometry.hillock,
      geometry.axon,
      geometry.axonHitArea,
      geometry.spines,
    ].forEach((item) => item.dispose())
  }, [geometry])

  useEffect(() => {
    return () => Object.values(materials).forEach((material) => material.dispose())
  }, [materials])

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

    updateHighlight(materials.soma, 'soma', selected, hovered, highlightColors, delta)
    updateHighlight(materials.nucleus, 'soma', selected, hovered, highlightColors, delta)
    updateHighlight(materials.dendrite, 'dendrite', selected, hovered, highlightColors, delta)
    updateHighlight(materials.axon, 'axon', selected, hovered, highlightColors, delta)
  })

  const handleClick = (structure: NeuronStructure) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect(structure)
  }
  const handlePointerOver = (structure: NeuronStructure) =>
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      onHover(structure)
    }
  const handlePointerLeave = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
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
    <group ref={group} dispose={null}>
      <group
        onClick={handleClick('soma')}
        onPointerOver={handlePointerOver('soma')}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <mesh geometry={geometry.soma} material={materials.soma} />
        <mesh geometry={geometry.nucleus} material={materials.nucleus} />
      </group>
      <group
        onClick={handleClick('dendrite')}
        onPointerOver={handlePointerOver('dendrite')}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <mesh geometry={geometry.dendrites} material={materials.dendrite} />
        <mesh geometry={geometry.spines} material={materials.dendrite} />
      </group>
      <group
        onClick={handleClick('axon')}
        onPointerOver={handlePointerOver('axon')}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <mesh geometry={geometry.axonHitArea} material={materials.hitArea} />
        <mesh geometry={geometry.hillock} material={materials.axon} />
        <mesh geometry={geometry.axon} material={materials.axon} />
      </group>
    </group>
  )
}