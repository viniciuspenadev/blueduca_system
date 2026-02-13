import { useState, useEffect } from 'react';
import type { Subject, LessonPlan } from '../../../types';
import { planningService } from '../../../services/planningService';
import { Button, Input } from '../../../components/ui'; // Assuming these exist
import { X, Clock, BookOpen, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

interface LessonPlanModalProps {
    classId: string;
    date: Date;
    plan?: LessonPlan;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

export const LessonPlanModal = ({ classId, date, plan, isOpen, onClose, onSave }: LessonPlanModalProps) => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(false);
    const [notifyParents, setNotifyParents] = useState(false);
    const [existingPlans, setExistingPlans] = useState<LessonPlan[]>([]);
    const [scheduleConflict, setScheduleConflict] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        subject_id: '',
        start_time: '08:00',
        end_time: '09:00',
        topic: '',
        objective: '',
        materials: '',
        notes: '',
        homework: '',
        status: 'planned' as 'planned' | 'completed' | 'cancelled'
    });

    useEffect(() => {
        if (isOpen) {
            loadSubjects();
            if (plan) {
                setFormData({
                    subject_id: plan.subject_id,
                    start_time: plan.start_time.slice(0, 5),
                    end_time: plan.end_time.slice(0, 5),
                    topic: plan.topic || '',
                    objective: plan.objective || '',
                    materials: plan.materials || '',
                    notes: plan.notes || '',
                    homework: plan.homework || '',
                    status: plan.status as 'planned' | 'completed' | 'cancelled'
                });
            } else {
                // Reset for new plan
                setFormData({
                    subject_id: '',
                    start_time: '08:00',
                    end_time: '09:00',
                    topic: '',
                    objective: '',
                    materials: '',
                    notes: '',
                    homework: '',
                    status: 'planned'
                });
            }
        }
    }, [isOpen, plan]);

    // Check for existing plans on that day to suggest time or detect conflicts
    useEffect(() => {
        if (!isOpen || !classId) return;

        const checkSchedule = async () => {
            try {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                const plans = await planningService.getLessonPlans(classId, dateStr, dateStr);

                // Filter out current plan if editing
                const otherPlans = plan ? plans.filter(p => p.id !== plan.id && p.status !== 'cancelled') : plans.filter(p => p.status !== 'cancelled');
                setExistingPlans(otherPlans);

                // Smart Suggestion: If creating new, suggest next slot
                if (!plan && otherPlans.length > 0) {
                    const lastPlan = otherPlans[otherPlans.length - 1]; // Ordered by start_time
                    if (lastPlan.end_time) {
                        // Simple logic: Start = Last End
                        const suggestedStart = lastPlan.end_time.slice(0, 5);

                        // Add 50 mins default duration
                        const [h, m] = suggestedStart.split(':').map(Number);
                        const dateObj = new Date();
                        dateObj.setHours(h);
                        dateObj.setMinutes(m + 50);
                        const suggestedEnd = dateObj.toTimeString().slice(0, 5);

                        setFormData(prev => ({
                            ...prev,
                            start_time: suggestedStart,
                            end_time: suggestedEnd
                        }));
                    }
                }
            } catch (err) {
                console.error('Error checking schedule:', err);
            }
        };

        checkSchedule();
    }, [isOpen, date, classId, plan]); // Re-run if date changes

    // Conflict Detection Effect
    useEffect(() => {
        if (existingPlans.length === 0) {
            setScheduleConflict(null);
            return;
        }

        const newStart = parseInt(formData.start_time.replace(':', ''));
        const newEnd = parseInt(formData.end_time.replace(':', ''));

        const conflict = existingPlans.find(p => {
            const pStart = parseInt(p.start_time.slice(0, 5).replace(':', ''));
            const pEnd = parseInt(p.end_time.slice(0, 5).replace(':', ''));

            // Overlap logic: (StartA < EndB) and (EndA > StartB)
            return (newStart < pEnd) && (newEnd > pStart);
        });

        if (conflict) {
            setScheduleConflict(`Conflito com: ${conflict.subject?.name || 'Outra aula'} (${conflict.start_time.slice(0, 5)} - ${conflict.end_time.slice(0, 5)})`);
        } else {
            setScheduleConflict(null);
        }
    }, [formData.start_time, formData.end_time, existingPlans]);

    const loadSubjects = async () => {
        try {
            if (!currentSchool) return;
            const data = await planningService.getSubjects(currentSchool.id);
            setSubjects(data);
        } catch (error) {
            console.error('Error loading subjects:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (scheduleConflict) {
            addToast('error', 'Resolva o conflito de horário antes de salvar.');
            return;
        }

        setLoading(true);

        try {
            // Fix timezone issue: Use local date, not UTC
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            if (plan) {
                await planningService.updateLessonPlan(
                    plan.id,
                    { ...formData, date: dateStr },
                    'User manual update', // Reason
                    notifyParents
                );
                addToast('success', 'Aula atualizada com sucesso');
            } else {
                if (!currentSchool) return;
                await planningService.createLessonPlan({
                    ...formData,
                    class_id: classId,
                    date: dateStr,
                    // is_modified is handled by default in DB or service if needed, removing explicit invalid property if type omits it
                }, currentSchool.id);
                addToast('success', 'Aula planejada com sucesso');
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao salvar planejamento');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-up">
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {plan ? 'Editar Aula' : 'Planejar Nova Aula'}
                        </h2>
                        <p className="text-sm text-gray-500 capitalize">
                            {date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Matéria / Disciplina</label>
                                <select
                                    required
                                    className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 py-2.5"
                                    value={formData.subject_id}
                                    onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="time"
                                            required
                                            className="w-full pl-9 rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 py-2.5"
                                            value={formData.start_time}
                                            onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="time"
                                            required
                                            className="w-full pl-9 rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 py-2.5"
                                            value={formData.end_time}
                                            onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Conflict Alert */}
                            {scheduleConflict && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-100 animate-pulse">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span className="font-medium">{scheduleConflict}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tópico da Aula</label>
                                <Input
                                    placeholder="Ex: Introdução à Álgebra"
                                    value={formData.topic}
                                    onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <div className="flex gap-2">
                                    {(['planned', 'completed', 'cancelled'] as const).map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, status: s })}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium border transition-colors ${formData.status === s
                                                ? 'bg-brand-50 border-brand-200 text-brand-700'
                                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                }`}
                                        >
                                            {s === 'planned' && 'Planejada'}
                                            {s === 'completed' && 'Concluída'}
                                            {s === 'cancelled' && 'Cancelada'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-gray-400" />
                                    Objetivos
                                </label>
                                <textarea
                                    className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 text-sm p-3"
                                    rows={3}
                                    placeholder="O que os alunos devem aprender..."
                                    value={formData.objective}
                                    onChange={e => setFormData({ ...formData, objective: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-gray-400" />
                                    Materiais Necessários
                                </label>
                                <textarea
                                    className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 text-sm p-3"
                                    rows={2}
                                    placeholder="Livros, slides, cartolina..."
                                    value={formData.materials}
                                    onChange={e => setFormData({ ...formData, materials: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    Lição de Casa
                                </label>
                                <textarea
                                    className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 text-sm p-3"
                                    rows={2}
                                    placeholder="Páginas 10 a 12..."
                                    value={formData.homework}
                                    onChange={e => setFormData({ ...formData, homework: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {
                        plan && (
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-start gap-3">
                                <div className="flex items-center h-5 mt-0.5">
                                    <input
                                        id="notify_parents"
                                        type="checkbox"
                                        className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                        checked={notifyParents}
                                        onChange={e => setNotifyParents(e.target.checked)}
                                    />
                                </div>
                                <label htmlFor="notify_parents" className="text-sm text-gray-700">
                                    <span className="font-bold text-gray-900 block mb-1">Notificar Responsáveis</span>
                                    Enviar notificação sobre esta alteração para os pais/responsáveis dos alunos desta turma.
                                </label>
                            </div>
                        )
                    }

                    <div className="pt-4 flex gap-3 border-t border-gray-100">
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-brand-600 text-white"
                            disabled={loading}
                        >
                            {loading ? 'Salvando...' : 'Salvar Planejamento'}
                        </Button>
                    </div>
                </form >
            </div >
        </div >
    );
};
