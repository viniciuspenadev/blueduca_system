import { type FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../services/supabase';
import { Button, Card, Input } from '../../../components/ui';
import { Plus, School, Loader2, Shield, AlertTriangle, X, LayoutGrid, CreditCard, Search, Filter, Users, UserPlus, Trash2, BarChart2, Zap, LayoutDashboard } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

interface SchoolData {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    plan_tier: 'FREE' | 'START' | 'GOLD' | 'ENTERPRISE';
    plan_id?: string;
    config_modules: Record<string, boolean>;
    config_limits?: Record<string, number>;
    created_at: string;
    owner_email?: string; // Optional for display
}

interface SchoolUser {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
}

interface SchoolStats {
    people: { students: number; staff: number; leads: number };
    academic: { classes: number; enrollments: number; subjects: number; grades: number; attendance: number };
    financial: { transactions: number; plans: number; installments: number };
    communication: { messages: number; events: number; tasks: number };
    operational: { reports: number; timelines: number; menus: number; planning: number };
}

export const SchoolManagement: FC = () => {
    const navigate = useNavigate();
    const [schools, setSchools] = useState<SchoolData[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);
    const { addToast } = useToast();
    const { user } = useAuth();

    // New School Form State
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolSlug, setNewSchoolSlug] = useState('');
    const [creating, setCreating] = useState(false);

    // Edit Config State
    const [configModules, setConfigModules] = useState<Record<string, boolean>>({});
    const [configPlan, setConfigPlan] = useState<'FREE' | 'START' | 'GOLD' | 'ENTERPRISE'>('FREE');
    const [configPlanId, setConfigPlanId] = useState<string>('');
    const [configLimits, setConfigLimits] = useState<Record<string, number>>({});
    const [configActive, setConfigActive] = useState(true);
    const [saving, setSaving] = useState(false);

    // User Management State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [schoolUsers, setSchoolUsers] = useState<SchoolUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // New User Form State
    const [savingUser, setSavingUser] = useState(false);
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'TEACHER'
    });

    // Inspection & Deletion State
    const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
    const [schoolStats, setSchoolStats] = useState<SchoolStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [sweeping, setSweeping] = useState(false);

    useEffect(() => {
        fetchSchools();
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        const { data } = await supabase.from('product_plans').select('*').order('price_monthly');
        if (data) setPlans(data);
    };

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('schools')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSchools(data || []);
        } catch (error: any) {
            console.error('Error fetching schools:', error);
            addToast('error', 'Erro ao carregar escolas');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            // Using the existing RPC
            const { error } = await supabase.rpc('create_school_with_admin', {
                p_name: newSchoolName,
                p_slug: newSchoolSlug,
                p_owner_id: user?.id // Temporarily assigning to current user (Super Admin) as owner
            });

            if (error) throw error;

            addToast('success', 'Escola criada com sucesso!');
            setIsCreateModalOpen(false);
            setNewSchoolName('');
            setNewSchoolSlug('');
            fetchSchools();
        } catch (error: any) {
            console.error('Error creating school:', error);
            addToast('error', error.message || 'Erro ao criar escola');
        } finally {
            setCreating(false);
        }
    };

    const openConfigModal = (school: SchoolData) => {
        setSelectedSchool(school);
        setConfigModules(school.config_modules || {});
        setConfigPlan(school.plan_tier || 'FREE');
        setConfigPlanId(school.plan_id || '');
        setConfigLimits(school.config_limits || {});
        setConfigActive(school.active);
        setIsConfigModalOpen(true);
    };

    const handleSaveConfig = async () => {
        if (!selectedSchool) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('schools')
                .update({
                    config_modules: configModules,
                    config_limits: configLimits,
                    plan_tier: configPlan,
                    plan_id: configPlanId || null,
                    active: configActive
                })
                .eq('id', selectedSchool.id);

            if (error) throw error;

            addToast('success', 'Configurações atualizadas!');
            setIsConfigModalOpen(false);
            fetchSchools(); // Refresh list
        } catch (error: any) {
            console.error('Error updating school:', error);
            addToast('error', 'Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    // User Management Functions
    const openUserModal = async (school: SchoolData) => {
        setSelectedSchool(school);
        setIsUserModalOpen(true);
        fetchSchoolUsers(school.id);
    };

    const fetchSchoolUsers = async (schoolId: string) => {
        setLoadingUsers(true);
        try {
            // We need to fetch from school_members and join profiles
            // Since we are Super Admin, we can see everything
            const { data, error } = await supabase
                .from('school_members')
                .select(`
                    user_id,
                    role,
                    profiles:user_id (email, name, status)
                `)
                .eq('school_id', schoolId);

            if (error) throw error;

            const users: SchoolUser[] = data.map((item: any) => ({
                id: item.user_id,
                email: item.profiles?.email || 'N/A',
                name: item.profiles?.name || 'N/A',
                role: item.role,
                status: item.profiles?.status || 'ACTIVE'
            }));

            setSchoolUsers(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            addToast('error', 'Erro ao carregar usuários.');
        } finally {
            setLoadingUsers(false);
        }
    };

    const toggleUserStatus = async (user: SchoolUser) => {
        const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

        try {
            // Update profiles table directly
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', user.id);

            if (error) throw error;

            addToast('success', `Usuário ${newStatus === 'ACTIVE' ? 'ativado' : 'desativado'} com sucesso.`);
            if (selectedSchool) fetchSchoolUsers(selectedSchool.id);
        } catch (error: any) {
            console.error('Error toggling user status:', error);
            addToast('error', error.message || 'Erro ao alterar status do usuário.');
        }
    };

    const handleCreateUser = async () => {
        if (!userData.name || !userData.email || !userData.password) {
            addToast('error', 'Preencha todos os campos obrigatórios');
            return;
        }
        if (!selectedSchool?.id) return;

        setSavingUser(true);
        try {
            // 1. Create a TEMPORARY Client to sign up the staff
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) throw new Error("Missing Env Vars");

            const tempClient = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });

            // 2. Sign Up User (Auth)
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        name: userData.name,
                        role: userData.role
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Falha ao criar usuário.");

            // 3. Link to School and Profile (RPC)
            const { error: rpcError } = await supabase.rpc('admin_add_staff_member', {
                p_user_id: authData.user.id,
                p_email: userData.email,
                p_name: userData.name,
                p_role: userData.role,
                p_school_id: selectedSchool.id
            });

            if (rpcError) throw rpcError;

            addToast('success', 'Usuário criado com sucesso!');
            setUserData({ name: '', email: '', password: '', role: 'TEACHER' });
            fetchSchoolUsers(selectedSchool.id); // Refresh list
        } catch (error: any) {
            console.error('Error creating user:', error);
            addToast('error', error.message || 'Erro ao criar usuário');
        } finally {
            setSavingUser(false);
        }
    };

    // Inspection & Deletion Functions
    const openInspectModal = async (school: SchoolData) => {
        setSelectedSchool(school);
        setIsInspectModalOpen(true);
        setSchoolStats(null);
        setDeleteConfirmation('');

        setLoadingStats(true);
        try {
            const { data, error } = await supabase.rpc('get_school_details', { p_school_id: school.id });
            if (error) throw error;
            setSchoolStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
            addToast('error', 'Erro ao carregar estatísticas da escola.');
        } finally {
            setLoadingStats(false);
        }
    };

    const handleDeleteSchool = async () => {
        if (!selectedSchool || deleteConfirmation !== selectedSchool.name) return;

        setDeleting(true);
        try {
            const { error } = await supabase.rpc('admin_delete_school_sweep', { p_school_id: selectedSchool.id });
            if (error) throw error;

            addToast('success', 'Escola excluída com sucesso.');
            setIsInspectModalOpen(false);
            fetchSchools(); // Refresh list
        } catch (error: any) {
            console.error('Error deleting school:', error);
            addToast('error', error.message || 'Erro ao excluir escola.');
        } finally {
            setDeleting(false);
        }
    };

    const handleManualSweep = async () => {
        setSweeping(true);
        try {
            const { data, error } = await supabase.functions.invoke('process-dunning');
            if (error) throw error;
            addToast('success', `Varredura concluída! ${data.processed || 0} notificações enviadas.`);
        } catch (error: any) {
            console.error('Error sweeping dunning:', error);
            addToast('error', 'Erro ao processar régua: ' + (error.message || 'Verifique se a função foi implantada.'));
        } finally {
            setSweeping(false);
        }
    };

    const toggleModule = (moduleKey: string) => {
        const plan = plans.find(p => p.id === configPlanId);
        const isFromPlan = !!plan?.config_modules?.[moduleKey as any];
        const currentOverride = configModules[moduleKey];
        const isActive = currentOverride !== undefined ? currentOverride : isFromPlan;

        setConfigModules(prev => ({
            ...prev,
            [moduleKey]: !isActive
        }));
    };

    const filteredSchools = schools.filter(school =>
        school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        school.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Escolas</h1>
                    <p className="text-gray-500">Administre os tenants, planos e acessos.</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleManualSweep}
                        disabled={sweeping}
                        variant="outline"
                        className="flex items-center gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                        {sweeping ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
                        Processar Régua Geral
                    </Button>
                    <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus size={20} />
                        Nova Escola
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou slug..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="flex items-center gap-2 text-gray-600 border-gray-300">
                    <Filter size={18} />
                    Filtros
                </Button>
            </div>

            {/* School List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-emerald-600" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchools.map(school => (
                        <Card key={school.id} className={`overflow-hidden border transition-all hover:shadow-md ${!school.active ? 'opacity-75 bg-gray-50' : 'bg-white border-gray-200'}`}>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${school.active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>
                                            <School size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{school.name}</h3>
                                            <p className="text-xs text-gray-500 font-mono">/{school.slug}</p>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${school.plan_tier === 'ENTERPRISE' ? 'bg-purple-100 text-purple-700' :
                                        school.plan_tier === 'GOLD' ? 'bg-amber-100 text-amber-700' :
                                            school.plan_tier === 'START' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {school.plan_tier || 'FREE'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <div>
                                        <span className="text-gray-500 text-xs block mb-1">Status</span>
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${school.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${school.active ? 'bg-green-500' : 'bg-red-500'}`} />
                                            {school.active ? 'Ativo' : 'Suspenso'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs block mb-1">Módulos</span>
                                        <span className="text-gray-700 font-medium">
                                            {(() => {
                                                const plan = plans.find(p => p.id === school.plan_id);
                                                const effective = { ...plan?.config_modules, ...school.config_modules };
                                                return Object.values(effective).filter(Boolean).length;
                                            })()} ativos
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        className="text-sm h-9 border-gray-200 hover:bg-gray-50 hover:text-emerald-600 px-3 w-full sm:w-auto"
                                        onClick={() => openConfigModal(school)}
                                    >
                                        <Shield size={16} className="mr-2" />
                                        Configurar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-sm h-9 border-gray-200 hover:bg-gray-50 hover:text-indigo-600 px-3 w-full sm:w-auto"
                                        onClick={() => navigate(`/sys/admin/escolas/${school.id}`)}
                                    >
                                        <LayoutDashboard size={16} className="mr-2" />
                                        Detalhes
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-sm h-9 border-gray-200 hover:bg-gray-50 hover:text-blue-600 px-3 w-full sm:w-auto"
                                        onClick={() => openUserModal(school)}
                                    >
                                        <Users size={16} className="mr-2" />
                                        Usuários
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="h-9 border-gray-200 hover:bg-red-50 hover:text-red-600 px-3 w-full sm:w-auto flex items-center justify-center sm:justify-start"
                                        onClick={() => openInspectModal(school)}
                                        title="Raio-X e Exclusão"
                                    >
                                        <BarChart2 size={16} className="sm:mr-0" />
                                        <span className="ml-2 sm:hidden">Raio-X</span>
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create School Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Nova Escola</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSchool} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Escola</label>
                                <Input
                                    value={newSchoolName}
                                    onChange={e => setNewSchoolName(e.target.value)}
                                    placeholder="Ex: Colégio Futuro"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                                <div className="flex items-center">
                                    <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-3 py-2 text-gray-500 text-sm">/</span>
                                    <input
                                        type="text"
                                        value={newSchoolSlug}
                                        onChange={e => setNewSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="colegio-futuro"
                                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-r-lg border border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Identificador único usado na URL.</p>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="flex-1">Cancelar</Button>
                                <Button type="submit" disabled={creating} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {creating ? <Loader2 className="animate-spin" /> : 'Criar Escola'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {selectedSchool && isConfigModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Configurar {selectedSchool.name}</h2>
                                <p className="text-sm text-gray-500">Gerencie módulos, plano e status.</p>
                            </div>
                            <button onClick={() => setIsConfigModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* Plan Selection */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <CreditCard size={16} /> Plano Contratado
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <select
                                        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                        value={configPlanId}
                                        onChange={(e) => {
                                            const plan = plans.find(p => p.id === e.target.value);
                                            setConfigPlanId(e.target.value);
                                            if (plan) setConfigPlan(plan.name as any);
                                        }}
                                    >
                                        <option value="">Selecione um plano...</option>
                                        {plans.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - R$ {p.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</option>
                                        ))}
                                    </select>
                                </div>
                            </section>

                            {/* Limits Overrides */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Zap size={16} className="text-amber-500" /> Ajustes de Limites (Overrides)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Máx. Alunos</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={configLimits.max_students || ''}
                                            onChange={(e) => setConfigLimits({ ...configLimits, max_students: parseInt(e.target.value) || 0 })}
                                            placeholder="Padrão do Plano"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Máx. Admins</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={configLimits.max_users || ''}
                                            onChange={(e) => setConfigLimits({ ...configLimits, max_users: parseInt(e.target.value) || 0 })}
                                            placeholder="Padrão do Plano"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Mensagens/Mês</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={configLimits.max_messages_month || ''}
                                            onChange={(e) => setConfigLimits({ ...configLimits, max_messages_month: parseInt(e.target.value) || 0 })}
                                            placeholder="Padrão do Plano"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">Valores deixados em branco usarão o padrão do plano selecionado.</p>
                            </section>

                            {/* Modules Toggle */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <LayoutGrid size={16} /> Módulos Provisionados
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { id: 'finance', label: 'Financeiro' },
                                        { id: 'agenda', label: 'Mensagens (App)' }, // Changed label, using 'agenda' key if possible, or mapping
                                        { id: 'whatsapp', label: 'WhatsApp' }, // New
                                        { id: 'dunning', label: 'Régua de Cobrança (CRM)' },
                                        { id: 'academic', label: 'Gestão Acadêmica' },
                                        { id: 'crm', label: 'CRM & Captação' },
                                        { id: 'menu', label: 'Cardápio Escolar' },
                                        { id: 'library', label: 'Biblioteca' },
                                        { id: 'inventory', label: 'Estoque/Almoxarifado' }
                                    ].map((module) => {
                                        // Legacy Support: Map 'agenda' UI to 'communications' DB key if needed, or stick to new key
                                        // For now, let's use 'communications' key for Agenda to preserve existing data, 
                                        // OR start using 'agenda' key. Given title is just renaming, I'll keep key 'communications' 
                                        // BUT User asked "Renomear", I will use 'communications' key but Label 'Agenda / Diário' 
                                        // to be safe, OR I will just render it with ID 'communications' but label changed.

                                        // Let's stick to the list item ID being the DB key.
                                        // The user said "Renomear...".

                                        const dbKey = module.id === 'agenda' ? 'communications' : module.id;

                                        const plan = plans.find(p => p.id === configPlanId);
                                        const isFromPlan = !!plan?.config_modules?.[dbKey as any];
                                        const isOverridden = configModules[dbKey] !== undefined;
                                        const isActive = isOverridden ? configModules[dbKey] : isFromPlan;

                                        return (
                                            <label key={module.id} className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-all ${isActive ? 'bg-emerald-50 border-emerald-200' : 'border-gray-200 hover:bg-gray-50'}`}>
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                                        checked={isActive}
                                                        onChange={() => toggleModule(dbKey)}
                                                    />
                                                    <span className={`ml-3 text-sm font-medium ${isActive ? 'text-emerald-700' : 'text-gray-700'}`}>{module.label}</span>
                                                </div>
                                                <div className="mt-1 ml-7 flex gap-2">
                                                    {isFromPlan && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1 rounded font-bold uppercase">No Plano</span>
                                                    )}
                                                    {isOverridden && (
                                                        <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded font-bold uppercase">Exceção</span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Danger Zone */}
                            <section className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <AlertTriangle size={16} /> Zona de Perigo
                                </h3>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Status da Escola</p>
                                        <p className="text-xs text-red-600">Escolas suspensas perdem acesso imediato.</p>
                                    </div>
                                    <button
                                        onClick={() => setConfigActive(!configActive)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${configActive
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                    >
                                        {configActive ? 'Suspender Escola' : 'Ativar Escola'}
                                    </button>
                                </div>
                            </section>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveConfig} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]">
                                {saving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Management Modal */}
            {selectedSchool && isUserModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col lg:flex-row gap-6">

                        {/* Left Side: Create User */}
                        <div className="lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-100 pb-6 lg:pb-0 lg:pr-6">
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                <h2 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                                    <UserPlus size={18} className="text-blue-600" /> Novo Acesso
                                </h2>
                                <p className="text-xs text-gray-500 mb-4">Adicione um novo membro para {selectedSchool.name}.</p>

                                <form onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }} className="space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Nome Completo</label>
                                        <Input
                                            value={userData.name}
                                            onChange={e => setUserData({ ...userData, name: e.target.value })}
                                            placeholder="Ex: Ana Silva"
                                            required
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Email Corporativo</label>
                                        <Input
                                            type="email"
                                            value={userData.email}
                                            onChange={e => setUserData({ ...userData, email: e.target.value })}
                                            placeholder="ana@escola.com"
                                            required
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Senha Inicial</label>
                                            <Input
                                                type="text"
                                                value={userData.password}
                                                onChange={e => setUserData({ ...userData, password: e.target.value })}
                                                placeholder="Min 6 carac."
                                                required
                                                minLength={6}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Cargo</label>
                                            <select
                                                value={userData.role}
                                                onChange={e => setUserData({ ...userData, role: e.target.value })}
                                                className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                            >
                                                <option value="ADMIN">Administrador</option>
                                                <option value="TEACHER">Professor</option>
                                                <option value="COORDINATOR">Coordenador</option>
                                                <option value="SECRETARY">Secretário(a)</option>
                                                <option value="SUPPORT">Suporte</option>
                                            </select>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={savingUser}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
                                    >
                                        {savingUser ? <Loader2 className="animate-spin" size={16} /> : <span className="flex items-center gap-2 justify-center"><UserPlus size={16} /> Criar Acesso</span>}
                                    </Button>
                                </form>
                            </div>
                        </div>

                        {/* Right Side: List Users */}
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Usuários Ativos</h2>
                                    <p className="text-xs text-gray-500">Membros vinculados a esta escola.</p>
                                </div>
                                <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            {loadingUsers ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {schoolUsers.length === 0 ? (
                                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                            <p className="text-gray-400 text-sm">Nenhum usuário encontrado.</p>
                                        </div>
                                    ) : (
                                        schoolUsers.map(user => (
                                            <div key={user.id} className={`flex items-center justify-between p-3 bg-white border rounded-lg transition-colors shadow-sm ${user.status !== 'ACTIVE' ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${user.status !== 'ACTIVE' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                            {user.name}
                                                            {user.status !== 'ACTIVE' && (
                                                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">
                                                                    BLOQUEADO
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-medium uppercase border border-gray-200">
                                                        {user.role}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleUserStatus(user)}
                                                        className={`h-7 px-2 text-[10px] font-bold uppercase transition-colors ${user.status === 'ACTIVE'
                                                            ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                                            : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                                            }`}
                                                    >
                                                        {user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Inspection & Delete Modal */}
            {selectedSchool && isInspectModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <BarChart2 className="text-blue-600" /> Raio-X: {selectedSchool.name}
                                </h2>
                                <p className="text-sm text-gray-500">Visão geral de dados e zona de perigo.</p>
                            </div>
                            <button onClick={() => setIsInspectModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        {loadingStats ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="animate-spin text-gray-400 h-8 w-8" />
                            </div>
                        ) : schoolStats ? (
                            <div className="space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <p className="text-xs text-blue-600 font-semibold uppercase">Pessoas</p>
                                        <p className="text-2xl font-bold text-blue-900">{schoolStats.people.students + schoolStats.people.staff}</p>
                                        <p className="text-xs text-blue-400">{schoolStats.people.students} Alunos</p>
                                    </div>
                                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                        <p className="text-xs text-emerald-600 font-semibold uppercase">Financeiro</p>
                                        <p className="text-2xl font-bold text-emerald-900">{schoolStats.financial.transactions}</p>
                                        <p className="text-xs text-emerald-400">Transações</p>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                        <p className="text-xs text-purple-600 font-semibold uppercase">Acadêmico</p>
                                        <p className="text-2xl font-bold text-purple-900">{schoolStats.academic.classes}</p>
                                        <p className="text-xs text-purple-400">{schoolStats.academic.enrollments} Matrículas</p>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <p className="text-xs text-orange-600 font-semibold uppercase">Comms</p>
                                        <p className="text-2xl font-bold text-orange-900">{schoolStats.communication.messages}</p>
                                        <p className="text-xs text-orange-400">Mensagens</p>
                                    </div>
                                </div>

                                {/* Detailed Breakdown */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-sm">
                                    <h3 className="font-semibold text-gray-700 mb-2">Detalhamento Técnico</h3>
                                    <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-gray-600">
                                        <div className="flex justify-between"><span>Leads (CRM):</span> <span className="font-mono">{schoolStats.people.leads}</span></div>
                                        <div className="flex justify-between"><span>Staff:</span> <span className="font-mono">{schoolStats.people.staff}</span></div>
                                        <div className="flex justify-between"><span>Notas Lançadas:</span> <span className="font-mono">{schoolStats.academic.grades}</span></div>
                                        <div className="flex justify-between"><span>Chamadas:</span> <span className="font-mono">{schoolStats.academic.attendance}</span></div>
                                        <div className="flex justify-between"><span>Boletos/Parcelas:</span> <span className="font-mono">{schoolStats.financial.installments}</span></div>
                                        <div className="flex justify-between"><span>Relatórios Diários:</span> <span className="font-mono">{schoolStats.operational.reports}</span></div>
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                                    <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2">
                                        <AlertTriangle size={18} /> Zona de Perigo - Exclusão Definitiva
                                    </h3>
                                    <p className="text-sm text-red-600 mb-4">
                                        Esta ação irá <strong>apagar permanentemente</strong> todos os dados listados acima.
                                        Não é possível desfazer. Certifique-se de que a escola não está mais em operação.
                                    </p>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-red-700 uppercase">
                                            Digite <span className="select-all bg-white px-1 border border-red-200 rounded mx-1">{selectedSchool.name}</span> para confirmar:
                                        </label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={deleteConfirmation}
                                                onChange={e => setDeleteConfirmation(e.target.value)}
                                                placeholder={selectedSchool.name}
                                                className="bg-white border-red-300 focus:ring-red-500"
                                            />
                                            <Button
                                                onClick={handleDeleteSchool}
                                                disabled={deleteConfirmation !== selectedSchool.name || deleting}
                                                className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                                            >
                                                {deleting ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><Trash2 size={16} /> Excluir Tudo</span>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">Falha ao carregar dados.</div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};
