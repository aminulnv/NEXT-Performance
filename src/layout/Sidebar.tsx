import { useState, useCallback, type MouseEvent, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, X, Search } from 'lucide-react'
import type { NavItem, BrandConfig } from './types'
import { ConfirmModal } from '@/components/ConfirmModal'
import { assets } from '@/config/assets'
import { navTourId } from '@/lib/navTourId'

const NAV_ICON_SIZE = 15
const NAV_ICON_STROKE = 1.75
const SIDEBAR_WIDTH_COLLAPSED = '4rem'
const SIDEBAR_WIDTH_EXPANDED = '15.5rem'
const SIDEBAR_WIDTH_MOBILE = '15.5rem'

interface SidebarProps {
  navItems: NavItem[]
  brand: BrandConfig
  bottomNavItem?: NavItem
  bottomContent?: ReactNode
  /** Profile block at bottom: label (e.g. name), optional subtext (e.g. email) */
  profileLabel?: string
  profileSubtext?: string
  onProfileClick?: () => void
  onSignOut?: () => void
  isCollapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar(props: SidebarProps) {
  const {
    navItems,
    brand,
    bottomNavItem,
    bottomContent,
    profileLabel,
    profileSubtext,
    onProfileClick,
    onSignOut,
    isCollapsed,
    onToggle: _onToggle,
    isMobile = false,
    isMobileOpen = false,
    onMobileClose,
  } = props
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const query = searchQuery.trim().toLowerCase()
  const filteredNavItems = query
    ? navItems.filter((item) => {
        if (item.label.toLowerCase().includes(query)) return true
        return item.children?.some((c) => c.label.toLowerCase().includes(query)) ?? false
      })
    : navItems
  const collapsed = isMobile ? false : isCollapsed
  const displayCollapsed = isMobile ? false : (collapsed && !isHovered && !isPinned)
  const { name, subtitle, icon: BrandIcon, logoColor = '#2CA85A', logoUrl } = brand

  const iconCell = useCallback(
    (isActive: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: displayCollapsed ? 'center' : 'flex-start',
      gap: displayCollapsed ? 0 : '0.625rem',
      padding: '0.5rem 0.625rem',
      borderRadius: '0.5rem',
      textDecoration: 'none',
      fontSize: '0.8125rem',
      fontWeight: isActive ? 600 : 400,
      color: isActive ? assets.themePrimaryContrast : 'rgba(255,255,255,0.55)',
      background: isActive ? assets.themePrimary : 'transparent',
      transition: 'background 0.12s, color 0.12s',
      overflow: 'hidden',
      whiteSpace: 'nowrap' as const,
    }),
    [displayCollapsed]
  )

  const isNavLinkActive = (el: HTMLElement) => el.getAttribute('aria-current') === 'page'

  const handleNavLinkMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget
    if (!isNavLinkActive(el)) {
      el.style.background = 'rgba(255,255,255,0.07)'
      el.style.color = 'rgba(255,255,255,0.85)'
    } else {
      el.style.background = assets.themePrimaryDark
    }
  }

  const handleNavLinkMouseLeave = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget
    if (!isNavLinkActive(el)) {
      el.style.background = 'transparent'
      el.style.color = 'rgba(255,255,255,0.55)'
    } else {
      el.style.background = assets.themePrimary
      el.style.color = assets.themePrimaryContrast
    }
  }

  const inner = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: displayCollapsed ? 'center' : 'flex-start',
          gap: '0.625rem',
          padding: displayCollapsed ? '1.125rem 0 1rem' : '1.125rem 0.875rem 1rem 1.25rem',
          flexShrink: 0,
          position: 'relative',
          cursor: 'pointer',
          minHeight: '4.5rem',
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isMobile && (isHovered || isPinned)) {
            setIsPinned((p) => !p)
          }
          navigate('/')
          if (isMobile && onMobileClose) onMobileClose()
        }}
      >
        <div
          style={{
            background: logoUrl ? 'transparent' : logoColor,
            borderRadius: '0.625rem',
            width: '2.125rem',
            height: '2.125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <BrandIcon size={18} color="#fff" strokeWidth={2.5} />
          )}
        </div>
        {!displayCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#FFFFFF', fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            {subtitle && (
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.125rem', whiteSpace: 'nowrap' }}>
                {subtitle}
              </div>
            )}
          </div>
        )}
        {isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); if (isMobile && onMobileClose) onMobileClose() }}
            style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', width: '1.75rem', height: '1.75rem', borderRadius: '0.4375rem', border: '0.0625rem solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div
        role="presentation"
        onClick={() => {
          if (!isMobile && (isHovered || isPinned)) setIsPinned((p) => !p)
        }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, cursor: 'pointer' }}
      >
      <div style={{ height: '0.0625rem', background: 'rgba(255,255,255,0.08)', marginInline: displayCollapsed ? '0.625rem' : '1rem', transition: 'margin 0.22s cubic-bezier(0.4,0,0.2,1)' }} />
      {displayCollapsed ? (
        <div
          data-tour="sidebar-search"
          onClick={(e) => e.stopPropagation()}
          style={{
            ...iconCell(false),
            margin: '0.5rem 0.625rem 0.375rem',
            cursor: 'default',
            background: 'rgba(255,255,255,0.08)',
          }}
          title="Search"
        >
          <Search size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} style={{ flexShrink: 0 }} />
        </div>
      ) : (
        <div
          data-tour="sidebar-search"
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0, padding: '0.5rem 0.75rem 0.375rem' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.625rem',
              borderRadius: '0.5rem',
              background: 'rgba(255,255,255,0.08)',
              border: '0.0625rem solid rgba(255,255,255,0.12)',
            }}
          >
            <Search size={14} color="rgba(255,255,255,0.5)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search navigation"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                color: '#fff',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}
      <nav
        data-tour="sidebar-nav"
        style={{ flex: 1, padding: '0.5rem 0.625rem 0', display: 'flex', flexDirection: 'column', gap: '0.125rem', overflowY: 'auto', scrollbarWidth: 'none' }}
      >
        {filteredNavItems.map((item) => {
          const { icon: Icon, label, path, end, children } = item
          const hasChildren = Boolean(children?.length)
          const linkPath = hasChildren && children?.length ? children[0].path : path
          const linkEnd = hasChildren ? false : (end ?? path === '/')
          const tourId = navTourId(path)

          return (
            <NavLink
              key={path}
              to={linkPath}
              end={linkEnd}
              data-tour={tourId}
              title={displayCollapsed ? label : undefined}
              style={({ isActive }) => iconCell(isActive)}
              onClick={(e) => { e.stopPropagation(); if (isMobile && onMobileClose) onMobileClose() }}
              onMouseEnter={handleNavLinkMouseEnter}
              onMouseLeave={handleNavLinkMouseLeave}
            >
              <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} style={{ flexShrink: 0 }} />
              {!displayCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
            </NavLink>
          )
        })}
      </nav>
      {(bottomNavItem || bottomContent) && (
        <div style={{ padding: '0.75rem 0.625rem 1.25rem', flexShrink: 0 }}>
          <div style={{ height: '0.0625rem', background: 'rgba(255,255,255,0.08)', marginBottom: '0.625rem' }} />
          {bottomNavItem && (
            <NavLink
              to={bottomNavItem.path}
              title={displayCollapsed ? bottomNavItem.label : undefined}
              onClick={(e) => { e.stopPropagation(); if (isMobile && onMobileClose) onMobileClose() }}
              style={({ isActive }) => ({ ...iconCell(isActive), marginBottom: '0.5rem', color: isActive ? assets.themePrimaryContrast : 'rgba(255,255,255,0.5)' })}
              onMouseEnter={handleNavLinkMouseEnter}
              onMouseLeave={handleNavLinkMouseLeave}
            >
              <bottomNavItem.icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} style={{ flexShrink: 0 }} />
              {!displayCollapsed && <span>{bottomNavItem.label}</span>}
            </NavLink>
          )}
          {bottomContent}
        </div>
      )}
      {profileLabel != null && (
        <div
          data-tour="sidebar-profile"
          style={{ padding: '0.75rem 0.625rem 1rem', flexShrink: 0, borderTop: '0.0625rem solid rgba(255,255,255,0.08)' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate('/admin/profile')
              onProfileClick?.()
              if (isMobile && onMobileClose) onMobileClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: displayCollapsed ? 'center' : 'flex-start',
              gap: displayCollapsed ? 0 : '0.625rem',
              width: '100%',
              padding: '0.5rem 0.625rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.9)',
              cursor: 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          >
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '0.5rem',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 600,
                flexShrink: 0,
                color: '#fff',
              }}
            >
              {profileLabel.slice(0, 2).toUpperCase()}
            </div>
            {!displayCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileLabel}</div>
                {profileSubtext && <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.0625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileSubtext}</div>}
              </div>
            )}
          </button>
          {onSignOut && (displayCollapsed ? (
            <button
              type="button"
              className="sidebar-signout-btn"
              onClick={(e) => { e.stopPropagation(); setShowSignOutConfirm(true) }}
              title="Sign out"
              style={{ marginTop: '0.375rem', width: '100%', padding: '0.5rem 0', borderRadius: '0.375rem', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <LogOut size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="sidebar-signout-btn"
              onClick={(e) => { e.stopPropagation(); setShowSignOutConfirm(true) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.375rem',
                width: '100%',
                padding: '0.375rem 0.625rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          ))}
        </div>
      )}
      </div>
    </>
  )

  const signOutConfirmModal = (
    <ConfirmModal
      open={showSignOutConfirm}
      onClose={() => setShowSignOutConfirm(false)}
      onConfirm={() => {
        setShowSignOutConfirm(false)
        onSignOut?.()
        if (isMobile && onMobileClose) onMobileClose()
      }}
      title="Sign out?"
      message="Are you sure you want to sign out?"
      confirmLabel="Sign out"
      cancelLabel="Cancel"
      variant="danger"
    />
  )

  if (isMobile) {
    return (
      <>
        <div onClick={onMobileClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, opacity: isMobileOpen ? 1 : 0, pointerEvents: isMobileOpen ? 'auto' : 'none', transition: 'opacity 0.22s' }} />
        <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: SIDEBAR_WIDTH_MOBILE, zIndex: 50, background: assets.sidebarBg, display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: isMobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isMobileOpen ? '0.25rem 0 1.5rem rgba(0,0,0,0.3)' : 'none' }}>
          {inner}
        </aside>
        {signOutConfirmModal}
      </>
    )
  }

  return (
    <>
      <aside
        style={{ width: displayCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'transparent', overflow: 'hidden', transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div
          role="presentation"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}
        >
          {inner}
        </div>
      </aside>
      {signOutConfirmModal}
    </>
  )
}
