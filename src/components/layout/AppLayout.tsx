import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Monitor, 
  Clock, 
  FileEdit, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  Shield
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  responsibleOnly?: boolean;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut, isAdmin, isResponsible } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/admin/employees', label: 'Empleados', icon: <Users className="h-5 w-5" />, adminOnly: true },
    { href: '/admin/terminals', label: 'Terminales', icon: <Monitor className="h-5 w-5" />, adminOnly: true },
    { href: '/admin/time-records', label: 'Registros', icon: <Clock className="h-5 w-5" /> },
    { href: '/admin/corrections', label: 'Correcciones', icon: <FileEdit className="h-5 w-5" /> },
    { href: '/admin/reports', label: 'Informes', icon: <FileText className="h-5 w-5" /> },
    { href: '/admin/audit', label: 'Auditoría', icon: <Shield className="h-5 w-5" />, adminOnly: true },
    { href: '/admin/qtsp', label: 'Evidencias QTSP', icon: <Shield className="h-5 w-5" />, adminOnly: true },
    { href: '/admin/settings', label: 'Configuración', icon: <Settings className="h-5 w-5" />, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.responsibleOnly && !isResponsible && !isAdmin) return false;
    return true;
  });

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
        <span className="font-semibold">Control Horario</span>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 transform border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-14 items-center border-b px-6">
            <Link to="/admin" className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <span className="font-semibold">Control Horario</span>
            </Link>
          </div>

          <nav className="flex flex-col gap-1 p-4">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
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
