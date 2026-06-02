import { useOptionalDataContext } from '@/contexts/DataContext'
import { useCallback, useEffect, useState } from 'react'
import { fetchGoals, uploadGoalsCsv } from '@/lib/goalsApi'
import type { GoalRecord, GoalsDataset } from '@/types/goals'

type State = {
  dataset: GoalsDataset | null
  loading: boolean
  uploading: boolean
  error: string | null
}

function useLocalGoalsData(enabled: boolean) {
  const [state, setState] = useState<State>({
    dataset: null,
    loading: enabled,
    uploading: false,
    error: null,
  })

  const reload = useCallback(async () => {
    if (!enabled) return
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
    if (!enabled) {
      throw new Error('Goals upload is unavailable outside authenticated layout')
    }
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
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    reload()
  }, [enabled, reload])

  return {
    ...state,
    goals: state.dataset?.goals ?? [],
    reload,
    uploadCsv,
  }
}

export function useGoalsData() {
  const data = useOptionalDataContext()
  const local = useLocalGoalsData(!data)

  if (data) {
    return {
      ...data.goals,
      goals: data.goals.dataset?.goals ?? [],
      reload: data.reloadGoals,
      uploadCsv: data.uploadGoalsCsv,
    }
  }

  return local
}

export function goalsForEmployee(goals: GoalRecord[], employeeId: string) {
  const id = decodeURIComponent(employeeId)
  return goals.filter((g) => g.employee_id === id)
}
