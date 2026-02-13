import { type FC, useState, useEffect } from 'react';
import { Save, Clock, Info, Settings, MessageSquare, School, DollarSign } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui';
import { CommunicationSettings } from './CommunicationSettings';
import { SchoolInfoSettings } from './SchoolInfoSettings';
import { FinancialSettingsTab } from './FinancialSettingsTab';

import { useAuth } from '../../contexts/AuthContext';
import { usePlan } from '../../hooks/usePlan';

export const GeneralSettings: FC = () => {
    const { currentSchool } = useAuth();
    const { hasModule } = usePlan();
    const [activeTab, setActiveTab] = useState<'school' | 'global' | 'communication' | 'finance'>('finance');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [diaryTime, setDiaryTime] = useState('17:00');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (currentSchool) {
            fetchSettings();
        }
    }, [currentSchool]);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'diary_release_time')
                .eq('school_id', currentSchool?.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                setDiaryTime(data.value);
            }
        } catch (err) {
            console.error('Error loading settings:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGlobal = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'diary_release_time',
                    value: diaryTime,
                    description: 'Horário de liberação do diário diário para os pais',
                    school_id: currentSchool?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key,school_id' });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Configurações globais salvas com sucesso!' });

            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error('Error saving settings:', err);
            setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Main Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações do Sistema</h1>
                <p className="text-gray-500">Gerencie todos os aspectos globais e integrações da plataforma.</p>
            </div>

            {/* Notification Banner */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                    <Info className="w-5 h-5" />
                    {message.text}
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="border-b border-gray-200 overflow-x-auto">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('school')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === 'school'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <School className="w-4 h-4" />
                        Dados da Escola
                    </button>

                    <button
                        onClick={() => setActiveTab('global')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === 'global'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <Settings className="w-4 h-4" />
                        Geral & Rotina
                    </button>

                    <button
                        onClick={() => setActiveTab('communication')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === 'communication'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <MessageSquare className="w-4 h-4" />
                        WhatsApp & Comunicação
                    </button>

                    <button
                        onClick={() => setActiveTab('finance')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                            ${activeTab === 'finance'
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        <DollarSign className="w-4 h-4" />
                        Financeiro
                    </button>
                </nav>
            </div>

            {/* Tab: School Info */}
            {activeTab === 'school' && (
                <SchoolInfoSettings />
            )}

            {/* Tab: Global Settings */}
            {activeTab === 'global' && (
                <div className="space-y-6 animate-fade-in">

                    {/* Modules Config Card (NEW) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-2xl">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Settings className="w-5 h-5 text-brand-600" />
                                <h2 className="font-semibold text-gray-900">Módulos do Sistema</h2>
                            </div>
                            <p className="text-sm text-gray-500">
                                Ative ou desative funcionalidades conforme a necessidade da escola.
                            </p>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <h3 className="font-medium text-gray-900">Módulo Cardápio (Alimentação)</h3>
                                    <p className="text-sm text-gray-500">Habilita o gerenciamento e visualização de cardápios.</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!currentSchool) return;
                                        const newConfig = { ...currentSchool.config_modules, menu: !currentSchool.config_modules?.menu };

                                        // Update Local State (Optimistic)
                                        // ideally we update context but a refresh works.

                                        const { error } = await supabase
                                            .from('schools')
                                            .update({ config_modules: newConfig })
                                            .eq('id', currentSchool.id);

                                        if (error) {
                                            alert('Erro ao atualizar modulo');
                                        } else {
                                            window.location.reload(); // Force reload to apply layout changes
                                        }
                                    }}
                                    className={`
                                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2
                                        ${currentSchool?.config_modules?.menu ? 'bg-brand-600' : 'bg-gray-200'}
                                    `}
                                >
                                    <span
                                        className={`
                                            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                            ${currentSchool?.config_modules?.menu ? 'translate-x-5' : 'translate-x-0'}
                                        `}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Diary Settings Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-2xl">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-5 h-5 text-brand-600" />
                                <h2 className="font-semibold text-gray-900">Diário Digital</h2>
                            </div>
                            <p className="text-sm text-gray-500">
                                Controle de horário para liberação automática das atualizações e notificações.
                            </p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="max-w-md">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Horário de Liberação (Notificações)
                                </label>
                                <div className="flex gap-4">
                                    <input
                                        type="time"
                                        value={diaryTime}
                                        onChange={(e) => setDiaryTime(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2.5 border"
                                    />
                                    <Button onClick={handleSaveGlobal} disabled={saving} className="bg-brand-600 text-white shrink-0">
                                        {saving ? <Settings className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        {saving ? '...' : 'Salvar'}
                                    </Button>
                                </div>
                                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    Notificações no WhatsApp só serão enviadas após este horário. Atualizações anteriores ficam agendadas.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Communication Settings */}
            {activeTab === 'communication' && (
                <div className="animate-fade-in">
                    <CommunicationSettings embedded={true} isProvisioned={hasModule('whatsapp')} />
                </div>
            )}

            {/* Tab: Financial Settings */}
            {activeTab === 'finance' && (
                <div className="animate-fade-in">
                    <FinancialSettingsTab />
                </div>
            )}
        </div>
    );
};
