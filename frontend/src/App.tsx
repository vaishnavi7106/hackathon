import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { useFarmerStore } from '@/store/farmerStore'

import LoginPage from '@/pages/auth/LoginPage'
import VerifyOtpPage from '@/pages/auth/VerifyOtpPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import HomePage from '@/pages/HomePage'
import NavigatorHome from '@/pages/navigator/NavigatorHome'
import SchemeDetail from '@/pages/navigator/SchemeDetail'
import Chat from '@/pages/navigator/Chat'
import EligibilityChecker from '@/pages/navigator/EligibilityChecker'
import SavedSchemes from '@/pages/navigator/SavedSchemes'
import ProfileOnboarding from '@/pages/profile/ProfileOnboarding'
import ProfilePage from '@/pages/profile/ProfilePage'
import CropSentinel from '@/pages/CropSentinel'
import MarketNavigator from '@/pages/MarketNavigator'
import OutbreakNetwork from '@/pages/OutbreakNetwork'
import SoilOptimizer from '@/pages/SoilOptimizer'
import NotificationsPage from '@/pages/NotificationsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  if (isLoggedIn()) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — main app with bottom nav */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/crop-sentinel" element={<CropSentinel />} />
          <Route path="/market" element={<MarketNavigator />} />
          <Route path="/outbreak" element={<OutbreakNetwork />} />
          <Route path="/soil-optimizer" element={<SoilOptimizer />} />
        </Route>

        {/* Protected — navigator */}
        <Route path="/navigator" element={<RequireAuth><NavigatorHome /></RequireAuth>} />
        <Route path="/navigator/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/navigator/eligible" element={<RequireAuth><EligibilityChecker /></RequireAuth>} />
        <Route path="/navigator/saved" element={<RequireAuth><SavedSchemes /></RequireAuth>} />
        <Route path="/navigator/:schemeId" element={<RequireAuth><SchemeDetail /></RequireAuth>} />

        {/* Protected — profile */}
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/profile/onboarding" element={<RequireAuth><ProfileOnboarding /></RequireAuth>} />

        {/* Protected — notifications */}
        <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
