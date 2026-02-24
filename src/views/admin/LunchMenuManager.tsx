import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, Plus, Edit2, Trash2, CheckCircle, Circle, ArrowLeft, Save, PlusCircle, X, Tag } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

// Types
interface Meal {
    id: string; // for React keys
    title: string;
    description: string;
    tags: string[];
}

interface MenuTemplate {
    id: string;
    name: string;
    content: Record<string, Meal[]>; // Key: monday, tuesday...
    is_active: boolean;
}

const WEEK_DAYS = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' }
];

const PRESET_MEALS = ['Lanche da Manhã', 'Almoço', 'Lanche da Tarde', 'Jantar'];
const PRESET_TAGS = ['🌾 Sem Glúten', '🥛 Sem Lactose', '🍓 Sem Açúcar', '🥑 Vegano', '🥦 Vegetariano'];

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
    const [selectedDay, setSelectedDay] = useState<string>('monday');

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

            // Migrate old data on the fly for viewing
            const migratedData = (data || []).map((t: any) => {
                const newContent: Record<string, Meal[]> = {};
                if (t.content) {
                    Object.keys(t.content).forEach(day => {
                        if (Array.isArray(t.content[day])) {
                            newContent[day] = t.content[day];
                        } else if (typeof t.content[day] === 'object' && t.content[day] !== null) {
                            // Legacy format migration
                            newContent[day] = [{
                                id: Math.random().toString(36).substr(2, 9),
                                title: t.content[day].title || 'Almoço',
                                description: t.content[day].description || '',
                                tags: []
                            }];
                        } else {
                            newContent[day] = [];
                        }
                    });
                }
                return { ...t, content: newContent };
            });

            setTemplates(migratedData);
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

            const newTemplate: MenuTemplate = { ...data, content: {} };
            setTemplates([newTemplate, ...templates]);
            setEditingTemplate(newTemplate);
            setView('edit');
            setShowCreateModal(false);
            setNewTemplateName('');
            setSelectedDay('monday');
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
        const oldTemplates = [...templates];
        setTemplates(templates.map(t => ({ ...t, is_active: t.id === template.id })));

        try {
            await supabase
                .from('menu_templates')
                .update({ is_active: false })
                .eq('school_id', currentSchool.id);

            const { error } = await supabase
                .from('menu_templates')
                .update({ is_active: true })
                .eq('id', template.id);

            if (error) throw error;
            addToast('success', `"${template.name}" agora está ativo!`);
        } catch (error) {
            console.error('Error activating:', error);
            setTemplates(oldTemplates);
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
            fetchTemplates();
        } catch (error) {
            console.error('Error saving content:', error);
            addToast('error', 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    // Editor Helpers
    const getMealsForDay = (dayKey: string): Meal[] => {
        if (!editingTemplate || !editingTemplate.content) return [];
        return editingTemplate.content[dayKey] || [];
    };

    const updateDayMeals = (dayKey: string, meals: Meal[]) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            content: {
                ...editingTemplate.content,
                [dayKey]: meals
            }
        });
    };

    const addMeal = (dayKey: string) => {
        const meals = [...getMealsForDay(dayKey)];
        meals.push({
            id: Math.random().toString(36).substr(2, 9),
            title: '',
            description: '',
            tags: []
        });
        updateDayMeals(dayKey, meals);
    };

    const removeMeal = (dayKey: string, mealId: string) => {
        const meals = getMealsForDay(dayKey).filter(m => m.id !== mealId);
        updateDayMeals(dayKey, meals);
    };

    const updateMeal = (dayKey: string, mealId: string, field: keyof Meal, value: any) => {
        const meals = getMealsForDay(dayKey).map(m => {
            if (m.id === mealId) {
                return { ...m, [field]: value };
            }
            return m;
        });
        updateDayMeals(dayKey, meals);
    };

    const toggleTag = (dayKey: string, mealId: string, tag: string) => {
        const meals = getMealsForDay(dayKey).map(m => {
            if (m.id === mealId) {
                const tags = m.tags.includes(tag)
                    ? m.tags.filter(t => t !== tag)
                    : [...m.tags, tag];
                return { ...m, tags };
            }
            return m;
        });
        updateDayMeals(dayKey, meals);
    };

    const copyDayContent = (fromDay: string, toDay: string) => {
        if (!editingTemplate) return;
        const fromMeals = getMealsForDay(fromDay);
        // Deep copy to avoid ID conflicts, but generate new IDs
        const newMeals = fromMeals.map(m => ({ ...m, id: Math.random().toString(36).substr(2, 9) }));

        // Show options or just apply it
        if (confirm(`Copiar cardápio de ${WEEK_DAYS.find(w => w.key === fromDay)?.label} para ${WEEK_DAYS.find(w => w.key === toDay)?.label}? Isso substituirá o cardápio existente.`)) {
            updateDayMeals(toDay, newMeals);
            addToast('success', 'Dia copiado com sucesso!');
        }
    };

    // --- RENDER ---

    if (view === 'edit' && editingTemplate) {
        return (
            <div className="p-6 max-w-6xl mx-auto animate-fade-in pb-24">
                <header className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('list')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={24} className="text-gray-600" />
                        </button>
                        <div>
                            <p className="text-sm text-brand-600 font-medium tracking-wide uppercase mb-1">Editor de Cardápio</p>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <input
                                    value={editingTemplate.name}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    className="bg-transparent border-b-2 border-gray-300 hover:border-gray-400 focus:border-brand-500 outline-none px-2 py-1 rounded-t transition-all placeholder:text-gray-400 min-w-[300px]"
                                    placeholder="Nome do Modelo..."
                                />
                            </h1>
                        </div>
                    </div>
                    <Button onClick={handleSaveContent} disabled={saving} className="bg-brand-600 text-white hover:bg-brand-700 shadow-md">
                        {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                        Salvar Alterações
                    </Button>
                </header>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar Tabs */}
                    <div className="w-full lg:w-48 xl:w-64 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 hide-scrollbar">
                        {WEEK_DAYS.map(day => {
                            const mealCount = getMealsForDay(day.key).length;
                            return (
                                <button
                                    key={day.key}
                                    onClick={() => setSelectedDay(day.key)}
                                    className={`flex-shrink-0 flex items-center justify-between p-4 rounded-xl transition-all duration-200 text-left border ${selectedDay === day.key
                                        ? 'bg-brand-50 border-brand-200 shadow-sm ring-1 ring-brand-500'
                                        : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <div>
                                        <span className={`block font-semibold ${selectedDay === day.key ? 'text-brand-700' : 'text-gray-700'}`}>
                                            {day.label}
                                        </span>
                                        <span className="text-xs text-gray-500 mt-0.5 block">
                                            {mealCount} {mealCount === 1 ? 'refeição' : 'refeições'}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {WEEK_DAYS.find(d => d.key === selectedDay)?.label}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">Configure as refeições servidas neste dia.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                copyDayContent(e.target.value, selectedDay);
                                                e.target.value = '';
                                            }
                                        }}
                                        className="text-sm border-gray-300 rounded-lg text-gray-600 focus:ring-brand-500 cursor-pointer"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Copiar de outro dia...</option>
                                        {WEEK_DAYS.filter(d => d.key !== selectedDay).map(d => (
                                            <option key={d.key} value={d.key}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {getMealsForDay(selectedDay).length === 0 ? (
                                    <div className="text-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                        <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">Dia sem refeições</h3>
                                        <p className="text-gray-500 mb-6">Adicione a primeira refeição para este dia do cardápio.</p>
                                        <Button onClick={() => addMeal(selectedDay)} className="bg-brand-600 text-white">
                                            <PlusCircle className="mr-2" size={18} />
                                            Adicionar Refeição
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {getMealsForDay(selectedDay).map((meal) => (
                                            <div key={meal.id} className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-300 transition-colors shadow-sm">
                                                <button
                                                    onClick={() => removeMeal(selectedDay, meal.id)}
                                                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    title="Remover refeição"
                                                >
                                                    <X size={18} />
                                                </button>

                                                <div className="mb-4 pr-12">
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome da Refeição</label>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {PRESET_MEALS.map(preset => (
                                                            <button
                                                                key={preset}
                                                                onClick={() => updateMeal(selectedDay, meal.id, 'title', preset)}
                                                                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${meal.title === preset ? 'bg-brand-100 border-brand-300 text-brand-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                            >
                                                                {preset}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={meal.title}
                                                        onChange={e => updateMeal(selectedDay, meal.id, 'title', e.target.value)}
                                                        placeholder="Ex: Almoço Principal, Lanche Especial..."
                                                        className="w-full text-base font-semibold border border-gray-300 bg-gray-50 rounded-lg focus:ring-brand-500 focus:border-brand-500 focus:bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors"
                                                    />
                                                </div>

                                                <div className="mb-4">
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">O que será servido?</label>
                                                    <textarea
                                                        value={meal.description}
                                                        onChange={e => updateMeal(selectedDay, meal.id, 'description', e.target.value)}
                                                        placeholder="Descreva os itens do prato. Ex: Arroz, feijão, frango grelhado e salada mista."
                                                        rows={3}
                                                        className="w-full text-sm border border-gray-300 bg-gray-50 rounded-lg focus:ring-brand-500 focus:border-brand-500 focus:bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] resize-none transition-colors"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                                        <Tag size={12} />
                                                        <span>Avisos / Dietas</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {PRESET_TAGS.map(tag => {
                                                            const isActive = meal.tags.includes(tag);
                                                            return (
                                                                <button
                                                                    key={tag}
                                                                    onClick={() => toggleTag(selectedDay, meal.id, tag)}
                                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isActive
                                                                        ? 'bg-orange-50 border-orange-200 text-orange-700 ring-1 ring-orange-500 shadow-sm'
                                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    {tag}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="pt-2">
                                            <Button
                                                onClick={() => addMeal(selectedDay)}
                                                variant="outline"
                                                className="w-full py-3 border-dashed border-2 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                            >
                                                <PlusCircle className="mr-2" size={18} />
                                                Adicionar Nova Refeição
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Meus Cardápios</h1>
                    <p className="text-gray-500 mt-1">Crie modelos de cardápio e escolha qual exibir para os pais.</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="bg-brand-600 hover:bg-brand-700 text-white shadow-md">
                    <Plus className="mr-2" size={20} />
                    Novo Cardápio
                </Button>
            </header>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>
            ) : templates.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p className="text-gray-500 mb-6 text-lg">Nenhum modelo de cardápio criado ainda.</p>
                    <Button variant="outline" onClick={() => setShowCreateModal(true)} className="border-2">
                        Criar o Primeiro Modelo
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {templates.map(t => {
                        // Count total meals
                        const count = Object.values(t.content || {}).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
                        return (
                            <div key={t.id} className={`p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${t.is_active ? 'bg-green-50 border-green-200 ring-1 ring-green-500 shadow-sm' : 'bg-white border-gray-100 hover:border-brand-200 shadow-sm'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${t.is_active ? 'bg-green-100 text-green-600 shadow-inner' : 'bg-gray-100 text-gray-400'}`}>
                                        {t.is_active ? <CheckCircle size={24} /> : <Circle size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                            {t.name}
                                            {t.is_active && <span className="bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">Ativo</span>}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {count > 0 ? `${count} refeições configuradas na semana` : 'Cardápio vazio'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end md:self-auto">
                                    {!t.is_active && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleActivate(t)}
                                            className="text-green-600 hover:bg-green-50 font-medium"
                                        >
                                            Ativar
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setEditingTemplate(t);
                                            setView('edit');
                                        }}
                                        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border-gray-200"
                                    >
                                        <Edit2 size={16} className="mr-1.5" /> Editar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(t.id)}
                                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Novo Modelo de Cardápio">
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome do Modelo</label>
                        <input
                            autoFocus
                            value={newTemplateName}
                            onChange={e => setNewTemplateName(e.target.value)}
                            placeholder="Ex: Cardápio Verão, Sem glúten..."
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:ring-brand-500 focus:border-brand-500 p-3 shadow-sm transition-colors"
                        />
                        <p className="text-xs text-gray-500 mt-2">Você poderá preencher os dias da semana e adicionar pratos na próxima etapa.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={!newTemplateName.trim()} className="bg-brand-600 hover:bg-brand-700 text-white px-6">Criar Modelo</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
