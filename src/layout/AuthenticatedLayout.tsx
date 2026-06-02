import { useMemo } from 'react'
import { AppLayout } from './AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { layoutConfig, getPageTitle } from '@/config/layout'
import { filterNavItems } from '@/lib/navFilter'
import RoleProtectedRoute from '@/components/RoleProtectedRoute'
import { TourProvider } from '@/contexts/TourContext'
import { PlatformTour } from '@/components/PlatformTour'

export default function AuthenticatedLayout() {
  const { user, displayName, signOut, canAccessPage, canManageUsers } = useAuth()

  const navItems = useMemo(
    () =>
      filterNavItems(layoutConfig.navItems, canAccessPage, {
        includeUserManagement: canManageUsers,
      }),
    [canAccessPage, canManageUsers],
  )

  return (
    <RoleProtectedRoute>
      <DataProvider>
        <TourProvider>
          <AppLayout
            {...layoutConfig}
            navItems={navItems}
            getPageTitle={getPageTitle}
            userName={displayName}
            profileLabel={displayName}
            profileSubtext={user?.email}
            onSignOut={signOut}
          />
          <PlatformTour />
        </TourProvider>
      </DataProvider>
    </RoleProtectedRoute>
  )
}
