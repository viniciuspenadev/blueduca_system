import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { Button } from '../../../components/ui';
import { Save, Bell, Shield, Info, Loader2, Clock, Play } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface CronJobStatus {
    job_id: number;
    jobname: string;
    schedule: string;
    active: boolean;
    last_run_status: string | null;
    last_run_at: string | null;
    next_run_at: string | null;
}

const CronJobCard: FC<{
    title: string;
    description: string;
    jobName: string;
    allowScheduleEdit?: boolean;
}> = ({ title, description, jobName, allowScheduleEdit = false }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [forcing, setForcing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<CronJobStatus | null>(null);
    const [time, setTime] = useState('');

    useEffect(() => {
        fetchStatus();
    }, [jobName]);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('admin_get_cron_job_details', { p_job_name: jobName });
            if (error) throw error;
            if (data && data.length > 0) {
                const job = data[0];
                setStatus(job);

                // Extract HH:mm from cron (assuming mm HH * * *)
                if (allowScheduleEdit && job.schedule) {
                    const parts = job.schedule.split(' ');
                    if (parts.length >= 2) {
                        const m = parseInt(parts[0]);
                        const h = parseInt(parts[1]);

                        // Convert UTC from DB to Local
                        const date = new Date();
                        date.setUTCHours(h, m, 0, 0);
                        setTime(`${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching cron status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleForceExecution = async () => {
        setForcing(true);
        try {
            const { error } = await supabase.rpc('admin_force_job_execution', { p_job_name: jobName });
            if (error) throw error;
            addToast('success', `${title}: Execução manual iniciada!`);
            setTimeout(fetchStatus, 3000);
        } catch (err: any) {
            addToast('error', `Erro ao forçar disparo: ${err.message}`);
        } finally {
            setForcing(false);
        }
    };

    const handleUpdateSchedule = async () => {
        if (!time) return;
        setSaving(true);
        try {
            const [h, m] = time.split(':');

            // Convert Local to UTC for the DB
            const date = new Date();
            date.setHours(parseInt(h), parseInt(m), 0, 0);
            const utcHours = date.getUTCHours();
            const utcMinutes = date.getUTCMinutes();
            const newCron = `${utcMinutes} ${utcHours} * * *`;

            const { error } = await supabase.rpc('admin_update_cron_schedule', {
                p_job_name: jobName,
                p_new_schedule: newCron
            });

            if (error) throw error;
            addToast('success', `${title}: Horário atualizado para ${time}`);
            fetchStatus();
        } catch (err: any) {
            addToast('error', `Erro ao atualizar horário: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full border-t-4 border-t-blue-500">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 leading-tight">{title}</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{description}</p>
                    </div>
                </div>
                {status?.active && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ativo
                    </span>
                )}
            </div>

            <div className="p-6 space-y-5 flex-grow">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Última Execução</p>
                        <p className="text-sm font-semibold text-slate-700">
                            {status?.last_run_at ? new Date(status.last_run_at).toLocaleString('pt-BR') : 'Nunca'}
                        </p>
                        <span className={`text-[10px] font-bold ${status?.last_run_status === 'succeeded' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {status?.last_run_status === 'succeeded' ? 'Sucesso' : status?.last_run_status || 'Pendente'}
                        </span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Configuração</p>
                        <p className="text-sm font-semibold text-slate-700">
                            {allowScheduleEdit ? (time || '--:--') : status?.schedule}
                        </p>
                        <span className="text-[10px] text-slate-400 font-medium">Cron: {status?.schedule}</span>
                    </div>
                </div>

                {allowScheduleEdit && (
                    <div className="space-y-3 pt-2 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Ajustar Agendamento Diário</label>
                        <div className="flex gap-2">
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="flex-grow rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border shadow-sm"
                            />
                            <Button
                                onClick={handleUpdateSchedule}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 shadow-lg shadow-blue-200"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-500 italic leading-tight">Define quando a régua de cobrança será processada no dia.</p>
                    </div>
                )}
            </div>

            <div className="p-6 pt-0 mt-auto">
                <Button
                    onClick={handleForceExecution}
                    disabled={forcing}
                    className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-12 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-slate-200 transition-all active:scale-95"
                >
                    {forcing ? <Loader2 size={16} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                    Executar Manualmente Agora
                </Button>
            </div>
        </div>
    );
};

export const GlobalSystemSettings: FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        enable_immediate_triggers: true,
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'global_notification_config')
                .is('school_id', null)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                setSettings(config);
            }
        } catch (err) {
            console.error('Error loading global settings:', err);
            addToast('error', 'Erro ao carregar configurações globais.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'global_notification_config',
                    value: settings,
                    description: 'Configuração global de notificações do SaaS',
                    school_id: null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key,school_id' });

            if (error) throw error;
            addToast('success', 'Configurações globais salvas com sucesso!');
        } catch (err) {
            console.error('Error saving global settings:', err);
            addToast('error', 'Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in max-w-6xl">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Infraestrutura & Configurações</h1>
                    <p className="text-slate-500 text-sm mt-1">Gerenciamento mestre de automações e regras globais do SaaS.</p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-900/20 px-8 h-12 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Mudanças Globais
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gatilhos Mestres */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full border-t-4 border-t-emerald-500">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                            <Bell size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 leading-tight">Gatilhos Mestres</h2>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Controle Geral de Envios</p>
                        </div>
                    </div>

                    <div className="p-6 flex-grow">
                        <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                            <div className="space-y-0.5">
                                <label className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                    Push Imediato
                                </label>
                                <p className="text-[10px] text-slate-500 leading-tight uppercase font-black tracking-tight opacity-70">
                                    Eventos em tempo real
                                </p>
                            </div>
                            <div className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none cursor-pointer p-1 shadow-inner ${settings.enable_immediate_triggers ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                onClick={() => setSettings({ ...settings, enable_immediate_triggers: !settings.enable_immediate_triggers })}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${settings.enable_immediate_triggers ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </div>

                        <div className="mt-8 bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-4 ring-1 ring-amber-200/50">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                <Info className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="text-[11px] text-amber-900 leading-relaxed font-bold">
                                <span className="text-amber-600 uppercase font-black block mb-1">Nota Crítica</span>
                                Este interruptor é o **Master Switch**. Se desativado, o motor de notificações do banco de dados é pausado para todas as escolas.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Monitor: Agendas */}
                <CronJobCard
                    title="Disparo de Agendas"
                    description="Varredura de Programadas"
                    jobName="dispatch-diaries-job"
                />

                {/* Monitor: Régua de Cobrança */}
                <CronJobCard
                    title="Régua de Cobrança"
                    description="Automação Financeira"
                    jobName="sweep-dunning-daily"
                    allowScheduleEdit={true}
                />
            </div>

            {/* Segurança placeholder */}
            <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center opacity-40 grayscale flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                    <Shield className="w-6 h-6" />
                </div>
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Painel de Segurança Multi-Region & Sandbox</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold italic tracking-tighter">Em breve na v2.8 (Scalation Engine)</p>
            </div>
        </div>
    );
};
