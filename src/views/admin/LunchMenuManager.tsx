import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Plus, Edit2, Trash2, CheckCircle, Circle, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

// Types
interface MenuTemplate {
    id: string;
    name: string;
    content: Record<string, DailyMenuContent>; // Key: monday, tuesday...
    is_active: boolean;
}

interface DailyMenuContent {
    title: string;
    description: string;
}

const WEEK_DAYS = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' }
];

export const LunchMenuManager: React.FC = () => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();

    // View State: 'list' | 'edit'
    const [view, setView] = useState<'list' | 'edit'>('list');

    // Data State
    const [templates, setTemplates] = useState<MenuTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    // Editor State
    const [editingTemplate, setEditingTemplate] = useState<MenuTemplate | null>(null);
    const [saving, setSaving] = useState(false);

    // Create Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    useEffect(() => {
        if (currentSchool) fetchTemplates();
    }, [currentSchool]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('menu_templates')
                .select('*')
                .eq('school_id', currentSchool?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
            addToast('error', 'Erro ao carregar modelos');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newTemplateName.trim() || !currentSchool) return;
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('menu_templates')
                .insert({
                    school_id: currentSchool.id,
                    name: newTemplateName,
                    content: {},
                    is_active: false // Default inactive
                })
                .select()
                .single();

            if (error) throw error;

            setTemplates([data, ...templates]);
            setEditingTemplate(data);
            setView('edit');
            setShowCreateModal(false);
            setNewTemplateName('');
            addToast('success', 'Modelo criado! Agora preencha os dias.');
        } catch (error) {
            console.error('Error creating:', error);
            addToast('error', 'Erro ao criar modelo');
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async (template: MenuTemplate) => {
        if (!currentSchool) return;
        // Optimistic update
        const oldTemplates = [...templates];
        setTemplates(templates.map(t => ({ ...t, is_active: t.id === template.id })));

        try {
            // Transaction-like update: Deactivate others, activate this one
            // Ideally use a generated RPC or just two calls. 
            // V28 unique index ensures only one is active, so we might need to deactivate first.

            // 1. Deactivate all
            await supabase
                .from('menu_templates')
                .update({ is_active: false })
                .eq('school_id', currentSchool.id);

            // 2. Activate target
            const { error } = await supabase
                .from('menu_templates')
                .update({ is_active: true })
                .eq('id', template.id);

            if (error) throw error;
            addToast('success', `"${template.name}" agora está ativo!`);
        } catch (error) {
            console.error('Error activating:', error);
            setTemplates(oldTemplates); // Revert
            addToast('error', 'Erro ao ativar modelo');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir?')) return;
        try {
            const { error } = await supabase.from('menu_templates').delete().eq('id', id);
            if (error) throw error;
            setTemplates(templates.filter(t => t.id !== id));
            addToast('success', 'Modelo excluído.');
        } catch (error) {
            addToast('error', 'Erro ao excluir');
        }
    };

    const handleSaveContent = async () => {
        if (!editingTemplate) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('menu_templates')
                .update({
                    content: editingTemplate.content,
                    name: editingTemplate.name
                })
                .eq('id', editingTemplate.id);

            if (error) throw error;
            addToast('success', 'Alterações salvas!');
            fetchTemplates(); // Refresh list data
            // Stay in edit mode or go back? Let's stay.
        } catch (error) {
            console.error('Error saving content:', error);
            addToast('error', 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const updateDayContent = (dayKey: string, field: 'title' | 'description', value: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            content: {
                ...editingTemplate.content,
                [dayKey]: {
                    ...(editingTemplate.content[dayKey] || { title: 'Almoço', description: '' }),
                    [field]: value
                }
            }
        });
    };

    // --- RENDER ---

    if (view === 'edit' && editingTemplate) {
        return (
            <div className="p-6 max-w-6xl mx-auto animate-fade-in pb-24">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('list')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={24} className="text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                Editando:
                                <input
                                    value={editingTemplate.name}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    className="bg-transparent border-b border-gray-300 focus:border-brand-500 outline-none px-1"
                                />
                            </h1>
                        </div>
                    </div>
                    <Button onClick={handleSaveContent} disabled={saving} className="bg-brand-600 text-white">
                        {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                        Salvar Alterações
                    </Button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
                    {WEEK_DAYS.map(day => {
                        const content = editingTemplate.content[day.key] || { title: 'Almoço', description: '' };
                        return (
                            <div key={day.key} className="min-w-[220px] bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                                <div className="font-bold text-brand-700 uppercase text-sm border-b pb-2">
                                    {day.label}
                                </div>
                                <input
                                    type="text"
                                    value={content.title}
                                    onChange={e => updateDayContent(day.key, 'title', e.target.value)}
                                    placeholder="Título (ex: Almoço)"
                                    className="text-sm font-semibold border-gray-200 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                                />
                                <textarea
                                    value={content.description}
                                    onChange={e => updateDayContent(day.key, 'description', e.target.value)}
                                    placeholder="Descrição do prato..."
                                    rows={8}
                                    className="text-sm border-gray-200 rounded-lg focus:ring-brand-500 focus:border-brand-500 resize-none"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Meus Cardápios</h1>
                    <p className="text-gray-500">Crie modelos de cardápio e escolha qual exibir para os pais.</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="bg-brand-600 text-white">
                    <Plus className="mr-2" size={20} />
                    Novo Cardápio
                </Button>
            </header>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600" /></div>
            ) : templates.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 mb-4">Nenhum cardápio criado ainda.</p>
                    <Button variant="outline" onClick={() => setShowCreateModal(true)}>Criar o Primeiro</Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {templates.map(t => (
                        <div key={t.id} className={`p-5 rounded-2xl border transition-all flex items-center justify-between ${t.is_active ? 'bg-green-50 border-green-200 ring-1 ring-green-500' : 'bg-white border-gray-100 hover:border-brand-200'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${t.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                    {t.is_active ? <CheckCircle size={24} /> : <Circle size={24} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{t.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {t.content && Object.keys(t.content).length > 0
                                            ? `${Object.keys(t.content).length} dias configurados`
                                            : 'Vazio'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {!t.is_active && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleActivate(t)}
                                        className="text-green-600 hover:bg-green-50"
                                    >
                                        Ativar
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setEditingTemplate(t);
                                        setView('edit');
                                    }}
                                    className="text-blue-600 hover:bg-blue-50"
                                >
                                    <Edit2 size={18} />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete(t.id)}
                                    className="text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Novo Modelo de Cardápio">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Modelo</label>
                        <input
                            autoFocus
                            value={newTemplateName}
                            onChange={e => setNewTemplateName(e.target.value)}
                            placeholder="Ex: Cardápio Verão, Sem glúten..."
                            className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={!newTemplateName.trim()} className="bg-brand-600 text-white">Criar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
