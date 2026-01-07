import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import CompanySetup from "./pages/CompanySetup";
import Dashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import ClockingDevices from "./pages/admin/ClockingDevices";
import TimeRecords from "./pages/admin/TimeRecords";
import Corrections from "./pages/admin/Corrections";
import OrphanClockIns from "./pages/admin/OrphanClockIns";
import ClockingIncidents from "./pages/admin/ClockingIncidents";
import Reports from "./pages/admin/Reports";
import AuditLog from "./pages/admin/AuditLog";
import QTSPEvidence from "./pages/admin/QTSPEvidence";
import Settings from "./pages/admin/Settings";
import Compliance from "./pages/admin/Compliance";
import ComplianceIncidents from "./pages/admin/ComplianceIncidents";
import EmployeeDashboard from "./pages/employee/Dashboard";
import Templates from "./pages/admin/Templates";
import AdminAbsences from "./pages/admin/Absences";
import LegalDocuments from "./pages/admin/LegalDocuments";
import DataRetention from "./pages/admin/DataRetention";
import ContingencyRecords from "./pages/admin/ContingencyRecords";
import ITSSPackageGenerator from "./pages/admin/ITSSPackageGenerator";
import CalendarLaboral from "./pages/admin/CalendarLaboral";
import RequestCorrection from "./pages/employee/RequestCorrection";
import MyRequests from "./pages/employee/MyRequests";
import EmployeeSettings from "./pages/employee/Settings";
import EmployeeAbsences from "./pages/employee/Absences";
import MonthlyClosure from "./pages/employee/MonthlyClosure";
import EmployeeNotifications from "./pages/employee/Notifications";
import EmployeeLegalDocuments from "./pages/employee/LegalDocuments";
import EmployeeCommunications from "./pages/employee/Communications";
import AdminCommunications from "./pages/admin/Communications";
import KioskHome from "./pages/kiosk/KioskHome";
import NotFound from "./pages/NotFound";
import TestCredentials from "./pages/TestCredentials";

// Super Admin Pages
import SuperAdminDashboard from "./pages/super-admin/Dashboard";
import SuperAdminCompanies from "./pages/super-admin/Companies";
import SuperAdminUsers from "./pages/super-admin/Users";
import SuperAdminActivity from "./pages/super-admin/Activity";
import SuperAdminQTSPMonitor from "./pages/super-admin/QTSPMonitor";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, isResponsible, isEmployee, isSuperAdmin } = useAuth();
  const { hasCompany, isLoading: companyLoading } = useCompany();

  if (loading || (user && companyLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect logic for root
  const getDefaultRoute = () => {
    if (!user) return "/auth";
    // Super admin goes to super admin panel
    if (isSuperAdmin) return "/super-admin";
    // If user has no company, redirect to setup
    if (!hasCompany && (isAdmin || !isEmployee)) return "/company-setup";
    if (isAdmin || isResponsible) return "/admin";
    if (isEmployee) return "/employee";
    // Users without roles go to company setup
    return "/company-setup";
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/company-setup" element={
        user ? <CompanySetup /> : <Navigate to="/auth" replace />
      } />
      
      {/* Kiosk route - no auth required */}
      <Route path="/kiosk" element={<KioskHome />} />
      
      {/* Test credentials page - no auth required */}
      <Route path="/test-credentials" element={<TestCredentials />} />
      
      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin', 'responsible']}>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/employees" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <Employees />
        </ProtectedRoute>
      } />
      <Route path="/admin/clocking-devices" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <ClockingDevices />
        </ProtectedRoute>
      } />
      <Route path="/admin/time-records" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin', 'responsible']}>
          <TimeRecords />
        </ProtectedRoute>
      } />
      <Route path="/admin/corrections" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin', 'responsible']}>
          <Corrections />
        </ProtectedRoute>
      } />
      <Route path="/admin/orphan-clockins" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <OrphanClockIns />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin', 'responsible']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/audit" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <AuditLog />
        </ProtectedRoute>
      } />
      <Route path="/admin/qtsp" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <QTSPEvidence />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/admin/compliance" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <Compliance />
        </ProtectedRoute>
      } />
      <Route path="/admin/compliance/incidents" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <ComplianceIncidents />
        </ProtectedRoute>
      } />
      <Route path="/admin/templates" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <Templates />
        </ProtectedRoute>
      } />
      <Route path="/admin/absences" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <AdminAbsences />
        </ProtectedRoute>
      } />
      <Route path="/admin/legal-documents" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <LegalDocuments />
        </ProtectedRoute>
      } />
      <Route path="/admin/data-retention" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <DataRetention />
        </ProtectedRoute>
      } />
      <Route path="/admin/contingency-records" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <ContingencyRecords />
        </ProtectedRoute>
      } />
      <Route path="/admin/itss-package" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <ITSSPackageGenerator />
        </ProtectedRoute>
      } />
      <Route path="/admin/calendar-laboral" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <CalendarLaboral />
        </ProtectedRoute>
      } />
      <Route path="/admin/clocking-incidents" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <ClockingIncidents />
        </ProtectedRoute>
      } />
      <Route path="/admin/communications" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <AdminCommunications />
        </ProtectedRoute>
      } />

      {/* Super Admin routes */}
      <Route path="/super-admin" element={
        <ProtectedRoute requiredRoles={['super_admin']}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/companies" element={
        <ProtectedRoute requiredRoles={['super_admin']}>
          <SuperAdminCompanies />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/users" element={
        <ProtectedRoute requiredRoles={['super_admin']}>
          <SuperAdminUsers />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/activity" element={
        <ProtectedRoute requiredRoles={['super_admin']}>
          <SuperAdminActivity />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/qtsp" element={
        <ProtectedRoute requiredRoles={['super_admin']}>
          <SuperAdminQTSPMonitor />
        </ProtectedRoute>
      } />

      {/* Employee routes */}
      <Route path="/employee" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeDashboard />
        </ProtectedRoute>
      } />
      <Route path="/employee/absences" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeAbsences />
        </ProtectedRoute>
      } />
      <Route path="/employee/closure" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <MonthlyClosure />
        </ProtectedRoute>
      } />
      <Route path="/employee/corrections" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <RequestCorrection />
        </ProtectedRoute>
      } />
      <Route path="/employee/requests" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <MyRequests />
        </ProtectedRoute>
      } />
      <Route path="/employee/notifications" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeNotifications />
        </ProtectedRoute>
      } />
      <Route path="/employee/settings" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeSettings />
        </ProtectedRoute>
      } />
      <Route path="/employee/legal-documents" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeLegalDocuments />
        </ProtectedRoute>
      } />
      <Route path="/employee/communications" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeCommunications />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
