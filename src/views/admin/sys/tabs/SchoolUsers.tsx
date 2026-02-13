import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import { Search, Filter, Shield, GraduationCap, Users, User, Mail, Loader2 } from 'lucide-react';
import { Input } from '../../../../components/ui';
import { Badge } from '../../../../components/ui/Badge';

interface Props {
    school: any; // We receive _school prop but might not use currently, using school ID from context/props if needed or useParams
}

interface DirectoryUser {
    id: string;
    name: string;
    email: string | null;
    type: 'STAFF' | 'STUDENT' | 'GUARDIAN';
    role: string;
    status: string;
    last_sign_in_at?: string | null;
    created_at?: string | null;
}

export const SchoolUsers: React.FC<Props> = ({ school }) => {
    const [users, setUsers] = useState<DirectoryUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'STAFF' | 'STUDENT' | 'GUARDIAN'>('ALL');

    useEffect(() => {
        if (school?.id) {
            fetchUsers();
        }
    }, [school?.id]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .rpc('get_school_directory', { p_school_id: school.id });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching directory:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || user.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'STAFF': return <Shield size={16} className="text-purple-600" />;
            case 'STUDENT': return <GraduationCap size={16} className="text-blue-600" />;
            case 'GUARDIAN': return <Users size={16} className="text-emerald-600" />;
            default: return <User size={16} className="text-gray-400" />;
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
            case 'STAFF': return 'warning'; // Purple usually, but warning is close (yellow/amber). Custom class better?
            case 'STUDENT': return 'info';
            case 'GUARDIAN': return 'success';
            default: return 'default';
        }
    };

    const handleStatusToggle = async (user: DirectoryUser) => {
        const newStatus = (user.status === 'active' || user.status === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
        const actionLabel = newStatus === 'ACTIVE' ? 'Restaurar Acesso' : 'Revogar Acesso';

        if (!confirm(`Tem certeza que deseja ${actionLabel.toLowerCase()} de ${user.name}?`)) return;

        try {
            const { error } = await supabase.rpc('toggle_school_access', {
                p_school_id: school.id,
                p_user_id: user.id,
                p_type: user.type,
                p_status: newStatus
            });

            if (error) throw error;

            // Optimistic update
            setUsers(users.map(u =>
                u.id === user.id ? { ...u, status: newStatus } : u
            ));

        } catch (error) {
            console.error('Error toggling status:', error);
            alert('Erro ao alterar status do usuário');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        placeholder="Buscar por nome ou email..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
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

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-500" />
                        <p>Carregando diretório...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <Users className="w-12 h-12 mb-4 opacity-50" />
                        <p>Nenhum usuário encontrado com os filtros atuais.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
                                    <th className="px-6 py-4">Usuário</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Função / Relacionamento</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Último Acesso</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map((user) => (
                                    <tr key={`${user.type}-${user.id}`} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border border-gray-200">
                                                    {user.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{user.name}</p>
                                                    {user.email && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                                            <Mail size={12} /> {user.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getTypeIcon(user.type)}
                                                <Badge variant={getTypeBadgeVariant(user.type)}>
                                                    {getTypeLabel(user.type)}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 font-mono">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`
                                                inline-block w-2.5 h-2.5 rounded-full mr-2
                                                ${user.status === 'active' || user.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}
                                            `} />
                                            <span className="text-sm text-gray-600 capitalize">
                                                {user.status === 'active' || user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-700">
                                                {user.last_sign_in_at ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {new Date(user.last_sign_in_at).toLocaleDateString('pt-BR')}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(user.last_sign_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Nunca acessou</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleStatusToggle(user)}
                                                className={`text-sm font-medium hover:underline transition-opacity ${user.status === 'active' || user.status === 'ACTIVE'
                                                    ? 'text-red-600 hover:text-red-800'
                                                    : 'text-green-600 hover:text-green-800'
                                                    }`}
                                            >
                                                {user.status === 'active' || user.status === 'ACTIVE' ? 'Revogar' : 'Restaurar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
                Mostrando {filteredUsers.length} de {users.length} registros encontrados.
            </p>
        </div>
    );
};
