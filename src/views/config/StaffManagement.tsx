
import { type FC, useEffect, useState } from 'react';
import { Users, Search, Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface StaffMember {
    user_id: string;
    role: string;
    profile: {
        name: string;
        email: string;
        avatar_url?: string;
    };
    created_at: string;
}

export const StaffManagement: FC = () => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const { confirm } = useConfirm();

    const [members, setMembers] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        email: '',
        password: '',
        role: 'TEACHER'
    });

    useEffect(() => {
        if (currentSchool?.id) {
            fetchMembers();
        }
    }, [currentSchool?.id]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('school_members')
                .select(`
                    user_id,
                    role,
                    created_at,
                    profile:profiles (
                        name,
                        email
                    )
                `)
                .eq('school_id', currentSchool?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMembers(data as any || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
            addToast('error', 'Erro ao carregar equipe.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMember = async () => {
        if (!newItem.name || !newItem.email || !newItem.password || !newItem.role) {
            addToast('error', 'Preencha todos os campos.');
            return;
        }

        try {
            setCreating(true);

            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: {
                    name: newItem.name,
                    email: newItem.email,
                    password: newItem.password,
                    role: newItem.role,
                    school_id: currentSchool?.id
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            addToast('success', 'Membro adicionado com sucesso!');
            setShowCreateModal(false);
            setNewItem({ name: '', email: '', password: '', role: 'TEACHER' });
            fetchMembers(); // Refresh list

        } catch (error: any) {
            console.error('Error creating member:', error);
            addToast('error', error.message || 'Erro ao criar membro.');
        } finally {
            setCreating(false);
        }
    };

    const handleRemoveMember = async (member: StaffMember) => {
        const isConfirmed = await confirm({
            title: 'Remover Membro',
            message: `Tem certeza que deseja remover ${member.profile.name} da equipe? O usuário perderá o acesso a esta escola.`,
            type: 'warning',
            confirmText: 'Sim, remover'
        });

        if (!isConfirmed) return;

        try {
            // Delete from school_members Only
            const { error } = await supabase
                .from('school_members')
                .delete()
                .eq('school_id', currentSchool?.id)
                .eq('user_id', member.user_id);

            if (error) throw error;

            addToast('success', 'Membro removido.');
            fetchMembers();
        } catch (error) {
            console.error('Error removing member:', error);
            addToast('error', 'Erro ao remover membro.');
        }
    };

    const filteredMembers = members.filter(m =>
        m.profile.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.profile.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleLabel = (role: string) => {
        const check = role.toUpperCase();
        if (check.includes('ADMIN')) return 'Administrador';
        if (check.includes('TEACHER')) return 'Professor';
        if (check.includes('SECRETARY')) return 'Secretaria';
        if (check.includes('COORDINATOR')) return 'Coordenação';
        return role;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestão de Equipe</h1>
                    <p className="text-gray-500">Gerencie os professores e funcionários da sua escola.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition"
                >
                    <Plus className="w-5 h-5" />
                    Novo Membro
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    className="flex-1 outline-none text-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhum membro encontrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMembers.map((member) => (
                        <div key={member.user_id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                                        {member.profile.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 line-clamp-1">{member.profile.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-1">{member.profile.email}</p>
                                    </div>
                                </div>
                                <div className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide 
                                    ${member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {getRoleLabel(member.role)}
                                </div>
                            </div>

                            <hr className="border-gray-100 my-3" />

                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleRemoveMember(member)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1"
                                    title="Remover Acesso"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remover
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Novo Membro da Equipe</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email de Acesso</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={newItem.email}
                                    onChange={e => setNewItem({ ...newItem, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm bg-gray-50"
                                    placeholder="Ex: professor123"
                                    value={newItem.password}
                                    onChange={e => setNewItem({ ...newItem, password: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Defina uma senha e entregue ao funcionário.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={newItem.role}
                                    onChange={e => setNewItem({ ...newItem, role: e.target.value })}
                                >
                                    <option value="TEACHER">Professor</option>
                                    <option value="COORDINATOR">Coordenador</option>
                                    <option value="SECRETARY">Secretaria</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                disabled={creating}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateMember}
                                disabled={creating}
                                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar e Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
