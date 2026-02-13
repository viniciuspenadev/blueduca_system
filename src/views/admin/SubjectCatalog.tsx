import { useState, useEffect } from 'react';
import { planningService } from '../../services/planningService';
import type { Subject } from '../../types';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuth } from '../../contexts/AuthContext';
import {
    Plus,
    Search,
    BookOpen,
    Edit2,
    Trash2,
    X
} from 'lucide-react';

const COLORS = [
    { label: 'Roxo', value: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { label: 'Azul', value: 'bg-blue-100 text-blue-800 border-blue-200' },
    { label: 'Verde', value: 'bg-green-100 text-green-800 border-green-200' },
    { label: 'Laranja', value: 'bg-orange-100 text-orange-800 border-orange-200' },
    { label: 'Rosa', value: 'bg-pink-100 text-pink-800 border-pink-200' },
    { label: 'Vermelho', value: 'bg-red-100 text-red-800 border-red-200' },
    { label: 'Teal', value: 'bg-teal-100 text-teal-800 border-teal-200' },
    { label: 'Cinza', value: 'bg-gray-100 text-gray-800 border-gray-200' },
];

export const SubjectCatalog = () => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        emoji: '📚',
        color: COLORS[0].value,
        description: ''
    });

    useEffect(() => {
        if (currentSchool?.id) {
            fetchSubjects();
        }
    }, [currentSchool?.id]);

    const fetchSubjects = async () => {
        try {
            if (!currentSchool) return;
            const data = await planningService.getSubjects(currentSchool.id);
            setSubjects(data);
        } catch (error) {
            addToast('error', 'Erro ao carregar matérias');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (subject?: Subject) => {
        if (subject) {
            setEditingSubject(subject);
            setFormData({
                name: subject.name,
                emoji: subject.emoji,
                color: subject.color,
                description: subject.description || ''
            });
        } else {
            setEditingSubject(null);
            setFormData({
                name: '',
                emoji: '📚',
                color: COLORS[0].value,
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSubject) {
                await planningService.updateSubject(editingSubject.id, formData);
                addToast('success', 'Matéria atualizada com sucesso');
            } else {
                if (!currentSchool) return;
                await planningService.createSubject(formData, currentSchool.id);
                addToast('success', 'Matéria criada com sucesso');
            }
            setIsModalOpen(false);
            fetchSubjects();
        } catch (error) {
            addToast('error', 'Erro ao salvar matéria');
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Excluir Matéria',
            message: 'Tem certeza que deseja excluir esta matéria?',
            type: 'danger',
            confirmText: 'Excluir'
        });

        if (!isConfirmed) return;
        try {
            await planningService.deleteSubject(id);
            addToast('success', 'Matéria excluída');
            setSubjects(subjects.filter(s => s.id !== id));
        } catch (error) {
            addToast('error', 'Erro ao excluir matéria');
        }
    };

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-100 p-2.5 rounded-xl">
                        <BookOpen className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Catálogo de Matérias</h1>
                        <p className="text-gray-500 text-sm">Gerencie as disciplinas oferecidas pela escola</p>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar matéria..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
                        />
                    </div>
                    <Button onClick={() => handleOpenModal()} className="bg-brand-600 text-white shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Matéria
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">Carregando catálogo...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredSubjects.map(subject => (
                        <div key={subject.id} className="group bg-white p-5 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-md transition-all relative">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                    onClick={() => handleOpenModal(subject)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand-600"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(subject.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="text-4xl">{subject.emoji}</div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg mb-1">{subject.name}</h3>
                                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${subject.color}`}>
                                        Disciplina
                                    </span>
                                </div>
                            </div>

                            {subject.description && (
                                <p className="mt-4 text-sm text-gray-500 line-clamp-2">
                                    {subject.description}
                                </p>
                            )}
                        </div>
                    ))}

                    {filteredSubjects.length === 0 && (
                        <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-gray-900 font-medium">Nenhuma matéria encontrada</h3>
                            <p className="text-gray-500 text-sm mb-4">Cadastre as matérias para começarem a aparecer aqui.</p>
                            <Button variant="outline" onClick={() => handleOpenModal()}>
                                Criar Primeira Matéria
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-scale-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingSubject ? 'Editar Matéria' : 'Nova Matéria'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Matéria</label>
                                <Input
                                    required
                                    placeholder="Ex: Matemática"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Emoji / Ícone</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full text-center text-2xl h-12 rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
                                            maxLength={2}
                                            value={formData.emoji}
                                            onChange={e => setFormData({ ...formData, emoji: e.target.value })}
                                        />
                                        <div className="text-[10px] text-center text-gray-400 mt-1">Copie e cole um emoji</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cor da Tag</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {COLORS.map(c => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                className={`w-8 h-8 rounded-full border-2 ${c.value.split(' ')[0]} ${formData.color === c.value ? 'ring-2 ring-offset-1 ring-gray-400 border-gray-400' : 'border-transparent'}`}
                                                title={c.label}
                                                onClick={() => setFormData({ ...formData, color: c.value })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descrição <span className="text-gray-400 font-normal">(Opcional)</span>
                                </label>
                                <textarea
                                    className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 text-sm p-3"
                                    rows={3}
                                    placeholder="Breve descrição da disciplina..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-brand-600 text-white"
                                >
                                    Salvar
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
