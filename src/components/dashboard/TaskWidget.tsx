import { type FC, useEffect, useState } from 'react';
import { Button } from '../ui';
import { TaskService, type Task } from '../../services/TaskService';
import { CheckCircle, Clock, Plus, AlertTriangle, AlertOctagon, FileText } from 'lucide-react';
import { TaskCreateModal } from './TaskCreateModal';

export const TaskWidget: FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            const data = await TaskService.list();
            setTasks(data);
        } catch (error) {
            console.error('Error loading tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (id: string) => {
        // Optimistic update
        setTasks(prev => prev.filter(t => t.id !== id));
        try {
            await TaskService.complete(id);
        } catch (error) {
            console.error('Error completing task:', error);
            loadTasks(); // Revert on error
        }
    };

    // Priority Helpers
    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'critical': return <AlertOctagon className="w-4 h-4 text-red-600" />;
            case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default: return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'financial_followup': return 'Cobrança';
            case 'document_review': return 'Documentos';
            case 'system_alert': return 'Sistema';
            default: return 'Geral';
        }
    };

    if (loading) return <div className="h-64 bg-gray-50 rounded-3xl animate-pulse"></div>;

    return (
        <div className="bg-white rounded-3xl border border-gray-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-6 pt-6 pb-2 border-b border-gray-50/50">
                <h3 className="text-sm lg:text-base font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                        <FileText className="w-4 h-4" />
                    </div>
                    Lista de Tarefas
                </h3>
                <Button
                    variant="primary"
                    size="sm"
                    className="shadow-sm"
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-1" /> Nova
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
                {tasks.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>Tudo em dia! Nenhuma tarefa pendente.</p>
                        <Button
                            variant="ghost"
                            className="text-brand-600 mt-2 hover:bg-brand-50"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Criar primeira tarefa
                        </Button>
                    </div>
                ) : (
                    tasks.map(task => (
                        <div
                            key={task.id}
                            className={`
                                group bg-gray-50/40 border border-gray-100/60 rounded-2xl p-4 hover:shadow-sm hover:bg-white hover:border-gray-200 transition-all duration-300
                                ${task.priority === 'critical' ? 'border-l-4 border-l-red-500' : ''}
                                ${task.priority === 'high' ? 'border-l-4 border-l-orange-400' : ''}
                            `}
                        >
                            <div className="flex items-start gap-4">
                                {/* Checkbox-like button */}
                                <button
                                    onClick={() => handleComplete(task.id)}
                                    className="mt-0.5 w-6 h-6 rounded-full border-[1.5px] border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors shrink-0"
                                    title="Marcar como concluída"
                                >
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 opacity-0 hover:opacity-100 transition-opacity" />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-gray-900 text-sm truncate pr-2 group-hover:text-brand-600 transition-colors">{task.title}</h4>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 bg-white px-2 py-0.5 rounded-md border border-gray-100 shadow-sm whitespace-nowrap">
                                            {getTypeLabel(task.type)}
                                        </span>
                                    </div>

                                    {task.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                                    )}

                                    <div className="flex items-center gap-4 mt-3">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold" title={`Prioridade: ${task.priority}`}>
                                            {getPriorityIcon(task.priority)}
                                            <span className={`
                                                ${task.priority === 'critical' ? 'text-red-600' : ''}
                                                ${task.priority === 'high' ? 'text-orange-600' : 'text-gray-500'}
                                            `}>
                                                {task.priority === 'critical' ? 'Crítico' : task.priority === 'high' ? 'Alta' : 'Normal'}
                                            </span>
                                        </div>

                                        {task.due_date && (
                                            <span className={`text-[10px] font-medium flex items-center gap-1 ${new Date(task.due_date) < new Date() ? 'text-red-500 bg-red-50 px-2 py-0.5 rounded-md' : 'text-gray-400'}`}>
                                                {new Date(task.due_date) < new Date() ? 'Atrasado: ' : ''}
                                                {new Date(task.due_date).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <TaskCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadTasks}
            />
        </div>
    );
};
