import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthenticatedLayout } from '@/layout'
import { useAuth } from '@/contexts/AuthContext'
import HomePage from '@/pages/home/HomePage'
import PeoplePage from '@/pages/organization/PeoplePage'
import PersonDetailPage from '@/pages/organization/PersonDetailPage'
import DepartmentsPage from '@/pages/organization/DepartmentsPage'
import RecordsPage from '@/pages/performance/RecordsPage'
import CyclesPage from '@/pages/performance/CyclesPage'
import ScorecardDetailPage from '@/pages/performance/ScorecardDetailPage'
import GoalsPage from '@/pages/goals/GoalsPage'
import MonitoringPage from '@/pages/analytics/MonitoringPage'
import ExplorePage from '@/pages/analytics/ExplorePage'
import ReviewersPage from '@/pages/analytics/ReviewersPage'
import CalibrationPage from '@/pages/analytics/CalibrationPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import DataHealthPage from '@/pages/admin/DataHealthPage'
import AccessManagementPage from '@/pages/admin/AccessManagementPage'
import ProfilePage from '@/pages/admin/ProfilePage'
import LoginPage from '@/pages/auth/LoginPage'
import { routes } from '@/lib/routes'
import { env } from '@/env'

const ANALYTICS_LANDING_PATHS = [
  routes.analytics.monitoring,
  routes.analytics.explore,
  routes.analytics.reviewers,
  routes.analytics.calibration,
] as const

function AnalyticsIndexRedirect() {
  const { canAccessPath } = useAuth()
  const target =
    ANALYTICS_LANDING_PATHS.find((path) => canAccessPath(path)) ?? routes.home
  return <Navigate to={target} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<AuthenticatedLayout />}>
          <Route index element={<HomePage />} />

          <Route path="organization">
            <Route index element={<Navigate to={routes.organization.departments} replace />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="people/:employeeId" element={<PersonDetailPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
          </Route>

          <Route path="performance">
            <Route index element={<Navigate to={routes.performance.records} replace />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="cycles" element={<CyclesPage />} />
            <Route path="scorecards/:recordId" element={<ScorecardDetailPage />} />
          </Route>

          <Route path="goals">
            <Route index element={<GoalsPage />} />
            <Route path="monitoring" element={<Navigate to={routes.analytics.monitoring} replace />} />
          </Route>

          <Route path="analytics">
            <Route index element={<AnalyticsIndexRedirect />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="monitoring" element={<MonitoringPage />} />
            <Route path="ptr-monitoring" element={<Navigate to={routes.analytics.monitoring} replace />} />
            <Route path="reviewers" element={<ReviewersPage />} />
            <Route path="calibration" element={<CalibrationPage />} />
          </Route>

          <Route path="admin">
            <Route index element={<Navigate to={routes.admin.settings} replace />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="data-health" element={<DataHealthPage />} />
            <Route path="access" element={<AccessManagementPage />} />
          </Route>

          <Route path="account">
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Legacy redirects */}
          <Route path="employees" element={<Navigate to={routes.organization.people} replace />} />
          <Route path="overview" element={<Navigate to={routes.home} replace />} />
          <Route path="reviews" element={<Navigate to={routes.performance.records} replace />} />
          <Route path="reviews/cycles" element={<Navigate to={routes.performance.cycles} replace />} />
          <Route
            path="reviews/scorecards"
            element={<Navigate to={`${routes.performance.records}?view=scorecards`} replace />}
          />
          <Route path="reviews/scorecards/:recordId" element={<LegacyScorecardRedirect />} />
          <Route path="reviews/reviewers" element={<Navigate to={routes.analytics.reviewers} replace />} />
          <Route path="reviews/calibration" element={<Navigate to={routes.analytics.calibration} replace />} />
          <Route path="reviews/goals" element={<Navigate to={routes.goals.root} replace />} />
          <Route path="reviews/goals-monitoring" element={<Navigate to={routes.analytics.monitoring} replace />} />
          <Route path="insights" element={<Navigate to={routes.analytics.explore} replace />} />
          <Route path="insights/metrics" element={<Navigate to={routes.analytics.explore} replace />} />
          <Route path="reviewers" element={<Navigate to={routes.analytics.reviewers} replace />} />
          <Route path="cycles" element={<Navigate to={routes.performance.cycles} replace />} />
          <Route path="metrics" element={<Navigate to={routes.analytics.explore} replace />} />
          <Route path="settings" element={<Navigate to={routes.admin.settings} replace />} />
          <Route path="profile" element={<Navigate to={routes.account.profile} replace />} />
          <Route path="admin/profile" element={<Navigate to={routes.account.profile} replace />} />
        </Route>

        <Route
          path="/signup"
          element={<Navigate to={env.bypassAuth ? '/' : '/login'} replace />}
        />
        <Route path="*" element={<Navigate to={env.bypassAuth ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function LegacyScorecardRedirect() {
  const { recordId } = useParams<{ recordId: string }>()
  return (
    <Navigate
      to={recordId ? routes.performance.scorecard(recordId) : routes.performance.records}
      replace
    />
  )
}

export default App
