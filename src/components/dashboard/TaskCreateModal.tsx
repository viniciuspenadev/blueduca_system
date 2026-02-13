import { useState, useEffect } from 'react';
import { Button } from '../ui'; // Assuming you have a Button component
import { TaskService, type TaskType, type TaskPriority } from '../../services/TaskService';
import { useAuth } from '../../contexts/AuthContext';
import { X } from 'lucide-react';

interface TaskCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const TaskCreateModal = ({ isOpen, onClose, onSuccess }: TaskCreateModalProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'manual' as TaskType,
        priority: 'normal' as TaskPriority,
        due_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            setTimeout(() => setIsVisible(false), 300); // Wait for animation
        }
    }, [isOpen]);

    if (!isOpen && !isVisible) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await TaskService.create({
                ...formData,
                status: 'todo',
                created_by: user?.id
            });
            onSuccess();
            handleClose();
            // Reset form
            setFormData({
                title: '',
                description: '',
                type: 'manual',
                priority: 'normal',
                due_date: new Date().toISOString().split('T')[0]
            });
        } catch (error) {
            console.error('Error creating task:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={handleClose}
            />

            {/* Modal Panel */}
            <div className={`relative w-full max-w-md bg-white rounded-2xl shadow-xl transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">
                        Nova Tarefa
                    </h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 border"
                            placeholder="Ex: Ligar para pai do João"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                        <textarea
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 border"
                            rows={3}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                            <select
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 border"
                                value={formData.priority}
                                onChange={e => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                            >
                                <option value="low">Baixa</option>
                                <option value="normal">Normal</option>
                                <option value="high">Alta</option>
                                <option value="critical">Crítica</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento</label>
                            <input
                                type="date"
                                required
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 border"
                                value={formData.due_date}
                                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                        >
                            {loading ? 'Criando...' : 'Criar Tarefa'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
