import type { BrainRegion } from '../types'

export type BrainRegionEntry = {
  id: BrainRegion
  name: string
  shortName: string
  description: string
  hasHemisphere: boolean
}

export const BRAIN_ANATOMY: Record<BrainRegion, BrainRegionEntry> = {
  frontal: {
    id: 'frontal',
    name: 'Frontal lobe',
    shortName: 'Frontal',
    description:
      'Contributes to planning, decision-making, voluntary movement and aspects of language and social behaviour, working with networks across the brain.',
    hasHemisphere: true,
  },
  parietal: {
    id: 'parietal',
    name: 'Parietal lobe',
    shortName: 'Parietal',
    description:
      'Helps combine body-sense and other sensory information to guide attention and build awareness of the body and surrounding space.',
    hasHemisphere: true,
  },
  temporal: {
    id: 'temporal',
    name: 'Temporal lobe',
    shortName: 'Temporal',
    description:
      'Contributes to hearing, memory, emotion and aspects of language; these abilities depend on distributed, interacting brain networks.',
    hasHemisphere: true,
  },
  occipital: {
    id: 'occipital',
    name: 'Occipital lobe',
    shortName: 'Occipital',
    description:
      'Visual areas here help process information arriving from the eyes and work with other regions to interpret what we see.',
    hasHemisphere: true,
  },
  cerebellum: {
    id: 'cerebellum',
    name: 'Cerebellum',
    shortName: 'Cerebellum',
    description:
      'Helps coordinate movement, balance and timing, and also contributes to learning and other functions through wider brain networks.',
    hasHemisphere: true,
  },
  brainstem: {
    id: 'brainstem',
    name: 'Brainstem',
    shortName: 'Brainstem',
    description:
      'The midbrain, pons and medulla link the brain with the spinal cord and participate in essential automatic functions and pathways.',
    hasHemisphere: false,
  },
  spinalCord: {
    id: 'spinalCord',
    name: 'Spinal cord continuation',
    shortName: 'Spinal cord',
    description:
      'The spinal cord carries signals between the brain and body and supports reflex circuits. It is shown separately from the brainstem.',
    hasHemisphere: false,
  },
}

export const BRAIN_REGION_ORDER: BrainRegion[] = [
  'frontal',
  'parietal',
  'temporal',
  'occipital',
  'cerebellum',
  'brainstem',
  'spinalCord',
]
