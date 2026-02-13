import { type FC, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Search, Mail, MoreVertical, Loader2, RefreshCw, Plus, X, Ban, CheckCircle, Shield, GraduationCap, Filter } from 'lucide-react';
import { supabase } from '../services/supabase';
import { usePlan } from '../hooks/usePlan';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';

interface DirectoryUser {
    id: string;
    name: string;
    email: string | null;
    type: 'STAFF' | 'STUDENT' | 'GUARDIAN';
    role: string;
    status: string;
    avatar_url?: string;
}

interface UserManagementProps {
    embedded?: boolean;
}

export const UserManagement: FC<UserManagementProps> = ({ embedded = false }) => {
    const { currentSchool } = useAuth();
    const { config } = usePlan(); // Use Plan Hook for limits
    const [users, setUsers] = useState<DirectoryUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<DirectoryUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filters
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'STAFF' | 'GUARDIAN'>('ALL');

    const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Edit/Create State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'TEACHER',
        status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
    });

    const { confirm } = useConfirm();
    const { addToast } = useToast();

    const fetchUsers = async () => {
        setLoading(true);
        if (!currentSchool) return;

        try {
            const { data, error } = await supabase
                .rpc('get_school_directory', { p_school_id: currentSchool.id });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            addToast('error', 'Erro ao carregar diretório');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [currentSchool]);

    useEffect(() => {
        let result = users;

        // 1. Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(user =>
                user.name?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term)
            );
        }

        // 2. Type Filter
        if (typeFilter !== 'ALL') {
            result = result.filter(user => user.type === typeFilter);
        }

        setFilteredUsers(result);
    }, [users, searchTerm, typeFilter]);

    // Helpers
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'STAFF': return <Shield size={16} className="text-purple-600" />;
            case 'STUDENT': return <GraduationCap size={16} className="text-blue-600" />;
            case 'GUARDIAN': return <Users size={16} className="text-emerald-600" />;
            default: return <Users size={16} className="text-gray-400" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'STAFF': return 'Equipe';
            case 'STUDENT': return 'Aluno';
            case 'GUARDIAN': return 'Responsável';
            default: return type;
        }
    };

    const getTypeBadgeVariant = (type: string): 'default' | 'info' | 'success' | 'warning' => {
        switch (type) {
            case 'STAFF': return 'warning';
            case 'STUDENT': return 'info';
            case 'GUARDIAN': return 'success';
            default: return 'default';
        }
    };

    const handleCreateUser = async () => {
        if (!formData.name || !formData.email || !formData.password) {
            addToast('error', 'Preencha todos os campos obrigatórios');
            return;
        }
        if (!currentSchool?.id) return;

        setSaving(true);
        try {
            // 1. Create a TEMPORARY Client to sign up the staff
            // ensuring we don't log out the current admin
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseKey) throw new Error("Missing Env Vars");

            const tempClient = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            // 2. Sign Up User (Auth)
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        role: formData.role
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Falha ao criar usuário (sem dados retornados).");

            // 3. Link to School and Profile (RPC)
            // This runs as the LOGGED IN ADMIN, guaranteeing permissions
            const { error: rpcError } = await supabase.rpc('admin_add_staff_member', {
                p_user_id: authData.user.id,
                p_email: formData.email,
                p_name: formData.name,
                p_role: formData.role,
                p_school_id: currentSchool.id
            });

            if (rpcError) throw rpcError;

            addToast('success', 'Usuário criado com sucesso!');
            setShowCreateModal(false);
            resetForm();
            fetchUsers();
        } catch (error: any) {
            console.error('Error creating user:', error);
            addToast('error', error.message || 'Erro ao criar usuário');
        } finally {
            setSaving(false);
        }
    };

    // NOTE: Update handles STAFF only for now
    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        setSaving(true);

        try {
            // Update Profile Name (common)
            let updates: any = { name: formData.name };

            const { error: profileError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', selectedUser.id);
            if (profileError) throw profileError;

            // If Staff, Update Role/Status
            if (selectedUser.type === 'STAFF') {
                // Using the already existing RPC is safer as it handles both tables
                const { error: rpcError } = await supabase.rpc('admin_add_staff_member', {
                    p_user_id: selectedUser.id,
                    p_email: formData.email,
                    p_name: formData.name,
                    p_role: formData.role,
                    p_school_id: currentSchool?.id
                });

                if (rpcError) throw rpcError;

                // 3. Update Status (If different from ACTIVE, since RPC sets ACTIVE)
                if (formData.status !== 'ACTIVE') {
                    const { error: statusError } = await supabase
                        .from('school_members')
                        .update({ status: formData.status })
                        .eq('user_id', selectedUser.id)
                        .eq('school_id', currentSchool?.id);
                    if (statusError) throw statusError;
                }
            }

            addToast('success', 'Usuário atualizado com sucesso!');
            setShowEditModal(false);
            resetForm();
            fetchUsers();
        } catch (error: any) {
            console.error('Error updating:', error);
            addToast('error', 'Erro ao atualizar');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser || !selectedUser.email) return;
        const isConfirmed = await confirm({
            title: 'Resetar Senha',
            message: `Enviar email de redefinição para ${selectedUser.email}?`,
            type: 'warning',
        });
        if (!isConfirmed) return;

        try {
            setResetting(true);
            await supabase.auth.resetPasswordForEmail(selectedUser.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            addToast('success', 'Email enviado!');
            setShowResetModal(false);
        } catch (error) {
            addToast('error', 'Erro ao enviar email');
        } finally {
            setResetting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            role: 'TEACHER',
            status: 'ACTIVE'
        });
        setSelectedUser(null);
    };

    const openEditModal = (user: DirectoryUser) => {
        setSelectedUser(user);
        setFormData({
            name: user.name,
            email: user.email || '',
            password: '', // Password not editable directly here, reset only
            role: user.role,
            status: (user.status?.toUpperCase() as any) === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
        });
        setShowEditModal(true);
        setActionMenuUser(null);
    };

    return (
        <div className={`space-y-6 animate-fade-in ${!embedded ? 'pb-20' : ''}`}>
            {/* Header / Actions */}
            <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${!embedded ? 'bg-white p-6 rounded-2xl border border-gray-100 shadow-sm' : ''}`}>
                {!embedded ? (
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center border border-brand-100">
                            <Users className="w-6 h-6 text-brand-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestão de Usuários</h1>
                            <p className="text-sm text-gray-500">
                                {filteredUsers.length} usuários encontrados
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                        <Users size={16} />
                        {filteredUsers.length} usuários encontrados
                    </div>
                )}

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={fetchUsers}
                        className="p-2.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                        title="Atualizar Lista"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {(() => {
                        // "Login é Login": Count ALL active profiles (Staff + Guardians)
                        const activeLoginCount = users.filter(u =>
                            (u.type === 'STAFF' || u.type === 'GUARDIAN') &&
                            (u.status === 'ACTIVE' || u.status === 'active')
                        ).length;

                        // Default to 5 if undefined, but user said they set it to 6.
                        // We use the config from usePlan which should be up to date.
                        const maxUsers = config.limits?.max_users || 5;
                        const isLimitReached = activeLoginCount >= maxUsers;

                        return (
                            <div className="relative group">
                                <button
                                    onClick={() => {
                                        if (isLimitReached) {
                                            addToast('error', `Seu plano atingiu o limite de ${maxUsers} logins ativos. Fale com o suporte.`);
                                            return;
                                        }
                                        resetForm();
                                        setShowCreateModal(true);
                                    }}
                                    className={`
                                        flex-1 md:flex-none px-5 py-2.5 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-lg 
                                        ${isLimitReached ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-100'}
                                    `}
                                >
                                    <Plus className="w-5 h-5" />
                                    {isLimitReached ? 'Limite Atingido' : 'Novo Usuário'}
                                </button>
                                {isLimitReached && (
                                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                        Você atingiu o limite de {maxUsers} logins ativos (Equipe + Pais) do seu plano.
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={(e: any) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto">
                    <Filter size={16} className="text-gray-500 mr-2 flex-shrink-0" />
                    {(['ALL', 'STAFF', 'GUARDIAN'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`
                                px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap
                                ${typeFilter === t
                                    ? 'bg-brand-100 text-brand-700 border border-brand-200'
                                    : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                                }
                            `}
                        >
                            {t === 'ALL' ? 'Todos' : getTypeLabel(t)}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Nenhum usuário encontrado</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Função</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((user) => (
                                <tr key={`${user.type}-${user.id}`} className="hover:bg-gray-50/80 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full flex-shrink-0 bg-brand-100 border border-brand-200 flex items-center justify-center overflow-hidden">
                                                <span className="text-brand-700 font-bold text-sm">
                                                    {user.name?.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{user.name}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {getTypeIcon(user.type)}
                                            <Badge variant={getTypeBadgeVariant(user.type)}>
                                                {getTypeLabel(user.type)}
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 font-mono">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(user.status?.toUpperCase() === 'INACTIVE') ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                                <Ban className="w-3 h-3" /> Inativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                                <CheckCircle className="w-3 h-3" /> Ativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                                        <>
                                            <button
                                                onClick={() => setActionMenuUser(actionMenuUser === user.id ? null : user.id)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </button>

                                            {actionMenuUser === user.id && (
                                                <div className="absolute right-8 top-12 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                                                    {/* Edit - Only Staff */}
                                                    {user.type === 'STAFF' && (
                                                        <button onClick={() => openEditModal(user)} className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700">
                                                            <Users className="w-4 h-4" /> Editar Perfil
                                                        </button>
                                                    )}

                                                    {/* Revoke/Restore Access - Both Staff and Guardian */}
                                                    <button
                                                        onClick={() => {
                                                            const newStatus = (user.status === 'active' || user.status === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
                                                            const actionLabel = newStatus === 'ACTIVE' ? 'Restaurar Acesso' : 'Revogar Acesso';

                                                            confirm({
                                                                title: 'Alterar Acesso',
                                                                message: `Tem certeza que deseja ${actionLabel.toLowerCase()} de ${user.name}?`,
                                                                type: 'warning'
                                                            }).then(async (confirmed) => {
                                                                if (confirmed && currentSchool) {
                                                                    try {
                                                                        const { error } = await supabase.rpc('toggle_school_access', {
                                                                            p_school_id: currentSchool.id,
                                                                            p_user_id: user.id,
                                                                            p_type: user.type,
                                                                            p_status: newStatus
                                                                        });

                                                                        if (error) throw error;

                                                                        addToast('success', `${actionLabel} realizado com sucesso!`);
                                                                        // Optimistic update
                                                                        setUsers(users.map(u =>
                                                                            u.id === user.id ? { ...u, status: newStatus } : u
                                                                        ));
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                        addToast('error', 'Erro ao alterar status');
                                                                    }
                                                                }
                                                                setActionMenuUser(null);
                                                            });
                                                        }}
                                                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm border-t border-gray-50 ${user.status === 'active' || user.status === 'ACTIVE' ? 'text-red-600' : 'text-green-600'
                                                            }`}
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                        {user.status === 'active' || user.status === 'ACTIVE' ? 'Revogar Acesso' : 'Restaurar Acesso'}
                                                    </button>

                                                    {/* Generic Reset Password */}
                                                    <button onClick={() => { setSelectedUser(user); setShowResetModal(true); setActionMenuUser(null); }} className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-50">
                                                        <Mail className="w-4 h-4" /> Resetar Senha
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Novo Usuário</h3>
                            <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
                                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                                    <input value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo</label>
                                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })} className="w-full px-4 py-2 border rounded-xl bg-white">
                                        <option value="TEACHER">Professor</option>
                                        <option value="ADMIN">Administrador</option>
                                        <option value="SECRETARY">Secretaria</option>
                                        <option value="COORDINATOR">Coordenação</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleCreateUser} disabled={saving} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold mt-4">
                                {saving ? <Loader2 className="animate-spin inline" /> : 'Criar Usuário'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal - Only for Staff */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Editar Usuário</h3>
                            <button onClick={() => setShowEditModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
                                    <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo</label>
                                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })} className="w-full px-4 py-2 border rounded-xl bg-white">
                                        <option value="TEACHER">Professor</option>
                                        <option value="ADMIN">Administrador</option>
                                        <option value="SECRETARY">Secretaria</option>
                                        <option value="COORDINATOR">Coordenação</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-4 py-2 border rounded-xl bg-white">
                                        <option value="ACTIVE">Ativo</option>
                                        <option value="INACTIVE">Inativo</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleUpdateUser} disabled={saving} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold mt-4">
                                {saving ? <Loader2 className="animate-spin inline" /> : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Modal */}
            {showResetModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Resetar Senha</h3>
                        <p className="text-sm text-gray-600 mb-6">Confirmar envio de email para {selectedUser.email}?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancelar</button>
                            <button onClick={handleResetPassword} disabled={resetting} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg justify-center flex">{resetting ? <Loader2 className="animate-spin" /> : 'Enviar'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple Input override for better UI
const Input = (props: any) => <input {...props} className={`w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all ${props.className}`} />;
