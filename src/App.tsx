import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useHousehold } from './hooks/useHousehold'
import { useStores } from './hooks/useStores'

import JoinScreen from './pages/JoinScreen'
import Home from './pages/Home'
import AddToList from './pages/AddToList'
import Shop from './pages/Shop'
import Insights from './pages/Insights'
import Settings from './pages/Settings'

function AppRoutes() {
  const { isSetup } = useHousehold()

  // Load stores once household is set up
  useStores()

  if (!isSetup) {
    return <JoinScreen />
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/add" element={<AddToList />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-screen w-screen overflow-hidden bg-gray-50">
        <AppRoutes />
      </div>
    </BrowserRouter>
  )
}
