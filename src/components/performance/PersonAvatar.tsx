function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
  }
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

type Props = {
  name: string
  avatarUrl?: string | null
  size?: number
}

export function PersonAvatar({ name, avatarUrl, size = 32 }: Props) {
  const initials = initialsFromName(name)
  const fontSize = Math.max(10, Math.round(size * 0.38))
  const href = avatarUrl?.trim()

  if (!href) {
    return (
      <span
        className="pd-person-avatar"
        style={{ width: size, height: size, fontSize }}
        aria-hidden
      >
        {initials}
      </span>
    )
  }

  return (
    <span className="pd-person-avatar-wrap" style={{ width: size, height: size }}>
      <img
        src={href}
        alt=""
        width={size}
        height={size}
        className="pd-person-avatar pd-person-avatar--img"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <span
        className="pd-person-avatar pd-person-avatar--fallback"
        style={{ width: size, height: size, fontSize }}
        aria-hidden
      >
        {initials}
      </span>
    </span>
  )
}
