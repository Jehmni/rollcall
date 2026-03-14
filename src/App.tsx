import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AdminRoute } from './components/ProtectedRoute'
import CheckIn from './pages/CheckIn'
import Landing from './pages/Landing'
import AdminLogin from './pages/AdminLogin'
import AdminSignup from './pages/AdminSignup'
import AdminForgotPassword from './pages/AdminForgotPassword'
import AdminUpdatePassword from './pages/AdminUpdatePassword'
import AdminDashboard from './pages/AdminDashboard'
import OrgDetail from './pages/OrgDetail'
import UnitDashboard from './pages/UnitDashboard'
import UnitMembers from './pages/UnitMembers'
import AdminServiceDetail from './pages/AdminServiceDetail'
import MemberDetail from './pages/MemberDetail'
import AdminOrgDiscovery from './pages/AdminOrgDiscovery'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/checkin" element={<CheckIn />} />

          {/* Admin auth */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/signup" element={<AdminSignup />} />
          <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
          <Route path="/admin/update-password" element={<AdminUpdatePassword />} />

          {/* Admin — protected */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/discover" element={<AdminRoute><AdminOrgDiscovery /></AdminRoute>} />
          <Route path="/admin/orgs/:orgId" element={<AdminRoute><OrgDetail /></AdminRoute>} />
          <Route path="/admin/units/:unitId" element={<AdminRoute><UnitDashboard /></AdminRoute>} />
          <Route path="/admin/units/:unitId/members" element={<AdminRoute><UnitMembers /></AdminRoute>} />
          <Route path="/admin/units/:unitId/members/:memberId" element={<AdminRoute><MemberDetail /></AdminRoute>} />
          <Route path="/admin/units/:unitId/events/:serviceId" element={<AdminRoute><AdminServiceDetail /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
