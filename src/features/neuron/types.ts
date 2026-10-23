import type { Vector3 } from 'three'

export type NeuronStructure = 'soma' | 'dendrite' | 'axon'
export type ExhibitView = 'brain' | 'neuron' | 'synapse'
export type BrainRegion =
  | 'frontal'
  | 'parietal'
  | 'temporal'
  | 'occipital'
  | 'cerebellum'
  | 'brainstem'
  | 'spinalCord'
export type BrainHemisphere = 'left' | 'right'
export type BrainSelection = {
  region: BrainRegion
  hemisphere: BrainHemisphere | null
}

export type NeuronFocus = {
  center: Vector3
  radius: number
  width: number
  height: number
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
