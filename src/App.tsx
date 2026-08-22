import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuthProvider from './providers/AuthProvider'
import { useAuthStore } from './store/authStore'
import { useHouseholdStore } from './store/householdStore'
import BottomNav from './components/layout/BottomNav'
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

function AppRoutes() {
  const { user, loading } = useAuthStore()
  const householdId = useHouseholdStore((s) => s.householdId)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
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

  const location = useLocation()
  const hideNav = location.pathname === '/receipts/new'

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
      {!hideNav && <BottomNav />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="h-full w-full overflow-hidden bg-gray-50 flex flex-col">
          <OfflineBanner />
          <div className="flex-1 overflow-hidden">
            <AppRoutes />
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
