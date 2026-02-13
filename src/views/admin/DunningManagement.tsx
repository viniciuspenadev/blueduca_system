import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Button, Badge } from '../../components/ui';
import { DunningTimelineEditor, type DunningStep } from './DunningTimelineEditor';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Zap, Clock, ShieldCheck, DollarSign, Save, Loader2, Lock } from 'lucide-react';
import { usePlan } from '../../hooks/usePlan';

export const DunningManagement: FC = () => {
    const { addToast } = useToast();
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { hasModule } = usePlan();

    // Filter/Config state
    const [steps, setSteps] = useState<DunningStep[]>([]);
    const [isActive, setIsActive] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'history'>('config');
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const templates = [
        { key: 'finance_on_created', label: 'Aviso de Cobrança Gerada (Gatilho)' },
        { key: 'finance_due_reminder', label: 'Lembrete de Vencimento' },
        { key: 'finance_on_due', label: 'Aviso de Vencimento Hoje' },
        { key: 'finance_overdue', label: 'Aviso de Atraso' },
    ];

    useEffect(() => {
        if (currentSchool) {
            fetchConfig();
        }
    }, [currentSchool]);

    const fetchConfig = async () => {
        if (!currentSchool) return;
        setLoading(true);
        try {
            // 1. Fetch Steps from dedicated table
            const { data: stepsData, error: stepsError } = await supabase
                .from('dunning_steps')
                .select('*')
                .eq('school_id', currentSchool.id)
                .order('day_offset', { ascending: true });

            if (stepsError) throw stepsError;

            if (stepsData && stepsData.length > 0) {
                setSteps(stepsData);
            } else {
                // Initial steps if empty
                setSteps([
                    { id: '0', day_offset: 0, event_type: 'CREATION', template_key: 'finance_on_created', active: true, use_custom_message: false, custom_message: '' },
                    { id: '1', day_offset: -3, event_type: 'DUE_DATE', template_key: 'finance_due_reminder', active: true, use_custom_message: false, custom_message: '' },
                    { id: '2', day_offset: 0, event_type: 'DUE_DATE', template_key: 'finance_on_due', active: true, use_custom_message: false, custom_message: '' },
                    { id: '3', day_offset: 5, event_type: 'DUE_DATE', template_key: 'finance_overdue', active: true, use_custom_message: false, custom_message: '' }
                ]);
            }

            // 2. Fetch Active Status from settings
            const { data: statusData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('school_id', currentSchool.id)
                .eq('key', 'finance_dunning_active')
                .maybeSingle();

            if (statusData) setIsActive(!!statusData.value);

        } catch (error: any) {
            console.error('Error fetching config:', error);
            addToast('error', 'Erro ao carregar régua de cobrança');
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        if (!currentSchool) return;
        setLoadingLogs(true);
        try {
            const { data, error } = await supabase
                .from('dunning_logs')
                .select(`
                    id, status, error_message, metadata,
                    installments (
                        id, value, due_date,
                        enrollments (candidate_name)
                    ),
                    dunning_steps (day_offset, event_type)
                `)
                .eq('school_id', currentSchool.id)
                .order('id', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            console.error('Error fetching logs:', error);
            addToast('error', 'Erro ao carregar histórico');
        } finally {
            setLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'history') {
            fetchLogs();
        }
    }, [activeTab]);

    const handleSave = async (updatedSteps?: DunningStep[]) => {
        if (!currentSchool) return;
        const stepsToSave = updatedSteps || steps;
        setSaving(true);
        try {
            // 1. First cleanup old steps to avoid conflicts and maintain clean state
            const { error: deleteError } = await supabase
                .from('dunning_steps')
                .delete()
                .eq('school_id', currentSchool.id);

            if (deleteError) throw deleteError;

            // 2. Insert new steps
            const payload = stepsToSave.map(s => ({
                school_id: currentSchool.id,
                day_offset: s.day_offset,
                event_type: s.event_type || 'DUE_DATE',
                template_key: s.template_key,
                custom_message: s.custom_message || '',
                use_custom_message: !!s.use_custom_message,
                active: !!s.active
            }));

            const { error: insertError } = await supabase
                .from('dunning_steps')
                .insert(payload);

            if (insertError) throw insertError;

            // 3. Save Active Status
            const { error: error2 } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'finance_dunning_active',
                    value: isActive,
                    school_id: currentSchool.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key,school_id' });

            if (error2) throw error2;

            addToast('success', 'Régua de cobrança atualizada!');
        } catch (error: any) {
            console.error('Error saving:', error);
            addToast('error', 'Erro ao salvar alterações: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async () => {
        const next = !isActive;
        setIsActive(next);
        setSaving(true);
        try {
            await supabase
                .from('app_settings')
                .upsert({
                    key: 'finance_dunning_active',
                    value: next,
                    school_id: currentSchool?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key,school_id' });

            addToast('success', next ? 'Automação Ativada!' : 'Automação Pausada.');
        } catch (e) {
            addToast('error', 'Erro ao alterar status');
        } finally {
            setSaving(false);
        }
    };

    if (!hasModule('dunning')) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-sm">
                <Lock className="w-10 h-10 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Módulo Não Contratado</h2>
            <p className="text-gray-500 max-w-sm mb-8">
                A Régua de Cobrança Automática é um recurso exclusivo. Entre em contato com nosso suporte para habilitar esta funcionalidade em sua escola.
            </p>
            <Button
                onClick={() => window.open('https://wa.me/seu-suporte', '_blank')}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-8"
            >
                Solicitar Upgrade agora
            </Button>
        </div>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest">Carregando Régua de Cobrança...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        Régua de Cobrança
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">Configure a jornada de notificações automáticas via WhatsApp.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 mr-4">
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'config' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Configuração
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Histórico de Envios
                        </button>
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => activeTab === 'config' ? fetchConfig() : fetchLogs()}
                        className="bg-white text-slate-600 font-bold text-xs uppercase"
                    >
                        {activeTab === 'config' ? 'Descartar' : 'Atualizar'}
                    </Button>
                    {activeTab === 'config' && (
                        <Button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs uppercase px-8 shadow-lg shadow-brand-600/20"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Régua
                        </Button>
                    )}
                </div>
            </div>

            {/* Strategic Banner */}
            <div className="bg-gradient-to-br from-brand-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-brand-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Zap className="w-32 h-32" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="w-5 h-5 text-brand-200" />
                            <span className="text-xs font-bold uppercase tracking-widest text-brand-100">Inteligência Financeira</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Combata a Inadimplência com Automação</h2>
                        <p className="text-sm text-brand-50 font-medium leading-relaxed opacity-90">
                            Configure lembretes estratégicos que acompanham o aluno desde a geração do boleto até o pós-vencimento.
                            Mensagens automáticas reduzem o esquecimento e aumentam a liquidez da sua escola.
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                        <div className="flex items-center justify-between gap-8 mb-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-brand-200 uppercase">Status do Fluxo</span>
                                <span className="text-sm font-bold">{isActive ? 'EM OPERAÇÃO' : 'FLUXO PAUSADO'}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={toggleActive}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-white/20 rounded-full peer peer-checked:bg-emerald-400 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {activeTab === 'config' ? (
                <>
                    <div className={`transition-all duration-500 ${!isActive ? 'grayscale opacity-50' : ''}`}>
                        <DunningTimelineEditor
                            steps={steps}
                            onChange={(newSteps) => {
                                setSteps(newSteps);
                            }}
                            templates={templates}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-1">Timing Perfeito</h4>
                                <p className="text-xs text-gray-500 font-medium">Avisar 3 dias antes ajuda o responsável a se organizar financeiramente.</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-1">Ação Imediata</h4>
                                <p className="text-xs text-gray-500 font-medium">No dia do vencimento, envie o link direto do boleto para facilitar o pagamento.</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-1">Pós-cobrança</h4>
                                <p className="text-xs text-gray-500 font-medium">Após 5 dias, use um tom mais resolutivo e ofereça ajuda para regularizar.</p>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Aluno</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Passo</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Mensagem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingLogs ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-brand-300 mx-auto mb-3" />
                                            <p className="text-xs font-bold text-gray-400 uppercase">Consultando histórico...</p>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-gray-400 font-medium">
                                            Nenhum log de disparo encontrado.
                                        </td>
                                    </tr>
                                ) : logs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-gray-700">
                                                {log.installments?.enrollments?.candidate_name || 'Desconhecido'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={!log.dunning_steps ? 'default' : log.dunning_steps.day_offset <= 0 ? (log.dunning_steps.day_offset === 0 ? 'danger' : 'warning') : 'info'} className="text-[10px]">
                                                {!log.dunning_steps ? 'Passo Deletado' :
                                                    log.dunning_steps.event_type === 'CREATION' ? 'Gatilho' :
                                                        log.dunning_steps.day_offset === 0 ? 'No Dia' :
                                                            log.dunning_steps.day_offset < 0 ? `${Math.abs(log.dunning_steps.day_offset)}d Antes` :
                                                                `${log.dunning_steps.day_offset}d Depois`}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={log.status === 'SUCCESS' ? 'success' : 'danger'} className="text-[10px]">
                                                {log.status}
                                            </Badge>
                                            {log.error_message && (
                                                <p className="text-[9px] text-red-500 mt-1 font-medium">{log.error_message}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-[10px] text-gray-500 font-medium italic line-clamp-2" title={log.metadata?.message}>
                                                {log.metadata?.message || 'Nenhum detalhe'}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
