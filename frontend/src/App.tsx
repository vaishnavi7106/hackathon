import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'

import LoginPage from '@/pages/auth/LoginPage'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth — no bottom nav */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Main app — with bottom nav via Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/crop-sentinel" element={<CropSentinel />} />
          <Route path="/market" element={<MarketNavigator />} />
          <Route path="/outbreak" element={<OutbreakNetwork />} />
        </Route>

        {/* Navigator — self-contained pages */}
        <Route path="/navigator" element={<NavigatorHome />} />
        <Route path="/navigator/chat" element={<Chat />} />
        <Route path="/navigator/eligible" element={<EligibilityChecker />} />
        <Route path="/navigator/saved" element={<SavedSchemes />} />
        <Route path="/navigator/:schemeId" element={<SchemeDetail />} />

        {/* Profile — self-contained pages */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/onboarding" element={<ProfileOnboarding />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
