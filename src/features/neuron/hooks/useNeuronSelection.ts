import { useCallback, useReducer } from 'react'
import type {
  NeuronInteractionAction,
  NeuronInteractionState,
  NeuronStructure,
} from '../types'

export function neuronInteractionReducer(
  state: NeuronInteractionState,
  action: NeuronInteractionAction,
): NeuronInteractionState {
  switch (action.type) {
    case 'select':
      if (state.selected === action.structure) return state
      return { ...state, selected: action.structure }
    case 'hover':
      if (state.hovered === action.structure) return state
      return { ...state, hovered: action.structure }
    case 'close':
      if (!state.selected && !state.hovered) return state
      return { selected: null, hovered: null }
  }
}

export function useNeuronSelection() {
  const [state, dispatch] = useReducer(neuronInteractionReducer, {
    selected: null,
    hovered: null,
  })

  const select = useCallback((structure: NeuronStructure) => {
    dispatch({ type: 'select', structure })
  }, [])
  const hover = useCallback((structure: NeuronStructure | null) => {
    dispatch({ type: 'hover', structure })
  }, [])
  const close = useCallback(() => {
    dispatch({ type: 'close' })
  }, [])

  return { state, select, hover, close }
}
