import {
  LayoutDashboard,
  Settings,
  LineChart,
  Building2,
  ClipboardList,
  LayoutGrid,
  Users,
  RotateCw,
  List,
  UserCheck,
  SlidersHorizontal,
  Target,
  Activity,
  Compass,
  HeartPulse,
  Shield,
} from 'lucide-react'
import type { AppLayoutConfig } from '@/layout'
import { assets } from './assets'
import { routes } from '@/lib/routes'

export const layoutConfig: Omit<AppLayoutConfig, 'getPageTitle'> = {
  brand: {
    name: 'Performance Dashboard',
    subtitle: 'Revolut People Analytics',
    icon: LayoutDashboard,
    logoColor: assets.themePrimary,
    logoUrl: assets.logoUrl || undefined,
  },
  navItems: [
    { path: routes.home, label: 'Home', icon: LayoutDashboard, end: true },
    {
      path: routes.organization.root,
      label: 'Organization',
      icon: Building2,
      children: [
        { path: routes.organization.departments, label: 'Departments', icon: LayoutGrid },
        { path: routes.organization.people, label: 'People', icon: Users },
      ],
    },
    {
      path: routes.performance.root,
      label: 'Performance',
      icon: ClipboardList,
      children: [
        { path: routes.performance.records, label: 'Records', icon: List },
        { path: routes.performance.cycles, label: 'Cycles', icon: RotateCw },
      ],
    },
    { path: routes.goals.root, label: 'Goals', icon: Target, end: true },
    {
      path: routes.analytics.root,
      label: 'Analytics',
      icon: LineChart,
      children: [
        { path: routes.analytics.monitoring, label: 'Monitoring', icon: Activity },
        { path: routes.analytics.explore, label: 'Explore', icon: Compass },
        { path: routes.analytics.reviewers, label: 'Reviewers', icon: UserCheck },
        { path: routes.analytics.calibration, label: 'Calibration', icon: SlidersHorizontal },
      ],
    },
    {
      path: routes.admin.root,
      label: 'Admin',
      icon: Settings,
      children: [
        { path: routes.admin.settings, label: 'Settings', icon: Settings },
        { path: routes.admin.dataHealth, label: 'Data health', icon: HeartPulse },
        { path: routes.admin.access, label: 'User management', icon: Shield },
      ],
    },
  ],
}

const PAGE_TITLES: Record<string, string> = {
  [routes.home]: 'Home',
  [routes.organization.people]: 'People',
  [routes.organization.departments]: 'Departments',
  [routes.performance.records]: 'Records',
  [routes.performance.cycles]: 'Cycles',
  [routes.goals.root]: 'Goals',
  [routes.analytics.explore]: 'Explore',
  [routes.analytics.monitoring]: 'Monitoring',
  [routes.analytics.reviewers]: 'Reviewers',
  [routes.analytics.calibration]: 'Calibration',
  [routes.admin.settings]: 'Settings',
  [routes.admin.dataHealth]: 'Data health',
  [routes.admin.access]: 'User management',
  [routes.account.profile]: 'Profile',
}

export function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith(`${routes.organization.people}/`)) return 'Person'
  if (pathname.startsWith('/performance/scorecards/')) return 'Scorecard'
  return 'Performance Dashboard'
}
