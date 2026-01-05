import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import Terminals from "./pages/admin/Terminals";
import TimeRecords from "./pages/admin/TimeRecords";
import Corrections from "./pages/admin/Corrections";
import Reports from "./pages/admin/Reports";
import Settings from "./pages/admin/Settings";
import EmployeeDashboard from "./pages/employee/Dashboard";
import RequestCorrection from "./pages/employee/RequestCorrection";
import MyRequests from "./pages/employee/MyRequests";
import EmployeeSettings from "./pages/employee/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, isResponsible, isEmployee } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect logic for root
  const getDefaultRoute = () => {
    if (!user) return "/auth";
    if (isAdmin || isResponsible) return "/admin";
    if (isEmployee) return "/employee";
    return "/admin"; // Default for new users
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      <Route path="/auth" element={<Auth />} />
      
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
      <Route path="/admin/terminals" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <Terminals />
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
      <Route path="/admin/reports" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin', 'responsible']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute requiredRoles={['super_admin', 'admin']}>
          <Settings />
        </ProtectedRoute>
      } />

      {/* Employee routes */}
      <Route path="/employee" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeDashboard />
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
      <Route path="/employee/settings" element={
        <ProtectedRoute requiredRoles={['employee']}>
          <EmployeeSettings />
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
