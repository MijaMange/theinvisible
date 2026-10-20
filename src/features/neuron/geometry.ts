import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  SphereGeometry,
  Vector3,
} from 'three'

type TubePath = {
  points: Vector3[]
  radii: number[]
  capped: boolean
}

export type NeuronGeometry = {
  soma: BufferGeometry
  nucleus: BufferGeometry
  dendrites: BufferGeometry
  hillock: BufferGeometry
  axon: BufferGeometry
}

const ROOT_DIRECTIONS = [
  [-0.96, 0.25, -0.18],
  [-0.88, -0.48, 0.22],
  [-0.62, 0.73, 0.28],
  [-0.36, -0.89, -0.3],
  [-0.12, 0.95, -0.26],
  [0.16, -0.98, 0.12],
  [0.53, 0.78, 0.31],
  [0.72, -0.64, -0.25],
  [0.96, 0.32, -0.12],
  [0.91, -0.2, 0.34],
  [-0.94, -0.12, -0.35],
  [0.28, 0.87, -0.39],
] as const

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

function perpendicularTo(direction: Vector3) {
  const reference = Math.abs(direction.z) > 0.84
    ? new Vector3(0, 1, 0)
    : new Vector3(0, 0, 1)
  return direction.clone().cross(reference).normalize()
}

function createCurvedPoints(
  start: Vector3,
  direction: Vector3,
  length: number,
  random: () => number,
) {
  const primaryBend = perpendicularTo(direction)
  const secondaryBend = direction.clone().cross(primaryBend).normalize()
  const bendAmount = length * (0.08 + random() * 0.1)
  const secondaryAmount = length * (random() - 0.5) * 0.12
  const anchors = [
    start.clone(),
    start.clone()
      .addScaledVector(direction, length * 0.32)
      .addScaledVector(primaryBend, bendAmount * (random() - 0.25))
      .addScaledVector(secondaryBend, secondaryAmount),
    start.clone()
      .addScaledVector(direction, length * 0.69)
      .addScaledVector(primaryBend, bendAmount * (random() + 0.2))
      .addScaledVector(secondaryBend, -secondaryAmount * 0.6),
    start.clone()
      .addScaledVector(direction, length)
      .addScaledVector(primaryBend, bendAmount * (random() - 0.7))
      .addScaledVector(secondaryBend, secondaryAmount * 0.5),
  ]

  return new CatmullRomCurve3(anchors).getPoints(12)
}

function growBranch(
  start: Vector3,
  direction: Vector3,
  length: number,
  radius: number,
  depth: number,
  paths: TubePath[],
  random: () => number,
) {
  const normalizedDirection = direction.clone().normalize()
  const points = createCurvedPoints(start, normalizedDirection, length, random)
  const splitIndex = depth > 0
    ? Math.floor(points.length * (0.61 + random() * 0.12))
    : points.length - 1
  const segmentPoints = points.slice(0, splitIndex + 1)
  const segmentRadii = segmentPoints.map((_, index) => {
    const progress = index / Math.max(1, segmentPoints.length - 1)
    return radius * (1 - progress * 0.25)
  })

  paths.push({ points: segmentPoints, radii: segmentRadii, capped: depth === 0 })

  if (depth === 0) return

  const junction = segmentPoints[segmentPoints.length - 1]
  const incoming = points[splitIndex + 1]
    .clone()
    .sub(points[splitIndex - 1])
    .normalize()
  const branchingAxis = perpendicularTo(incoming)
  const spread = 0.42 + random() * 0.31
  const childLength = length * (0.55 + random() * 0.18)
  const childRadius = segmentRadii[segmentRadii.length - 1] * 0.9

  for (const side of [-1, 1]) {
    const childDirection = incoming
      .clone()
      .applyAxisAngle(branchingAxis, side * spread)
      .addScaledVector(new Vector3(0, 0, 1), (random() - 0.5) * 0.18)
      .normalize()

    growBranch(
      junction,
      childDirection,
      childLength * (0.88 + random() * 0.24),
      childRadius,
      depth - 1,
      paths,
      random,
    )
  }
}

function createTubeGeometry(paths: TubePath[], radialSegments: number) {
  const positions: number[] = []
  const indices: number[] = []

  for (const path of paths) {
    const firstVertex = positions.length / 3
    const ringCount = path.points.length

    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const previous = path.points[Math.max(0, ringIndex - 1)]
      const next = path.points[Math.min(ringCount - 1, ringIndex + 1)]
      const tangent = next.clone().sub(previous).normalize()
      const normal = perpendicularTo(tangent)
      const binormal = tangent.clone().cross(normal).normalize()
      const center = path.points[ringIndex]
      const radius = path.radii[ringIndex]

      for (let side = 0; side < radialSegments; side += 1) {
        const angle = (side / radialSegments) * Math.PI * 2
        const radial = normal
          .clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(binormal, Math.sin(angle))
          .normalize()
        const vertex = center.clone().addScaledVector(radial, radius)

        positions.push(vertex.x, vertex.y, vertex.z)
      }
    }

    for (let ringIndex = 0; ringIndex < ringCount - 1; ringIndex += 1) {
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
      const tip = path.points[ringCount - 1]
      positions.push(tip.x, tip.y, tip.z)

      const lastRing = firstVertex + (ringCount - 1) * radialSegments
      for (let side = 0; side < radialSegments; side += 1) {
        indices.push(lastRing + side, lastRing + ((side + 1) % radialSegments), tipIndex)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createOrganicSoma(seed: number) {
  const geometry = new SphereGeometry(0.5, 56, 40)
  const positions = geometry.attributes.position
  const colors: number[] = []
  const phase = (seed % 997) * 0.013

  for (let index = 0; index < positions.count; index += 1) {
    const direction = new Vector3().fromBufferAttribute(positions, index).normalize()
    const variation =
      Math.sin(direction.x * 3.1 + phase) * Math.cos(direction.y * 2.8 - phase) * 0.035 +
      Math.sin(direction.z * 3.7 + direction.x * 2.2 + phase) * 0.022 +
      direction.y * 0.025 +
      direction.x * direction.z * 0.018
    const radialScale = 1 + variation
    const surfaceTone = 0.97 + variation * 0.6

    positions.setXYZ(
      index,
      direction.x * radialScale * 0.57,
      direction.y * radialScale * 0.49,
      direction.z * radialScale * 0.52,
    )
    colors.push(surfaceTone, surfaceTone * 0.99, surfaceTone * 0.96)
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createSmoothPath(
  anchors: Vector3[],
  segmentCount: number,
  startRadius: number,
  endRadius: number,
): TubePath {
  const points: Vector3[] = []

  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount
    const scaledIndex = progress * (anchors.length - 1)
    const anchorIndex = Math.min(anchors.length - 2, Math.floor(scaledIndex))
    const localProgress = scaledIndex - anchorIndex
    const before = anchors[Math.max(0, anchorIndex - 1)]
    const current = anchors[anchorIndex]
    const next = anchors[anchorIndex + 1]
    const after = anchors[Math.min(anchors.length - 1, anchorIndex + 2)]
    const progressSquared = localProgress * localProgress
    const progressCubed = progressSquared * localProgress
    const point = new Vector3()

    for (const axis of ['x', 'y', 'z'] as const) {
      point[axis] = 0.5 * (
        2 * current[axis] +
        (-before[axis] + next[axis]) * localProgress +
        (2 * before[axis] - 5 * current[axis] + 4 * next[axis] - after[axis]) * progressSquared +
        (-before[axis] + 3 * current[axis] - 3 * next[axis] + after[axis]) * progressCubed
      )
    }

    points.push(point)
  }

  const radii = points.map((_, index) => {
    const progress = index / (points.length - 1)
    return startRadius * (1 - progress) + endRadius * progress
  })

  return { points, radii, capped: true }
}

export function createNeuronGeometry(seed = 2026): NeuronGeometry {
  const random = seededRandom(seed)
  const dendritePaths: TubePath[] = []

  ROOT_DIRECTIONS.forEach((coordinates, index) => {
    const direction = new Vector3(...coordinates)
      .add(new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.22))
      .normalize()
    const origin = direction.clone().multiplyScalar(0.46)
    const rootLength = 1.7 + random() * 1.15

    growBranch(
      origin,
      direction,
      rootLength,
      0.098 + random() * 0.024,
      index % 3 === 0 ? 4 : 3,
      dendritePaths,
      random,
    )
  })

  const hillockPath: TubePath = {
    points: [
      new Vector3(0.36, -0.25, 0.08),
      new Vector3(0.48, -0.37, 0.07),
      new Vector3(0.61, -0.49, 0.045),
      new Vector3(0.75, -0.59, 0.02),
    ],
    radii: [0.15, 0.135, 0.103, 0.068],
    capped: false,
  }
  const axonPath = createSmoothPath(
    [
      new Vector3(0.71, -0.57, 0.02),
      new Vector3(0.93, -0.98, 0.03),
      new Vector3(1.06, -1.55, -0.02),
      new Vector3(1.47, -2.2, -0.06),
      new Vector3(1.83, -3.08, 0.02),
      new Vector3(2.18, -4.15, 0.14),
    ],
    48,
    0.062,
    0.017,
  )

  const nucleus = new SphereGeometry(0.19, 32, 24)
  nucleus.translate(-0.06, 0.025, 0.34)

  return {
    soma: createOrganicSoma(seed),
    nucleus,
    dendrites: createTubeGeometry(dendritePaths, 8),
    hillock: createTubeGeometry([hillockPath], 12),
    axon: createTubeGeometry([axonPath], 10),
  }
}