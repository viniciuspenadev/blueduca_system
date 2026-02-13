import { type FC, useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Calendar, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Button, Input, Card, Modal } from '../../components/ui';
import type { DailyTimeline, DailyTimelineItem, TimelineItemType } from '../../types/timeline';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

export const TimelineSettings: FC = () => {
    const { currentSchool } = useAuth(); // Get current school
    const [timelines, setTimelines] = useState<DailyTimeline[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTimeline, setSelectedTimeline] = useState<DailyTimeline | null>(null);
    const [iscreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTimelineName, setNewTimelineName] = useState('');

    const { confirm } = useConfirm();
    const { addToast } = useToast();

    const [items, setItems] = useState<DailyTimelineItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [saving, setSaving] = useState(false);

    const { value: displayMode, updateSetting: setDisplayMode } = useAppSettings('daily_timeline_display_mode', 'graph');

    const updateDisplayMode = async (mode: string) => {
        await setDisplayMode(mode);
    };



    useEffect(() => {
        if (currentSchool) {
            fetchTimelines();
        }
    }, [currentSchool]); // Refetch on school change

    useEffect(() => {
        if (selectedTimeline) {
            fetchItems(selectedTimeline.id);
        } else {
            setItems([]);
        }
    }, [selectedTimeline]);

    const fetchTimelines = async () => {
        if (!currentSchool) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('daily_timelines')
            .select('*')
            .eq('school_id', currentSchool.id) // Filter by school
            .order('created_at', { ascending: false });

        if (!error && data) {
            setTimelines(data);
            if (data.length > 0 && !selectedTimeline) {
                setSelectedTimeline(data[0]);
            }
        }
        setLoading(false);
    };

    const fetchItems = async (timelineId: string) => {
        setLoadingItems(true);
        const { data, error } = await supabase
            .from('daily_timeline_items')
            .select('*')
            .eq('timeline_id', timelineId)
            .order('order_index', { ascending: true });

        if (!error && data) {
            setItems(data);
        }
        setLoadingItems(false);
    };

    const handleCreateTimeline = async () => {
        if (!newTimelineName.trim() || !currentSchool) return;

        const { data, error } = await supabase
            .from('daily_timelines')
            .insert([{
                name: newTimelineName,
                school_id: currentSchool.id
            }])
            .select()
            .single();

        if (!error && data) {
            setTimelines([data, ...timelines]);
            setSelectedTimeline(data);
            setIsCreateModalOpen(false);
            setNewTimelineName('');
        }
    };

    const handleDeleteTimeline = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Excluir Rotina',
            message: 'Tem certeza? Isso removerá a rotina de todas as turmas/alunos vinculados.',
            type: 'danger',
            confirmText: 'Excluir'
        });

        if (!isConfirmed) return;

        const { error } = await supabase
            .from('daily_timelines')
            .delete()
            .eq('id', id);

        if (!error) {
            const updated = timelines.filter(t => t.id !== id);
            setTimelines(updated);
            if (selectedTimeline?.id === id) {
                setSelectedTimeline(updated[0] || null);
            }
        }
    };

    const handleDuplicateTimeline = async (id: string) => {
        const original = timelines.find(t => t.id === id);
        if (!original) return;

        const isConfirmed = await confirm({
            title: 'Duplicar Rotina',
            message: `Deseja duplicar a rotina "${original.name}"?`,
            type: 'info',
            confirmText: 'Duplicar'
        });

        if (!isConfirmed) return;

        setLoading(true);

        try {
            // 1. Create new timeline
            const { data: newTimeline, error: createError } = await supabase
                .from('daily_timelines')
                .insert([{
                    name: `Cópia de ${original.name}`,
                    description: original.description,
                    is_default: false,
                    school_id: currentSchool?.id
                }])
                .select()
                .single();

            if (createError || !newTimeline) throw createError;

            // 2. Fetch original items
            const { data: originalItems } = await supabase
                .from('daily_timeline_items')
                .select('*')
                .eq('timeline_id', id);

            // 3. Insert items for new timeline
            if (originalItems && originalItems.length > 0) {
                const newItemsPayload = originalItems.map(item => ({
                    timeline_id: newTimeline.id,
                    title: item.title,
                    description: item.description,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    order_index: item.order_index,
                    icon: item.icon,
                    color: item.color,
                    type: item.type
                }));

                const { error: itemsError } = await supabase
                    .from('daily_timeline_items')
                    .insert(newItemsPayload);

                if (itemsError) throw itemsError;
            }

            // 4. Refresh
            await fetchTimelines();
            setSelectedTimeline(newTimeline);

        } catch (err: any) {
            console.error('Error duplicating timeline:', err);
            addToast('error', `Erro ao duplicar rotina: ${err.message || JSON.stringify(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async () => {
        if (!selectedTimeline) return;

        const newItem = {
            timeline_id: selectedTimeline.id,
            title: 'Nova Atividade',
            type: 'academic' as TimelineItemType,
            order_index: items.length
        };

        const { data, error } = await supabase
            .from('daily_timeline_items')
            .insert([newItem])
            .select()
            .single();

        if (!error && data) {
            setItems([...items, data]);
        }
    };

    const handleLocalUpdate = (id: string, updates: Partial<DailyTimelineItem>) => {
        setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
    };

    const handleSaveItem = async (id: string, updates: Partial<DailyTimelineItem>) => {
        setSaving(true);
        try {
            await supabase
                .from('daily_timeline_items')
                .update(updates)
                .eq('id', id);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateItem = async (id: string, updates: Partial<DailyTimelineItem>) => {
        // Legacy: For direct updates (like select, drag/drop)
        handleLocalUpdate(id, updates);
        await handleSaveItem(id, updates);
    };

    const handleDeleteItem = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Remover Item',
            message: 'Remover este item?',
            type: 'warning',
            confirmText: 'Remover'
        });

        if (!isConfirmed) return;

        const { error } = await supabase.from('daily_timeline_items').delete().eq('id', id);
        if (!error) {
            setItems(items.filter(i => i.id !== id));
        }
    };

    const moveItem = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === items.length - 1) return;

        const newItems = [...items];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap locally
        const temp = newItems[index];
        newItems[index] = newItems[swapIndex];
        newItems[swapIndex] = temp;

        // Update order_index locally
        newItems[index].order_index = index;
        newItems[swapIndex].order_index = swapIndex;

        setItems(newItems);

        // Update DB
        // In a real app we might batch this, but for now simple sequential update
        await supabase.from('daily_timeline_items').update({ order_index: newItems[index].order_index }).eq('id', newItems[index].id);
        await supabase.from('daily_timeline_items').update({ order_index: newItems[swapIndex].order_index }).eq('id', newItems[swapIndex].id);
    };

    return (
        <div className="h-[calc(100vh-16rem)] min-h-[600px] flex flex-col animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Rotinas e Timelines</h1>
                    <p className="text-gray-500">Configure os horários e atividades para turmas ou alunos.</p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Rotina
                </Button>
            </div>



            {/* Display Settings Card */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex justify-between items-center animate-fade-in">
                <div>
                    <h3 className="font-semibold text-gray-800">Visualização no App dos Pais</h3>
                    <p className="text-sm text-gray-500">Ative ou desative a exibição da timeline de rotina para os pais.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => updateDisplayMode('graph')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${displayMode !== 'disabled' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Ativado
                    </button>
                    <button
                        onClick={() => updateDisplayMode('disabled')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${displayMode === 'disabled' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Desativado
                    </button>
                </div>
            </div>

            <div className="flex gap-6 h-full items-start overflow-hidden">
                {/* Left Sidebar: List of Timelines */}
                <Card className="w-1/3 flex flex-col h-full bg-white shadow-sm border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-medium text-gray-700">
                        Rotinas Disponíveis
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {loading && <div className="p-4 text-center text-gray-400">Carregando...</div>}
                        {!loading && timelines.length === 0 && (
                            <div className="p-4 text-center text-gray-400 text-sm">Nenhuma rotina criada.</div>
                        )}
                        {timelines.map(timeline => (
                            <div
                                key={timeline.id}
                                onClick={() => setSelectedTimeline(timeline)}
                                className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group transition-colors ${selectedTimeline?.id === timeline.id
                                    ? 'bg-brand-50 border-brand-200 border text-brand-700'
                                    : 'hover:bg-gray-50 border border-transparent'
                                    }`}
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{timeline.name}</span>
                                    <span className="text-xs text-gray-400">
                                        {timeline.is_default ? 'Padrão' : 'Personalizada'}
                                    </span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDuplicateTimeline(timeline.id); }}
                                        className="p-1.5 text-gray-400 hover:text-blue-500 rounded-md"
                                        title="Duplicar Rotina"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTimeline(timeline.id); }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-md"
                                        title="Excluir Rotina"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Right Content: Editor */}
                <div className="flex-1 h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {selectedTimeline ? (
                        <>
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h2 className="font-semibold text-lg text-gray-800">{selectedTimeline.name}</h2>
                                    <p className="text-xs text-gray-500">Editando itens da timeline</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-medium transition-opacity ${saving ? 'text-brand-600 opacity-100' : 'text-gray-400 opacity-0'}`}>
                                        Salvando...
                                    </span>
                                    <span className={`text-xs font-medium text-gray-400 transition-opacity ${!saving ? 'opacity-100' : 'opacity-0'}`}>
                                        Alterações salvas automaticamente
                                    </span>
                                    <Button size="sm" variant="outline" onClick={handleAddItem}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar Item
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                                {loadingItems ? (
                                    <div className="text-center p-8 text-gray-400">Carregando itens...</div>
                                ) : (
                                    <div className="space-y-3 max-w-3xl mx-auto">
                                        {items.length === 0 && (
                                            <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>Nenhuma atividade nesta rotina ainda.</p>
                                                <Button variant="ghost" onClick={handleAddItem}>Adicionar primeira atividade</Button>
                                            </div>
                                        )}
                                        {items.map((item, idx) => (
                                            <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex gap-4 items-start group hover:border-brand-200 transition-colors">
                                                {/* Drag Handle / Index */}
                                                <div className="flex flex-col gap-1 pt-2 text-gray-300">
                                                    <button
                                                        onClick={() => moveItem(idx, 'up')}
                                                        disabled={idx === 0}
                                                        className="hover:text-brand-600 disabled:opacity-30"
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => moveItem(idx, 'down')}
                                                        disabled={idx === items.length - 1}
                                                        className="hover:text-brand-600 disabled:opacity-30"
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Content Inputs */}
                                                <div className="flex-1 grid grid-cols-12 gap-4">
                                                    <div className="col-span-2">
                                                        <label className="text-xs text-gray-500 mb-1 block">Início</label>
                                                        <input
                                                            type="time"
                                                            className="w-full text-sm border-gray-200 rounded-md focus:ring-brand-500 focus:border-brand-500"
                                                            value={item.start_time?.slice(0, 5) || ''}
                                                            onChange={(e) => handleLocalUpdate(item.id, { start_time: e.target.value })}
                                                            onBlur={(e) => handleSaveItem(item.id, { start_time: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="col-span-5">
                                                        <label className="text-xs text-gray-500 mb-1 block">Título</label>
                                                        <input
                                                            type="text"
                                                            className="w-full text-sm border-gray-200 rounded-md focus:ring-brand-500 focus:border-brand-500 font-medium"
                                                            value={item.title}
                                                            onChange={(e) => handleLocalUpdate(item.id, { title: e.target.value })}
                                                            onBlur={(e) => handleSaveItem(item.id, { title: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                                                        <select
                                                            className="w-full text-sm border-gray-200 rounded-md focus:ring-brand-500 focus:border-brand-500"
                                                            value={item.type}
                                                            onChange={(e) => handleUpdateItem(item.id, { type: e.target.value as TimelineItemType })}
                                                        >
                                                            <option value="academic">Aula/Atividade</option>
                                                            <option value="food">Alimentação</option>
                                                            <option value="rest">Descanso</option>
                                                            <option value="transport">Entrada/Saída</option>
                                                            <option value="other">Outro</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-2 flex items-end justify-end">
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                            title="Excluir item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Clock className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Selecione ou crie uma rotina</p>
                            <p className="text-sm">Os detalhes aparecerão aqui.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={iscreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Nova Rotina Diária"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Rotina</label>
                        <Input
                            value={newTimelineName}
                            onChange={(e) => setNewTimelineName(e.target.value)}
                            placeholder="Ex: Berçário Manhã, Infantil Integral..."
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateTimeline} disabled={!newTimelineName.trim()}>Criar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
