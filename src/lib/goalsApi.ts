import { apiFetch } from '@/lib/api'
import type { GoalsDataset } from '@/types/goals'

export async function fetchGoals(): Promise<GoalsDataset> {
  const res = await apiFetch('/api/goals')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Goals request failed (${res.status})`)
  }
  return res.json() as Promise<GoalsDataset>
}

export async function uploadGoalsCsv(csvText: string): Promise<GoalsDataset> {
  const res = await apiFetch('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Goals upload failed (${res.status})`)
  }
  return res.json() as Promise<GoalsDataset>
}
