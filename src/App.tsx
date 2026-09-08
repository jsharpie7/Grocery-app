import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuthProvider from './providers/AuthProvider'
import { useAuthStore } from './store/authStore'
import { useHouseholdStore } from './store/householdStore'
import BottomNav from './components/layout/BottomNav'
import NewReceiptFab from './components/layout/NewReceiptFab'
import OfflineBanner from './components/ui/OfflineBanner'
import Spinner from './components/ui/Spinner'

import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import DashboardPage from './pages/DashboardPage'
import ReceiptsPage from './pages/ReceiptsPage'
import NewReceiptPage from './pages/NewReceiptPage'
import ReceiptDetailPage from './pages/ReceiptDetailPage'
import InsightsPage from './pages/InsightsPage'
import SettingsPage from './pages/SettingsPage'

/** Screens that carry the tab bar and the FAB. Everything else is pushed or
 *  modal and owns its own chrome. */
const TAB_ROOTS = ['/', '/receipts', '/insights', '/settings']

function AppRoutes() {
  const { user, loading } = useAuthStore()
  const householdId = useHouseholdStore((s) => s.householdId)
  // Above the early returns: hooks must run in the same order on every render,
  // and `loading`, `user` and `householdId` all flip during a normal session.
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!householdId) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  const isTabRoot = TAB_ROOTS.includes(location.pathname)

  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/receipts/new" element={<NewReceiptPage />} />
        <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isTabRoot && (
        <>
          <BottomNav />
          <NewReceiptFab />
        </>
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="h-full w-full overflow-hidden bg-canvas flex flex-col">
          <OfflineBanner />
          <div className="flex-1 overflow-hidden">
            <AppRoutes />
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
