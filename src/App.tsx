import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages (lazy-loaded for route-level code splitting)
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CompanySetup = lazy(() => import("./pages/CompanySetup"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Employees = lazy(() => import("./pages/admin/Employees"));
const ClockingDevices = lazy(() => import("./pages/admin/ClockingDevices"));
const TimeRecords = lazy(() => import("./pages/admin/TimeRecords"));
const Corrections = lazy(() => import("./pages/admin/Corrections"));
const OrphanClockIns = lazy(() => import("./pages/admin/OrphanClockIns"));
const ClockingIncidents = lazy(() => import("./pages/admin/ClockingIncidents"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const QTSPEvidence = lazy(() => import("./pages/admin/QTSPEvidence"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Compliance = lazy(() => import("./pages/admin/Compliance"));
const ComplianceIncidents = lazy(() => import("./pages/admin/ComplianceIncidents"));
const Templates = lazy(() => import("./pages/admin/Templates"));
const AdminAbsences = lazy(() => import("./pages/admin/Absences"));
const LegalDocuments = lazy(() => import("./pages/admin/LegalDocuments"));
const DataRetention = lazy(() => import("./pages/admin/DataRetention"));
const ContingencyRecords = lazy(() => import("./pages/admin/ContingencyRecords"));
const ITSSPackageGenerator = lazy(() => import("./pages/admin/ITSSPackageGenerator"));
const CalendarLaboral = lazy(() => import("./pages/admin/CalendarLaboral"));
const AdminCommunications = lazy(() => import("./pages/admin/Communications"));

const EmployeeDashboard = lazy(() => import("./pages/employee/Dashboard"));
const RequestCorrection = lazy(() => import("./pages/employee/RequestCorrection"));
const MyRequests = lazy(() => import("./pages/employee/MyRequests"));
const EmployeeSettings = lazy(() => import("./pages/employee/Settings"));
const EmployeeAbsences = lazy(() => import("./pages/employee/Absences"));
const MonthlyClosure = lazy(() => import("./pages/employee/MonthlyClosure"));
const EmployeeNotifications = lazy(() => import("./pages/employee/Notifications"));
const EmployeeLegalDocuments = lazy(() => import("./pages/employee/LegalDocuments"));
const EmployeeCommunications = lazy(() => import("./pages/employee/Communications"));

const KioskHome = lazy(() => import("./pages/kiosk/KioskHome"));
const TestCredentials = lazy(() => import("./pages/TestCredentials"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/Dashboard"));
const SuperAdminCompanies = lazy(() => import("./pages/super-admin/Companies"));
const SuperAdminCompanyConfig = lazy(() => import("./pages/super-admin/CompanyConfig"));
const SuperAdminUsers = lazy(() => import("./pages/super-admin/Users"));
const SuperAdminActivity = lazy(() => import("./pages/super-admin/Activity"));
const SuperAdminQTSPMonitor = lazy(() => import("./pages/super-admin/QTSPMonitor"));

// Asesor Pages
const AsesorDashboard = lazy(() => import("./pages/asesor/Dashboard"));
import { AsesorViewWrapper } from "./components/asesor/AsesorViewWrapper";

const queryClient = new QueryClient();

const FullScreenSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

function AppRoutes() {
  const { user, loading, isAdmin, isResponsible, isEmployee, isSuperAdmin, isAsesor } = useAuth();
  const { hasCompany, isLoading: companyLoading } = useCompany();
  const enableTestCredentialsRoute =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_CREDENTIALS === "true";

  if (loading || (user && companyLoading)) {
    return <FullScreenSpinner />;
  }

  // Redirect logic for root
  const getDefaultRoute = () => {
    if (!user) return "/auth";
    // Super admin goes to super admin panel
    if (isSuperAdmin) return "/super-admin";
    // Asesor goes to asesor panel (multi-company view)
    if (isAsesor) return "/asesor";
    // If user has no company, redirect to setup
    if (!hasCompany && (isAdmin || !isEmployee)) return "/company-setup";
    if (isAdmin || isResponsible) return "/admin";
    if (isEmployee) return "/employee";
    // Users without roles go to company setup
    return "/company-setup";
  };

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/company-setup"
          element={user ? <CompanySetup /> : <Navigate to="/auth" replace />}
        />

        {/* Kiosk route - no auth required */}
        <Route path="/kiosk" element={<KioskHome />} />

        {/* Test credentials page is disabled by default outside explicit dev/test flag */}
        {enableTestCredentialsRoute && (
          <Route path="/test-credentials" element={<TestCredentials />} />
        )}

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin", "responsible"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clocking-devices"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <ClockingDevices />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/time-records"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin", "responsible"]}>
              <TimeRecords />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/corrections"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin", "responsible"]}>
              <Corrections />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/orphan-clockins"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <OrphanClockIns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin", "responsible"]}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/qtsp"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <QTSPEvidence />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/compliance"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <Compliance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/compliance/incidents"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <ComplianceIncidents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/templates"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <Templates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/absences"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <AdminAbsences />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/legal-documents"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <LegalDocuments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/data-retention"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <DataRetention />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/contingency-records"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <ContingencyRecords />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/itss-package"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <ITSSPackageGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/calendar-laboral"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <CalendarLaboral />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clocking-incidents"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <ClockingIncidents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/communications"
          element={
            <ProtectedRoute requiredRoles={["super_admin", "admin"]}>
              <AdminCommunications />
            </ProtectedRoute>
          }
        />

        {/* Super Admin routes */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute requiredRoles={["super_admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/companies"
          element={
            <ProtectedRoute requiredRoles={["super_admin"]}>
              <SuperAdminCompanies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/companies/:companyId/config"
          element={
            <ProtectedRoute requiredRoles={["super_admin"]}>
              <SuperAdminCompanyConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/users"
          element={
            <ProtectedRoute requiredRoles={["super_admin"]}>
              <SuperAdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/activity"
          element={
            <ProtectedRoute requiredRoles={["super_admin"]}>
              <SuperAdminActivity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/qtsp"
          element={
            <ProtectedRoute requiredRoles={["super_admin"]}>
              <SuperAdminQTSPMonitor />
            </ProtectedRoute>
          }
        />

        {/* Asesor routes - read-only multi-company access */}
        <Route
          path="/asesor"
          element={
            <ProtectedRoute requiredRoles={["asesor"]}>
              <AsesorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asesor/employees"
          element={
            <ProtectedRoute requiredRoles={["asesor"]}>
              <AsesorViewWrapper>
                <Employees />
              </AsesorViewWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/asesor/time-records"
          element={
            <ProtectedRoute requiredRoles={["asesor"]}>
              <AsesorViewWrapper>
                <TimeRecords />
              </AsesorViewWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/asesor/reports"
          element={
            <ProtectedRoute requiredRoles={["asesor"]}>
              <AsesorViewWrapper>
                <Reports />
              </AsesorViewWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/asesor/corrections"
          element={
            <ProtectedRoute requiredRoles={["asesor"]}>
              <AsesorViewWrapper>
                <Corrections />
              </AsesorViewWrapper>
            </ProtectedRoute>
          }
        />

        {/* Employee routes */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/absences"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <EmployeeAbsences />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/closure"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <MonthlyClosure />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/corrections"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <RequestCorrection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/requests"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <MyRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/notifications"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <EmployeeNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/settings"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <EmployeeSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/legal-documents"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <EmployeeLegalDocuments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/communications"
          element={
            <ProtectedRoute requiredRoles={["employee"]}>
              <EmployeeCommunications />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
