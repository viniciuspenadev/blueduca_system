import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import {
    MessageSquare,
    CheckCircle,
    XCircle,
    Clock,
    Search,
    Eye,
    ExternalLink,
    AlertTriangle
} from 'lucide-react';
import { Card, Button } from '../../../../components/ui';

import { NotificationTemplatesTab } from '../../NotificationTemplatesTab';

interface SchoolWhatsAppLogsProps {
    school: any;
}

export const SchoolWhatsAppLogs: React.FC<SchoolWhatsAppLogsProps> = ({ school }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        success: 0,
        failed: 0,
        activeSteps: 0
    });
    const [activeInternalTab, setActiveInternalTab] = useState<'logs' | 'templates'>('logs');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (school?.id) {
            fetchStats();
            fetchLogs();
        }
    }, [school?.id]);

    const fetchStats = async () => {
        try {
            // 1. Get Log Stats
            const { data: logData, error: logError } = await supabase
                .from('dunning_logs')
                .select('status', { count: 'exact' })
                .eq('school_id', school.id);

            if (logError) throw logError;

            const total = logData?.length || 0;
            const success = logData?.filter(l => l.status === 'SUCCESS').length || 0;
            const failed = total - success;

            // 2. Get Active Steps
            const { count: stepCount } = await supabase
                .from('dunning_steps')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', school.id)
                .eq('active', true);

            setStats({
                total,
                success,
                failed,
                activeSteps: stepCount || 0
            });
        } catch (err) {
            console.error('Error fetching dunning stats:', err);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('dunning_logs')
                .select(`
                    *,
                    step:dunning_steps (template_key, event_type),
                    installment:installments!dunning_logs_installment_id_fkey (id, due_date, value)
                `)
                .eq('school_id', school.id)
                .order('sent_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error('Error fetching dunning logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const message = log.metadata?.message?.toLowerCase() || '';
        const instId = log.installment?.id?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return message.includes(search) || instId.includes(search);
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Internal Tabs */}
            <div className="flex gap-4 border-b border-gray-100">
                <button
                    onClick={() => setActiveInternalTab('logs')}
                    className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeInternalTab === 'logs' ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Relatório de Disparos
                </button>
                <button
                    onClick={() => setActiveInternalTab('templates')}
                    className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeInternalTab === 'templates' ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Modelos de Mensagem (Global)
                </button>
            </div>

            {activeInternalTab === 'logs' ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="p-4 bg-white border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <MessageSquare size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Envios</p>
                                <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
                            </div>
                        </Card>

                        <Card className="p-4 bg-white border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sucesso</p>
                                <h3 className="text-2xl font-bold text-gray-900">{stats.success}</h3>
                            </div>
                        </Card>

                        <Card className="p-4 bg-white border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Falhas</p>
                                <h3 className="text-2xl font-bold text-gray-900">{stats.failed}</h3>
                            </div>
                        </Card>

                        <Card className="p-4 bg-white border-gray-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                                <Clock size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Regras Ativas</p>
                                <h3 className="text-2xl font-bold text-gray-900">{stats.activeSteps}</h3>
                            </div>
                        </Card>
                    </div>

                    {/* Logs Table Area */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Clock size={18} className="text-gray-400" />
                                Histórico de Disparos
                            </h3>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar no histórico..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">Data / Hora</th>
                                        <th className="px-6 py-3">Tipo / Template</th>
                                        <th className="px-6 py-3">Mensagem</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full" /></td>
                                            </tr>
                                        ))
                                    ) : filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                                                Nenhum disparo registrado para esta escola.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {new Date(log.sent_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(log.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${log.step?.event_type === 'CREATION'
                                                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                                                        : 'bg-blue-50 text-blue-600 border-blue-100'
                                                        }`}>
                                                        {log.step?.event_type === 'CREATION' ? 'Gatilho' : 'Agendado'}
                                                    </span>
                                                    <p className="text-xs text-gray-500 font-medium mt-1">{log.step?.template_key}</p>
                                                </td>
                                                <td className="px-6 py-4 max-w-xs xl:max-w-md">
                                                    <p className="text-xs text-gray-600 line-clamp-2 italic">
                                                        "{log.metadata?.message || 'Conteúdo não registrado'}"
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {log.status === 'SUCCESS' ? (
                                                        <div className="flex items-center gap-1.5 text-green-600">
                                                            <CheckCircle size={14} />
                                                            <span className="text-xs font-bold uppercase tracking-tighter">Entregue</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-red-600 group relative">
                                                            <XCircle size={14} />
                                                            <span className="text-xs font-bold uppercase tracking-tighter">Falha</span>
                                                            <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50 w-48">
                                                                {log.error_message || 'Erro desconhecido na API'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-8 h-8 p-0"
                                                            onClick={() => {
                                                                const phone = log.metadata?.phone || '';
                                                                if (phone) window.open(`https://wa.me/${phone}`, '_blank');
                                                            }}
                                                        >
                                                            <ExternalLink size={14} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-8 h-8 p-0"
                                                        >
                                                            <Eye size={14} />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 mt-6">
                        <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                        <p className="text-xs text-amber-800 font-medium">
                            **Nota**: Estes modelos são globais e afetam todas as escolas do sistema.
                        </p>
                    </div>
                </>
            ) : (
                <div className="animate-fade-in">
                    <NotificationTemplatesTab />
                </div>
            )}
        </div>
    );
};
