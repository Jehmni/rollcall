import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminRoute, SuperRoute } from './components/ProtectedRoute'
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
import HelpCentre from './pages/HelpCentre'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Blocked from './pages/Blocked'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Billing from './pages/Billing'

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Public */}
            <Route path="/" element={<ErrorBoundary label="Landing"><Landing /></ErrorBoundary>} />
            <Route path="/checkin" element={<ErrorBoundary label="Check-in"><CheckIn /></ErrorBoundary>} />
            <Route path="/help" element={<ErrorBoundary label="Help Centre"><HelpCentre /></ErrorBoundary>} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            {/* Admin auth */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/signup" element={<AdminSignup />} />
            <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
            <Route path="/admin/update-password" element={<AdminUpdatePassword />} />

            {/* Admin — protected */}
            <Route path="/admin" element={<AdminRoute><ErrorBoundary label="Dashboard"><AdminDashboard /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/discover" element={<AdminRoute><ErrorBoundary label="Discover"><AdminOrgDiscovery /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/orgs/:orgId" element={<AdminRoute><ErrorBoundary label="Org Detail"><OrgDetail /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/units/:unitId" element={<AdminRoute><ErrorBoundary label="Unit Dashboard"><UnitDashboard /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/units/:unitId/members" element={<AdminRoute><ErrorBoundary label="Unit Members"><UnitMembers /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/units/:unitId/members/:memberId" element={<AdminRoute><ErrorBoundary label="Member Detail"><MemberDetail /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/units/:unitId/events/:serviceId" element={<AdminRoute><ErrorBoundary label="Service Detail"><AdminServiceDetail /></ErrorBoundary></AdminRoute>} />
            <Route path="/admin/billing" element={<AdminRoute><ErrorBoundary label="Billing"><Billing /></ErrorBoundary></AdminRoute>} />

            {/* Blocked — shown to suspended admins regardless of route */}
            <Route path="/blocked" element={<Blocked />} />

            {/* Superadmin — founder only, not linked anywhere */}
            <Route path="/__rc_super" element={<SuperRoute><SuperAdminDashboard /></SuperRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}
