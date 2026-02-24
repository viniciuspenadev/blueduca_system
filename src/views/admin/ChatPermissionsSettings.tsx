import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Loader2, Shield, Building, DollarSign } from 'lucide-react';

interface StaffMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface ChannelPermission {
    staff_id: string;
    channel_type: string;
}

const CHANNELS = [
    { id: 'SECRETARIAT', label: 'Secretaria', description: 'Atendimento geral e documentação', icon: Building },
    { id: 'FINANCE', label: 'Financeiro', description: 'Mensalidades, negociações e boletos', icon: DollarSign },
];

export const ChatPermissionsSettings: FC = () => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();

    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [permissions, setPermissions] = useState<ChannelPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (currentSchool) {
            loadData();
        }
    }, [currentSchool]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all staff members using the existing directory RPC
            const { data: usersData, error: usersError } = await supabase
                .rpc('get_school_directory', { p_school_id: currentSchool!.id });

            if (usersError) throw usersError;

            // Filter only active staff members
            const staffList = (usersData || [])
                .filter((u: any) => u.type === 'STAFF' && (u.status === 'ACTIVE' || u.status === 'active'))
                .map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role
                }));

            setStaff(staffList);

            // 2. Fetch current permissions
            const { data: permsData, error: permsError } = await supabase
                .from('chat_channel_permissions')
                .select('staff_id, channel_type')
                .eq('school_id', currentSchool!.id);

            if (permsError) throw permsError;

            setPermissions(permsData || []);
        } catch (error) {
            console.error('Error loading chat permissions:', error);
            addToast('error', 'Erro ao carregar permissões de chat');
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (staffId: string, channelType: string) => {
        // SUPER_ADMIN and ADMIN have access to all channels implicitly by RLS for viewing, 
        // but for assigning them explicitly in the UI to appear in the "assigned list" we still check the table.
        // Actually, let's just use the table data to be explicit.
        return permissions.some(p => p.staff_id === staffId && p.channel_type === channelType);
    };

    const togglePermission = async (staffId: string, channelType: string, currentStatus: boolean) => {
        const toggleKey = `${staffId}-${channelType}`;
        setToggling(prev => ({ ...prev, [toggleKey]: true }));

        try {
            if (currentStatus) {
                // Remove permission
                const { error } = await supabase
                    .from('chat_channel_permissions')
                    .delete()
                    .match({
                        school_id: currentSchool!.id,
                        staff_id: staffId,
                        channel_type: channelType
                    });

                if (error) throw error;

                setPermissions(prev => prev.filter(p => !(p.staff_id === staffId && p.channel_type === channelType)));
                addToast('success', 'Permissão removida com sucesso');
            } else {
                // Add permission
                const { error } = await supabase
                    .from('chat_channel_permissions')
                    .insert({
                        school_id: currentSchool!.id,
                        staff_id: staffId,
                        channel_type: channelType
                    });

                if (error) throw error;

                setPermissions(prev => [...prev, { staff_id: staffId, channel_type: channelType }]);
                addToast('success', 'Permissão concedida com sucesso');
            }
        } catch (error) {
            console.error('Error toggling permission:', error);
            addToast('error', 'Erro ao atualizar permissão');
        } finally {
            setToggling(prev => ({ ...prev, [toggleKey]: false }));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex gap-4">
                <div className="p-2 bg-blue-100 rounded-lg h-fit text-blue-600">
                    <Shield className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-blue-900">Delegação de Atendimento</h3>
                    <p className="text-sm text-blue-800 mt-1">
                        Defina quais funcionários têm acesso a responder e visualizar as mensagens de cada departamento.
                        Super Administradores e Diretores têm acesso global. O atendimento pedagógico (Turmas) é gerido automaticamente pelos professores vinculados a cada turma.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {CHANNELS.map(channel => {
                    const Icon = channel.icon;
                    return (
                        <div key={channel.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-700">
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{channel.label}</h3>
                                    <p className="text-sm text-gray-500">{channel.description}</p>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {staff.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        Nenhum funcionário ativo encontrado.
                                    </div>
                                ) : (
                                    staff.map(member => {
                                        const isAssigned = hasPermission(member.id, channel.id);
                                        const isToggling = toggling[`${member.id}-${channel.id}`];

                                        return (
                                            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-sm">{member.name}</div>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">{member.role}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {isToggling ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                                    ) : (
                                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isAssigned ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {isAssigned ? 'Responsável' : 'Sem Acesso'}
                                                        </span>
                                                    )}
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isAssigned}
                                                            onChange={() => togglePermission(member.id, channel.id, isAssigned)}
                                                            disabled={isToggling}
                                                            className="sr-only peer"
                                                        />
                                                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 ${isToggling ? 'opacity-50' : ''}`}></div>
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
