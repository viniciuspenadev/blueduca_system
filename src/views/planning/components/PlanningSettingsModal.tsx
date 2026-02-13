import { useState, useEffect } from 'react';
import { X, Save, Settings, Calendar, Clock } from 'lucide-react';
import { usePlanningSettings, type PlanningConfig } from '../../../hooks/usePlanningSettings';

interface PlanningSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PlanningSettingsModal = ({ isOpen, onClose }: PlanningSettingsModalProps) => {
    const { config, saveConfig } = usePlanningSettings();
    const [formData, setFormData] = useState<PlanningConfig>(config);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (config) {
            setFormData(config);
        }
    }, [config]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await saveConfig(formData);
        setSaving(false);
        if (result.success) {
            onClose();
        } else {
            alert('Erro ao salvar configurações. Verifique suas permissões.');
        }
    };

    const days = [
        { value: 0, label: 'Domingo' },
        { value: 1, label: 'Segunda-feira' },
        { value: 2, label: 'Terça-feira' },
        { value: 3, label: 'Quarta-feira' },
        { value: 4, label: 'Quinta-feira' },
        { value: 5, label: 'Sexta-feira' },
        { value: 6, label: 'Sábado' },
    ];

    const weekDays = [
        { index: 0, label: 'Seg' },
        { index: 1, label: 'Ter' },
        { index: 2, label: 'Qua' },
        { index: 3, label: 'Qui' },
        { index: 4, label: 'Sex' },
        { index: 5, label: 'Sáb' },
        { index: 6, label: 'Dom' },
    ];

    const toggleWorkday = (index: number) => {
        const newWorkdays = [...formData.workdays];
        newWorkdays[index] = !newWorkdays[index];
        setFormData({ ...formData, workdays: newWorkdays });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                            <Settings className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Configurar Prazos</h2>
                            <p className="text-sm text-gray-500">Regras de entrega dos planejamentos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Deadline Day & Time */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-brand-500" />
                                Dia Limite de Entrega
                            </label>
                            <select
                                value={formData.deadline_day}
                                onChange={e => setFormData({ ...formData, deadline_day: Number(e.target.value) })}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                {days.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs text-gray-500">
                                Dia máximo da semana para enviar o planejamento da <strong>semana seguinte</strong>.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-brand-500" />
                                Horário Limite
                            </label>
                            <input
                                type="time"
                                value={formData.deadline_time}
                                onChange={e => setFormData({ ...formData, deadline_time: e.target.value })}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Workdays */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            📆 Dias Úteis Considerados
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {weekDays.map((day) => (
                                <button
                                    key={day.index}
                                    type="button"
                                    onClick={() => toggleWorkday(day.index)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${formData.workdays[day.index]
                                        ? 'bg-brand-100 text-brand-700 border-2 border-brand-300'
                                        : 'bg-gray-100 text-gray-400 border-2 border-transparent hover:border-gray-300'
                                        }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Apenas dias marcados contarão para prazos e alertas
                        </p>
                    </div>

                    {/* Alert Level */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            🔔 Nível de Alerta
                        </label>
                        <div className="space-y-2">
                            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.alert_level === 'strict' ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                <input
                                    type="radio"
                                    name="alert_level"
                                    value="strict"
                                    checked={formData.alert_level === 'strict'}
                                    onChange={e => setFormData({ ...formData, alert_level: e.target.value as any })}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">🔴 Rigoroso</div>
                                    <div className="text-xs text-gray-500">Marca como "Atrasado" (vermelho) imediatamente após o prazo</div>
                                </div>
                            </label>

                            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.alert_level === 'moderate' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                <input
                                    type="radio"
                                    name="alert_level"
                                    value="moderate"
                                    checked={formData.alert_level === 'moderate'}
                                    onChange={e => setFormData({ ...formData, alert_level: e.target.value as any })}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">🟡 Moderado</div>
                                    <div className="text-xs text-gray-500">Mostra alerta em amarelo/laranja (mais suave)</div>
                                </div>
                            </label>

                            <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.alert_level === 'disabled' ? 'border-gray-300 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                <input
                                    type="radio"
                                    name="alert_level"
                                    value="disabled"
                                    checked={formData.alert_level === 'disabled'}
                                    onChange={e => setFormData({ ...formData, alert_level: e.target.value as any })}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">⚪ Desabilitado</div>
                                    <div className="text-xs text-gray-500">Sem alertas de atraso (todos em cinza/amarelo neutro)</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Grace Period */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            ⏱️ Período de Tolerância (dias)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="7"
                            value={formData.grace_period_days}
                            onChange={e => setFormData({ ...formData, grace_period_days: Number(e.target.value) })}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Dias extras de tolerância após o prazo antes de marcar como atrasado
                        </p>
                    </div>

                    <div className="pt-4 flex gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg font-medium text-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Salvando...' : 'Salvar Regras'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
