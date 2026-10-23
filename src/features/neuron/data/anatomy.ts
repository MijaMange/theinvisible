import type { NeuronStructure } from '../types'

export type AnatomyEntry = {
  id: NeuronStructure
  name: string
  shortName: string
  summary: string
  function: string
  detail: string
}

export const ANATOMY: Record<NeuronStructure, AnatomyEntry> = {
  soma: {
    id: 'soma',
    name: 'Cell body',
    shortName: 'Soma',
    summary: 'The soma houses the nucleus and supports the cell’s ongoing metabolism.',
    function: 'It integrates synaptic signals arriving across the neuron, together with the signals’ timing and location.',
    detail: 'The soma is one part of a distributed integration process; dendrites can also actively shape incoming signals.',
  },
  dendrite: {
    id: 'dendrite',
    name: 'Dendritic arbor',
    shortName: 'Dendrites',
    summary: 'Dendrites form a branched receptive surface around the cell body.',
    function: 'They receive many synaptic inputs and convey local electrical signals toward the soma. Dendritic signaling can also be active and bidirectional.',
    detail: 'Many excitatory synapses occur on dendritic spines: small protrusions that increase the available surface area.',
  },
  axon: {
    id: 'axon',
    name: 'Axon',
    shortName: 'Axon',
    summary: 'The axon carries a neuron’s output away from the soma toward downstream targets.',
    function: 'It conducts action potentials along the cell; the initial segment near the soma is often where they begin.',
    detail: 'Axon diameter, branching, and myelination all influence how signals travel through neural circuits.',
  },
}

export const ANATOMY_ORDER: NeuronStructure[] = ['soma', 'dendrite', 'axon']
