export function LoadingState({
  message = 'Loading…',
}: {
  message?: string
}) {
  return (
    <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>{message}</p>
  )
}
