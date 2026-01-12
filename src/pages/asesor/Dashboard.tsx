import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, Clock, FileText, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Company {
    id: string;
    name: string;
    cif: string | null;
}

interface DashboardStats {
    employeeCount: number;
    todayClockings: number;
    pendingCorrections: number;
    recentIncidents: number;
}

export default function AsesorDashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [stats, setStats] = useState<DashboardStats>({
        employeeCount: 0,
        todayClockings: 0,
        pendingCorrections: 0,
        recentIncidents: 0,
    });
    const [loading, setLoading] = useState(true);

    // Fetch companies assigned to this asesor
    useEffect(() => {
        const fetchAssignedCompanies = async () => {
            if (!user) return;

            try {
                // Get companies via user_company join for asesor role
                const { data, error } = await supabase
                    .from('user_company')
                    .select('company:company_id(id, name, cif)')
                    .eq('user_id', user.id);

                if (error) throw error;

                if (data && data.length > 0) {
                    const companyList = data
                        .map(row => row.company as unknown as Company)
                        .filter(Boolean);
                    setCompanies(companyList);

                    // Select first company by default
                    if (companyList.length > 0) {
                        setSelectedCompanyId(companyList[0].id);
                    }
                }
            } catch (err) {
                console.error('Error fetching assigned companies:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAssignedCompanies();
    }, [user]);

    // Fetch stats when company is selected
    useEffect(() => {
        const fetchCompanyStats = async () => {
            if (!selectedCompanyId) return;

            try {
                const today = new Date().toISOString().split('T')[0];

                // Count employees
                const { count: empCount } = await supabase
                    .from('employees')
                    .select('*', { count: 'exact', head: true })
                    .eq('company_id', selectedCompanyId)
                    .eq('status', 'active');

                // Count today's clockings
                const { count: clockCount } = await supabase
                    .from('time_events')
                    .select('*', { count: 'exact', head: true })
                    .gte('timestamp', today);

                // Count pending corrections
                const { count: corrCount } = await supabase
                    .from('correction_requests')
                    .select('*, employees!inner(company_id)', { count: 'exact', head: true })
                    .eq('employees.company_id', selectedCompanyId)
                    .eq('status', 'pending');

                setStats({
                    employeeCount: empCount || 0,
                    todayClockings: clockCount || 0,
                    pendingCorrections: corrCount || 0,
                    recentIncidents: 0,
                });
            } catch (err) {
                console.error('Error fetching company stats:', err);
            }
        };

        fetchCompanyStats();
    }, [selectedCompanyId]);

    const selectedCompany = companies.find(c => c.id === selectedCompanyId);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Eye className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-semibold text-gray-800">Panel Asesor</h1>
                        <Badge variant="secondary" className="ml-2">Vista Solo Lectura</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{user?.email}</span>
                        <Button variant="outline" size="sm" onClick={() => signOut()}>
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {/* Company Selector */}
                <Card className="mb-8">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Building2 className="h-5 w-5" />
                            Empresas Asignadas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {companies.length === 0 ? (
                            <p className="text-gray-500">No tienes empresas asignadas como asesor.</p>
                        ) : (
                            <Select value={selectedCompanyId || ''} onValueChange={setSelectedCompanyId}>
                                <SelectTrigger className="w-full max-w-md">
                                    <SelectValue placeholder="Selecciona una empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companies.map(company => (
                                        <SelectItem key={company.id} value={company.id}>
                                            {company.name} {company.cif && `(${company.cif})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </CardContent>
                </Card>

                {selectedCompany && (
                    <>
                        {/* Company Name Banner */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">{selectedCompany.name}</h2>
                            {selectedCompany.cif && (
                                <p className="text-gray-500">CIF: {selectedCompany.cif}</p>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 rounded-full">
                                            <Users className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{stats.employeeCount}</p>
                                            <p className="text-sm text-gray-500">Empleados Activos</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-green-100 rounded-full">
                                            <Clock className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{stats.todayClockings}</p>
                                            <p className="text-sm text-gray-500">Fichajes Hoy</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-amber-100 rounded-full">
                                            <FileText className="h-5 w-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{stats.pendingCorrections}</p>
                                            <p className="text-sm text-gray-500">Correcciones Pendientes</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-red-100 rounded-full">
                                            <Building2 className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{companies.length}</p>
                                            <p className="text-sm text-gray-500">Empresas Totales</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Quick Actions - Read Only Views */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Acciones Rápidas (Solo Lectura)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-auto py-4 flex flex-col gap-2"
                                        onClick={() => navigate(`/asesor/registros?company=${selectedCompanyId}`)}
                                    >
                                        <Clock className="h-5 w-5" />
                                        <span>Ver Registros</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-auto py-4 flex flex-col gap-2"
                                        onClick={() => navigate(`/asesor/informes?company=${selectedCompanyId}`)}
                                    >
                                        <FileText className="h-5 w-5" />
                                        <span>Ver Informes</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-auto py-4 flex flex-col gap-2"
                                        onClick={() => navigate(`/asesor/empleados?company=${selectedCompanyId}`)}
                                    >
                                        <Users className="h-5 w-5" />
                                        <span>Ver Empleados</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-auto py-4 flex flex-col gap-2"
                                        onClick={() => navigate(`/asesor/correcciones?company=${selectedCompanyId}`)}
                                    >
                                        <Eye className="h-5 w-5" />
                                        <span>Ver Correcciones</span>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}
