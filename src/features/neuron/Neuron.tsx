import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MathUtils, MeshPhysicalMaterial } from 'three'
import { createNeuronGeometry } from './geometry'

type Orientation = { x: number; y: number }

type NeuronProps = {
  orientation: { current: Orientation }
  prefersReducedMotion: boolean
}

export function Neuron({ orientation, prefersReducedMotion }: NeuronProps) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const geometry = useMemo(() => createNeuronGeometry(2026), [])
  const materials = useMemo(
    () => ({
      soma: new MeshPhysicalMaterial({
        color: '#f0e9dc',
        vertexColors: true,
        roughness: 0.46,
        metalness: 0,
        transmission: 0.045,
        thickness: 0.55,
        attenuationColor: '#e8d9c7',
        attenuationDistance: 2,
        ior: 1.28,
        sheen: 0.22,
        sheenColor: '#fff4e4',
        sheenRoughness: 0.78,
        clearcoat: 0.04,
        clearcoatRoughness: 0.72,
        transparent: true,
        opacity: 0,
      }),
      dendrite: new MeshPhysicalMaterial({
        color: '#e8e3d8',
        roughness: 0.49,
        metalness: 0,
        sheen: 0.18,
        sheenColor: '#f9f0e3',
        sheenRoughness: 0.82,
        clearcoat: 0.03,
        transparent: true,
        opacity: 0,
      }),
      hillock: new MeshPhysicalMaterial({
        color: '#d8c4a6',
        roughness: 0.48,
        metalness: 0,
        sheen: 0.2,
        sheenColor: '#f8e6cb',
        clearcoat: 0.04,
        transparent: true,
        opacity: 0,
      }),
      axon: new MeshPhysicalMaterial({
        color: '#e3cba8',
        roughness: 0.43,
        metalness: 0,
        sheen: 0.2,
        sheenColor: '#fff0d6',
        clearcoat: 0.05,
        transparent: true,
        opacity: 0,
      }),
      nucleus: new MeshPhysicalMaterial({
        color: '#b9a88f',
        roughness: 0.58,
        metalness: 0,
        sheen: 0.16,
        sheenColor: '#e8d9c3',
        transparent: true,
        opacity: 0,
      }),
    }),
    [],
  )

  useEffect(() => {
    return () => Object.values(geometry).forEach((item) => item.dispose())
  }, [geometry, materials])

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

    for (const material of Object.values(materials)) {
      const targetOpacity = material === materials.nucleus ? 0.52 : 1
      material.opacity = targetOpacity * reveal
    }
  })

  return (
    <group ref={group} dispose={null}>
      <mesh geometry={geometry.soma} material={materials.soma} />
      <mesh geometry={geometry.nucleus} material={materials.nucleus} />
      <mesh geometry={geometry.dendrites} material={materials.dendrite} />
      <mesh geometry={geometry.hillock} material={materials.hillock} />
      <mesh geometry={geometry.axon} material={materials.axon} />
    </group>
  )
}