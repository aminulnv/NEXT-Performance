/** Revolut scorecard ratings use snake_case (e.g. intermediate_plus). */
export function formatRatingLabel(value: string | null | undefined): string {
  if (value == null) return ''
  const raw = value.trim()
  if (!raw) return ''
  if (!raw.includes('_')) return capitalizeWord(raw)

  const parts = raw.toLowerCase().split('_').filter(Boolean)
  if (parts.length === 0) return raw

  const last = parts[parts.length - 1]
  if (last === 'plus' && parts.length > 1) {
    return `${formatWords(parts.slice(0, -1))} +`
  }
  if (last === 'minus' && parts.length > 1) {
    return `${formatWords(parts.slice(0, -1))} -`
  }
  return formatWords(parts)
}

export function displayRatingLabel(value: string | null | undefined): string {
  const formatted = formatRatingLabel(value)
  return formatted || '—'
}

function formatWords(parts: string[]): string {
  return parts.map(capitalizeWord).join(' ')
}

function capitalizeWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}
