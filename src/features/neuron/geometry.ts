import {
  BufferGeometry,
  Box3,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Sphere,
  SphereGeometry,
  Vector3,
} from 'three'
import morphologyData from './data/allen-pyramidal-524850271.swc?raw'
import type { NeuronFocusTargets } from './types'

type SwcNode = {
  id: number
  type: number
  position: Vector3
  radius: number
  parentId: number
  children: SwcNode[]
}

type TubePath = {
  points: Vector3[]
  radii: number[]
  color: Color
  capped: boolean
}

export type NeuronGeometry = {
  soma: BufferGeometry
  nucleus: BufferGeometry
  dendrites: BufferGeometry
  hillock: BufferGeometry
  axon: BufferGeometry
  axonHitArea: BufferGeometry
  spines: BufferGeometry
  focusTargets: NeuronFocusTargets
}

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

function parseMorphology(source: string) {
  const nodes = new Map<number, SwcNode>()

  for (const line of source.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 7) continue

    const [id, type, x, y, z, radius, parentId] = fields.map(Number)
    if (![id, type, x, y, z, radius, parentId].every(Number.isFinite)) {
      throw new Error('The neuron SWC morphology contains an invalid record.')
    }
    nodes.set(id, {
      id,
      type,
      position: new Vector3(x, y, z),
      radius,
      parentId,
      children: [],
    })
  }

  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentId)
    if (parent) parent.children.push(node)
  }

  const soma = [...nodes.values()].find((node) => node.type === 1)
  const apicalNodes = [...nodes.values()].filter((node) => node.type === 4)
  if (!soma || apicalNodes.length === 0) {
    throw new Error('The neuron SWC morphology is missing its soma or apical dendrite.')
  }

  return { nodes, soma, apicalNodes }
}

function perpendicularTo(direction: Vector3) {
  const reference = Math.abs(direction.z) > 0.84
    ? new Vector3(0, 1, 0)
    : new Vector3(0, 0, 1)
  return direction.clone().cross(reference).normalize()
}

function samplePath(path: TubePath) {
  const curve = new CatmullRomCurve3(path.points, false, 'centripetal')
  const divisions = Math.max(3, (path.points.length - 1) * 3)
  const points = curve.getPoints(divisions)
  const radii = points.map((_, index) => {
    const progress = index / divisions
    const scaledIndex = progress * (path.radii.length - 1)
    const low = Math.floor(scaledIndex)
    const high = Math.min(path.radii.length - 1, low + 1)
    const blend = scaledIndex - low
    return path.radii[low] * (1 - blend) + path.radii[high] * blend
  })

  return { points, radii }
}

function createTubeGeometry(
  paths: TubePath[],
  radialSegments: number,
  junctions: Array<{ point: Vector3; radius: number; color: Color }> = [],
) {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const appendPoint = (point: Vector3, color: Color) => {
    positions.push(point.x, point.y, point.z)
    colors.push(color.r, color.g, color.b)
  }

  for (const path of paths) {
    const { points, radii } = samplePath(path)
    const firstVertex = positions.length / 3
    let previousNormal: Vector3 | undefined

    for (let ringIndex = 0; ringIndex < points.length; ringIndex += 1) {
      const previous = points[Math.max(0, ringIndex - 1)]
      const next = points[Math.min(points.length - 1, ringIndex + 1)]
      const tangent = next.clone().sub(previous).normalize()
      const normal = previousNormal
        ? previousNormal.clone().addScaledVector(
          tangent,
          -previousNormal.dot(tangent),
        ).normalize()
        : perpendicularTo(tangent)
      if (normal.lengthSq() < 1e-6) normal.copy(perpendicularTo(tangent))
      const binormal = tangent.clone().cross(normal).normalize()
      const center = points[ringIndex]
      const radius = radii[ringIndex]

      for (let side = 0; side < radialSegments; side += 1) {
        const angle = (side / radialSegments) * Math.PI * 2
        const radial = normal.clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(binormal, Math.sin(angle))
          .normalize()
        appendPoint(center.clone().addScaledVector(radial, radius), path.color)
      }

      previousNormal = normal
    }

    for (let ringIndex = 0; ringIndex < points.length - 1; ringIndex += 1) {
      for (let side = 0; side < radialSegments; side += 1) {
        const nextSide = (side + 1) % radialSegments
        const first = firstVertex + ringIndex * radialSegments + side
        const second = firstVertex + ringIndex * radialSegments + nextSide
        const third = firstVertex + (ringIndex + 1) * radialSegments + nextSide
        const fourth = firstVertex + (ringIndex + 1) * radialSegments + side
        indices.push(first, second, fourth, second, third, fourth)
      }
    }

    if (path.capped) {
      const tipIndex = positions.length / 3
      appendPoint(points[points.length - 1], path.color)
      const lastRing = firstVertex + (points.length - 1) * radialSegments
      for (let side = 0; side < radialSegments; side += 1) {
        indices.push(
          lastRing + side,
          lastRing + ((side + 1) % radialSegments),
          tipIndex,
        )
      }
    }
  }

  for (const junction of junctions) {
    const sphere = new SphereGeometry(junction.radius, 14, 10)
    const spherePositions = sphere.attributes.position
    const sphereIndices = sphere.index
    const firstVertex = positions.length / 3

    for (let index = 0; index < spherePositions.count; index += 1) {
      appendPoint(
        new Vector3()
          .fromBufferAttribute(spherePositions, index)
          .add(junction.point),
        junction.color,
      )
    }
    if (sphereIndices) {
      for (const index of sphereIndices.array) {
        indices.push(firstVertex + index)
      }
    }
    sphere.dispose()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createSomaGeometry(seed: number, radius: number) {
  const geometry = new SphereGeometry(1, 96, 64)
  const positions = geometry.attributes.position
  const normals: number[] = []
  const colors: number[] = []
  const phase = (seed % 997) * 0.013
  const smoothstep = (value: number) => {
    const t = Math.max(0, Math.min(1, value))
    return t * t * (3 - 2 * t)
  }

  for (let index = 0; index < positions.count; index += 1) {
    const direction = new Vector3().fromBufferAttribute(positions, index).normalize()
    const angle = Math.atan2(direction.z, direction.x)
    const upperTaper = smoothstep(direction.y)
    const lowerFullness = smoothstep(-direction.y)
    const irregularity =
      Math.sin(direction.x * 3.1 + phase) * Math.cos(direction.z * 2.7 - phase) * 0.018 +
      Math.sin(direction.y * 3.8 + direction.x * 2.1) * 0.012 +
      Math.sin(direction.x * 15 + direction.y * 11 + phase) * 0.0025
    const triangularContour = 1 + Math.cos(angle * 3 + phase) * 0.04
    const width = radius * triangularContour *
      (1 - upperTaper * 0.36 + lowerFullness * 0.1 + irregularity)

    positions.setXYZ(
      index,
      direction.x * width,
      direction.y * radius * 1.32 + irregularity * radius,
      direction.z * width * 0.84,
    )
    const normal = new Vector3(
      direction.x,
      direction.y / (1.32 * 1.32),
      direction.z / (0.84 * 0.84),
    ).normalize()
    normals.push(normal.x, normal.y, normal.z)

    const tone = 0.965 + irregularity
    colors.push(tone, tone * 0.99, tone * 0.96)
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  positions.needsUpdate = true
  geometry.computeBoundingSphere()
  return geometry
}

function buildNeuronGeometry(seed: number): NeuronGeometry {
  const random = seededRandom(seed)
  const { nodes, soma, apicalNodes } = parseMorphology(morphologyData)
  const apicalTip = apicalNodes.reduce((farthest, node) =>
    node.position.distanceToSquared(soma.position) >
    farthest.position.distanceToSquared(soma.position)
      ? node
      : farthest,
  )
  const up = apicalTip.position.clone().sub(soma.position).normalize()
  const reference = Math.abs(up.z) < 0.9
    ? new Vector3(0, 0, 1)
    : new Vector3(1, 0, 0)
  const right = up.clone().cross(reference).normalize()
  const forward = right.clone().cross(up).normalize()
  const orient = (position: Vector3) => {
    const relative = position.clone().sub(soma.position)
    return new Vector3(relative.dot(right), relative.dot(up), relative.dot(forward))
  }

  const orientedDendrites = [...nodes.values()]
    .filter((node) => node.type === 3 || node.type === 4)
    .map((node) => orient(node.position))
  const lowerBound = Math.min(...orientedDendrites.map((point) => point.y), -85)
  const upperBound = Math.max(...orientedDendrites.map((point) => point.y))
  const scale = 7.8 / (upperBound - lowerBound)
  const somaRadius = Math.max(soma.radius * scale * 3, 0.26)
  const positionOf = (point: Vector3) => point.multiplyScalar(scale)
  const radiusOf = (radius: number) => Math.min(
    0.09,
    Math.max(0.008, radius * scale * 4.8),
  )
  const childrenOfType = (node: SwcNode, type: number) =>
    node.children.filter((child) => child.type === type)
  const dendritePaths: TubePath[] = []
  const spinePaths: TubePath[] = []
  const spineHeads: Array<{ point: Vector3; radius: number; color: Color }> = []
  const junctions: Array<{ point: Vector3; radius: number; color: Color }> = []
  const basalTint = new Color('#e8e1d5')
  const apicalTint = new Color('#eee7dc')
  const spinyTint = new Color('#f0e8dc')
  let spineCount = 0

  for (const start of nodes.values()) {
    if (start.type !== 3 && start.type !== 4) continue
    const parent = nodes.get(start.parentId)
    if (!parent) continue
    const parentBranches = childrenOfType(parent, start.type)
    if (parent.type !== 1 && parentBranches.length === 1) continue

    const chain: SwcNode[] = []
    let current: SwcNode | undefined = start
    while (current) {
      chain.push(current)
      const sameTypeChildren = childrenOfType(current, current.type)
      if (current.children.length !== 1 || sameTypeChildren.length !== 1) break
      current = sameTypeChildren[0]
    }

    const color = start.type === 4 ? apicalTint : basalTint
    const points = chain.map((node) => positionOf(orient(node.position)))
    const radii = chain.map((node) => radiusOf(node.radius))

    if (parent.type === 1) {
      const nextPoint = points[Math.min(2, points.length - 1)]
      const outward = nextPoint.clone().normalize()
      const somaSurface = new Vector3(
        outward.x * somaRadius,
        outward.y * somaRadius * 1.12,
        outward.z * somaRadius * 0.88,
      )
      const firstOutside = points.findIndex((point) => point.length() > somaRadius * 0.82)
      const startIndex = Math.max(0, firstOutside)
      points.splice(0, startIndex, somaSurface)
      radii.splice(0, startIndex, Math.max(radii[startIndex] ?? 0.012, somaRadius * 0.56))
    } else {
      points.unshift(positionOf(orient(parent.position)))
      radii.unshift(radiusOf(parent.radius))
    }

    if (points.length < 2) continue
    const isTerminal = chain[chain.length - 1].children.length === 0
    dendritePaths.push({ points, radii, color, capped: isTerminal })

    const terminal = chain[chain.length - 1]
    if (childrenOfType(terminal, terminal.type).length > 1) {
      junctions.push({
        point: positionOf(orient(terminal.position)),
        radius: Math.max(radiusOf(terminal.radius) * 1.08, 0.012),
        color,
      })
    }

    if (spineCount >= 460 || chain.length < 8) continue
    const stride = 9 + Math.floor(random() * 8)
    for (let index = 3; index < chain.length - 2 && spineCount < 460; index += stride) {
      const node = chain[index]
      if (node.radius > 0.48 || random() > 0.68) continue

      const pointIndex = points.findIndex((point) =>
        point.distanceToSquared(positionOf(orient(node.position))) < 1e-8,
      )
      if (pointIndex < 1) continue

      const center = points[pointIndex]
      const tangent = points[Math.min(pointIndex + 1, points.length - 1)]
        .clone()
        .sub(points[Math.max(0, pointIndex - 1)])
        .normalize()
      const normal = perpendicularTo(tangent).applyAxisAngle(
        tangent,
        random() * Math.PI * 2,
      )
      const length = scale * (1.1 + random() * 1)
      const tip = center.clone().addScaledVector(normal, length)
      tip.addScaledVector(tangent, (random() - 0.5) * length * 0.3)
      spinePaths.push({
        points: [
          center,
          center.clone().lerp(tip, 0.52).addScaledVector(tangent, length * 0.12),
          tip,
        ],
        radii: [0.0045, 0.0035, 0.002],
        color: spinyTint,
        capped: true,
      })
      spineHeads.push({
        point: tip,
        radius: 0.0045 + random() * 0.0025,
        color: spinyTint,
      })
      spineCount += 1
    }
  }

  const nucleus = new SphereGeometry(somaRadius * 0.27, 40, 28)
  nucleus.translate(0, 0, somaRadius * 0.43)
  const hillock = createTubeGeometry([{
    points: [
      new Vector3(0.025, -somaRadius * 0.62, -0.015),
      new Vector3(0.065, -somaRadius * 1.02, -0.005),
      new Vector3(0.12, -somaRadius * 1.44, 0.018),
      new Vector3(0.16, -somaRadius * 1.8, 0.025),
    ],
    radii: [
      somaRadius * 0.52,
      somaRadius * 0.43,
      somaRadius * 0.31,
      0.035,
    ],
    color: new Color('#e1cfb5'),
    capped: false,
  }], 10)
  const axonStartY = -somaRadius * 1.8
  const axonLength = scale * 85
  const axonPoints = [
    new Vector3(0.16, axonStartY, 0.025),
    new Vector3(0.2, axonStartY - axonLength * 0.24, 0.04),
    new Vector3(0.14, axonStartY - axonLength * 0.61, 0.075),
    new Vector3(0.04, axonStartY - axonLength, 0.095),
  ]
  const axon = createTubeGeometry([{
    points: axonPoints,
    radii: [0.035, 0.025, 0.017, 0.009],
    color: new Color('#dfc6a3'),
    capped: true,
  }], 8)
  const axonHitArea = createTubeGeometry([{
    points: axonPoints,
    radii: [0.12, 0.105, 0.09, 0.075],
    color: new Color('#ffffff'),
    capped: true,
  }], 8)

  const geometry = {
    soma: createSomaGeometry(seed, somaRadius),
    nucleus,
    dendrites: createTubeGeometry(dendritePaths, 12, junctions),
    hillock,
    axon,
    axonHitArea,
    spines: createTubeGeometry(spinePaths, 7, spineHeads),
  }
  const treeBottom = Math.min(...orientedDendrites.map((point) => point.y)) * scale
  const treeTop = upperBound * scale
  const axonBottom = axonStartY - axonLength
  const frameCenter = (
    Math.max(treeTop, somaRadius * 1.18) +
    Math.min(treeBottom, -somaRadius * 1.18, axonBottom)
  ) / 2

  for (const item of Object.values(geometry)) {
    item.translate(0, -frameCenter, 0)
    item.computeBoundingBox()
    item.computeBoundingSphere()
  }

  const measure = (items: BufferGeometry[]) => {
    const bounds = new Box3()
    for (const item of items) {
      if (item.boundingBox) bounds.union(item.boundingBox)
    }
    const sphere = bounds.getBoundingSphere(new Sphere())
    return { center: sphere.center, radius: sphere.radius }
  }

  const focusTargets: NeuronFocusTargets = {
    overview: measure(Object.values(geometry)),
    soma: measure([geometry.soma, geometry.nucleus]),
    dendrite: measure([geometry.dendrites, geometry.spines]),
    axon: measure([geometry.hillock, geometry.axon]),
  }

  return { ...geometry, focusTargets }
}

export function createNeuronGeometry(seed = 2026): NeuronGeometry {
  return buildNeuronGeometry(seed)
}
