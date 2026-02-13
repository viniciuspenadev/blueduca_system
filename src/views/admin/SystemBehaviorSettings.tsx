import { type FC, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui';
import { Save, Clock, Info, Settings, Lock } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface SystemBehaviorSettingsProps {
    isProvisioned?: boolean;
}

export const SystemBehaviorSettings: FC<SystemBehaviorSettingsProps> = ({ isProvisioned = false }) => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [diaryTime, setDiaryTime] = useState('17:00');
    const [pushMode, setPushMode] = useState<'scheduled' | 'immediate' | 'disabled'>('scheduled');

    // Effect to load settings
    useEffect(() => {
        if (currentSchool && isProvisioned) { // Only fetch if provisioned
            fetchSettings();
        } else {
            setLoading(false);
        }
    }, [currentSchool, isProvisioned]);

    const fetchSettings = async () => {
        try {
            const { data: settings, error } = await supabase
                .from('app_settings')
                .select('*')
                .in('key', ['diary_release_time', 'diary_push_mode'])
                .eq('school_id', currentSchool?.id);

            if (error) throw error;

            if (settings) {
                const timeSetting = settings.find(s => s.key === 'diary_release_time');
                if (timeSetting) setDiaryTime(timeSetting.value);

                const modeSetting = settings.find(s => s.key === 'diary_push_mode');
                if (modeSetting) setPushMode(modeSetting.value as any);
            }
        } catch (err) {
            console.error('Error loading behavior settings:', err);
            addToast('error', 'Erro ao carregar configurações de rotina.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = [
                {
                    key: 'diary_release_time',
                    value: diaryTime,
                    description: 'Horário de liberação do diário diário para os pais',
                    school_id: currentSchool?.id,
                    updated_at: new Date().toISOString()
                },
                {
                    key: 'diary_push_mode',
                    value: pushMode,
                    description: 'Modo de disparo do push da agenda (immediate, scheduled, disabled)',
                    school_id: currentSchool?.id,
                    updated_at: new Date().toISOString()
                }
            ];

            const { error } = await supabase
                .from('app_settings')
                .upsert(updates, { onConflict: 'key,school_id' });

            if (error) throw error;
            addToast('success', 'Configurações de rotina salvas com sucesso!');
        } catch (err) {
            console.error('Error saving behavior settings:', err);
            addToast('error', 'Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    // Combined Hire Screen
    if (!isProvisioned) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center max-w-3xl mx-auto mt-8">
                    <div className="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Agenda Digital Não Contratada</h2>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                        Substitua a agenda de papel. Envie comunicados, fotos e a rotina diária dos alunos diretamente para o aplicativo dos pais.
                    </p>
                    <Button className="bg-brand-600 text-white shadow-lg hover:bg-brand-700">
                        Fale com um Consultor
                    </Button>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="p-4 text-center text-gray-500">Carregando...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-5 h-5 text-brand-600" />
                        <h2 className="font-semibold text-gray-900">Agenda Digital & Push</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Configure como e quando os pais devem receber as notificações da agenda.
                    </p>
                </div>

                <div className="p-6 space-y-8">
                    {/* Modo de Envio */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">
                            Modo de Disparo
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { id: 'immediate', label: 'Imediato', desc: 'Envia assim que salvar' },
                                { id: 'scheduled', label: 'Agendado', desc: 'Respeita o horário' },
                                { id: 'disabled', label: 'Desativado', desc: 'Não envia push' }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setPushMode(mode.id as any)}
                                    className={`
                                        p-4 rounded-xl border-2 text-left transition-all
                                        ${pushMode === mode.id
                                            ? 'border-brand-600 bg-brand-50 shadow-sm'
                                            : 'border-gray-100 bg-white hover:border-gray-200'}
                                    `}
                                >
                                    <h4 className={`font-bold text-sm ${pushMode === mode.id ? 'text-brand-700' : 'text-gray-900'}`}>
                                        {mode.label}
                                    </h4>
                                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-medium">
                                        {mode.desc}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Horário (Só mostra se for agendado) */}
                    {pushMode === 'scheduled' && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Horário de Liberação
                            </label>
                            <div className="flex gap-4 max-w-md">
                                <input
                                    type="time"
                                    value={diaryTime}
                                    onChange={(e) => setDiaryTime(e.target.value)}
                                    className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-3 border"
                                />
                            </div>
                            <p className="mt-3 text-xs text-gray-500 flex items-center gap-1.5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <Info className="w-4 h-4 text-brand-500" />
                                O push será enviado apenas no primeiro salvamento após este horário.
                            </p>
                        </div>
                    )}

                    {pushMode === 'immediate' && (
                        <div className="animate-in slide-in-from-top-2 duration-300 bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 items-start">
                            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                No modo imediato, cada vez que o professor salvar a agenda, uma notificação será enviada para o pai na hora. Use com cautela para não enviar múltiplos avisos ao editar.
                            </p>
                        </div>
                    )}

                    <div className="pt-4 border-t border-gray-100">
                        <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto bg-brand-600 text-white min-w-[200px] h-12 rounded-xl font-bold shadow-lg shadow-brand-200">
                            {saving ? <Settings className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                            {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
