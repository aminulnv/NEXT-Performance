import { useCallback, useEffect, useState } from 'react'
import { fetchGoals, uploadGoalsCsv } from '@/lib/goalsApi'
import type { GoalRecord, GoalsDataset } from '@/types/goals'

type State = {
  dataset: GoalsDataset | null
  loading: boolean
  uploading: boolean
  error: string | null
}

export function useGoalsData() {
  const [state, setState] = useState<State>({
    dataset: null,
    loading: true,
    uploading: false,
    error: null,
  })

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const dataset = await fetchGoals()
      setState({ dataset, loading: false, uploading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load goals'
      setState((s) => ({ ...s, loading: false, error: message }))
    }
  }, [])

  const uploadCsv = useCallback(async (csvText: string) => {
    setState((s) => ({ ...s, uploading: true, error: null }))
    try {
      const dataset = await uploadGoalsCsv(csvText)
      setState({ dataset, loading: false, uploading: false, error: null })
      return dataset
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload goals CSV'
      setState((s) => ({ ...s, uploading: false, error: message }))
      throw err
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    ...state,
    goals: state.dataset?.goals ?? [],
    reload,
    uploadCsv,
  }
}

export function goalsForEmployee(goals: GoalRecord[], employeeId: string) {
  const id = decodeURIComponent(employeeId)
  return goals.filter((g) => g.employee_id === id)
}
