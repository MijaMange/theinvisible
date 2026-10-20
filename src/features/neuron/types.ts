import type { Vector3 } from 'three'

export type NeuronStructure = 'soma' | 'dendrite' | 'axon'

export type NeuronFocus = {
  center: Vector3
  radius: number
}

export type NeuronFocusTargets = Record<NeuronStructure | 'overview', NeuronFocus>

export type NeuronInteractionState = {
  selected: NeuronStructure | null
  hovered: NeuronStructure | null
}

export type NeuronInteractionAction =
  | { type: 'select'; structure: NeuronStructure }
  | { type: 'hover'; structure: NeuronStructure | null }
  | { type: 'close' }
