import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, FileEdit, Settings, LogOut, Menu, X, Calendar, FileSignature, Bell, FileCheck } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface EmployeeLayoutProps {
  children: ReactNode;
}

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const { user, employee, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch unread notifications count
  const { data: unreadCount } = useQuery({
    queryKey: ['employee-notifications-count', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return 0;
      const { count, error } = await supabase
        .from('employee_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', employee.id)
        .eq('is_read', false);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!employee?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    { href: '/employee', label: 'Mis Fichajes', icon: <Clock className="h-5 w-5" /> },
    { href: '/employee/absences', label: 'Ausencias', icon: <Calendar className="h-5 w-5" /> },
    { href: '/employee/closure', label: 'Cierre Mensual', icon: <FileSignature className="h-5 w-5" /> },
    { href: '/employee/legal-documents', label: 'Documentos Legales', icon: <FileCheck className="h-5 w-5" /> },
    { href: '/employee/corrections', label: 'Solicitar Corrección', icon: <FileEdit className="h-5 w-5" /> },
    { href: '/employee/requests', label: 'Mis Solicitudes', icon: <FileText className="h-5 w-5" /> },
    { 
      href: '/employee/notifications', 
      label: 'Notificaciones', 
      icon: <Bell className="h-5 w-5" />,
      badge: unreadCount && unreadCount > 0 ? unreadCount : undefined
    },
    { href: '/employee/settings', label: 'Configuración', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="font-semibold">Portal Empleado</span>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 flex flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-14 items-center border-b px-6 flex-shrink-0">
            <Link to="/employee" className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <span className="font-semibold">Portal Empleado</span>
            </Link>
          </div>

          {employee && (
            <div className="border-b p-4 flex-shrink-0">
              <p className="font-medium">{employee.first_name} {employee.last_name}</p>
              <p className="text-sm text-muted-foreground">{employee.department || 'Sin departamento'}</p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </div>
                  {item.badge && (
                    <Badge variant="secondary" className="h-5 min-w-5 flex items-center justify-center text-xs">
                      {item.badge > 9 ? '9+' : item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </nav>

          <div className="border-t p-4 flex-shrink-0">
            <div className="mb-2 px-3 text-sm text-muted-foreground truncate">
              {user?.email}
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
