
import { type FC, useState, useEffect, useMemo, useRef } from 'react';
import { Button, Modal, Input } from '../components/ui';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    Trash2,
    Upload,
    Calendar,
    ImageIcon
} from 'lucide-react';
import { ImageCropper } from '../components/ui/ImageCropper';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';

// Constants
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface Event {
    id?: string;
    title: string;
    description?: string;
    start_time: string; // ISO string
    end_time?: string;   // ISO string
    type: 'academic' | 'holiday' | 'meeting' | 'other' | 'generic';
    category?: 'event' | 'notice' | 'alert' | 'mural';
    is_pinned?: boolean;
    class_id?: string | null;
    show_on_mural?: boolean;
    image_url?: string;
    location?: string;
    created_by?: string;
}

interface ClassOption {
    id: string;
    name: string;
    shift: string;
}

export const AgendaView: FC = () => {
    const { user, currentSchool } = useAuth();
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const [viewDate, setViewDate] = useState(new Date());
    const [events, setEvents] = useState<Event[]>([]);
    const [classes, setClasses] = useState<ClassOption[]>([]);

    // Filter State
    const [filterType, setFilterType] = useState<'all' | 'academic' | 'holiday' | 'meeting'>('all');

    // Timeline State
    const [timelineTab, setTimelineTab] = useState<'upcoming' | 'past'>('upcoming');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<Event>({
        title: '',
        start_time: '',
        type: 'academic',
        category: 'event',
        is_pinned: false,
        class_id: null,
        description: '',
        show_on_mural: false,
        image_url: '',
        location: ''
    });
    const [uploading, setUploading] = useState(false);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState(new Date());
    const [selectedClasses, setSelectedClasses] = useState<string[]>(['global']);
    const activeDayRef = useRef<HTMLButtonElement>(null);

    // Auto-scroll para o dia selecionado no mobile
    useEffect(() => {
        if (activeDayRef.current) {
            activeDayRef.current.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest'
            });
        }
    }, [selectedDay]);

    const getEventStyle = (type: string, category?: string) => {
        const base = "text-[10px] px-2 py-0.5 rounded-lg truncate border flex items-center gap-1.5 transition-all";
        if (category === 'notice') return `${base} bg-amber-50 text-amber-700 border-amber-200`;
        if (category === 'alert') return `${base} bg-rose-50 text-rose-700 border-rose-200`;
        switch (type) {
            case 'academic': return `${base} bg-blue-50 text-blue-700 border-blue-200`;
            case 'holiday': return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
            case 'meeting': return `${base} bg-purple-50 text-purple-700 border-purple-200`;
            default: return `${base} bg-slate-50 text-slate-700 border-slate-200`;
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'academic': return '📚';
            case 'holiday': return '🎉';
            case 'meeting': return '👥';
            default: return '📌';
        }
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const fetchEvents = async () => {
        if (!currentSchool) return;

        const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString();
        const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

        let query = supabase
            .from('events')
            .select('*')
            .eq('school_id', currentSchool.id)
            .gte('start_time', start)
            .lte('start_time', end);

        if (user?.role === 'TEACHER') {
            // Professores veem eventos da Escola Toda (null) OU de suas Turmas
            const myClassIds = classes.map(c => c.id);
            if (myClassIds.length > 0) {
                query = query.or(`class_id.is.null,class_id.in.(${myClassIds.join(',')})`);
            } else {
                // Se não tem turmas, vê apenas os eventos globais da escola
                query = query.is('class_id', null);
            }
        }

        const { data, error } = await query.order('start_time');
        if (error) console.error(error);
        if (data) setEvents(data);
    };

    useEffect(() => {
        const fetchClasses = async () => {
            if (!currentSchool) return;
            const currentYear = new Date().getFullYear();

            const { data } = await (user?.role === 'TEACHER'
                ? supabase
                    .from('classes')
                    .select('id, name, shift, class_teachers!inner(teacher_id)')
                    .eq('school_id', currentSchool.id)
                    .eq('school_year', currentYear)
                    .eq('class_teachers.teacher_id', user.id)
                    .order('name')
                : supabase
                    .from('classes')
                    .select('id, name, shift')
                    .eq('school_id', currentSchool.id)
                    .eq('school_year', currentYear)
                    .order('name')
            );

            if (data) setClasses(data as any);
        };
        if (user && currentSchool) fetchClasses();
    }, [user, currentSchool]);

    useEffect(() => {
        if (currentSchool?.id) fetchEvents();
    }, [viewDate, currentSchool?.id, classes, user?.id]);

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const openCreateModal = () => {
        setIsEditing(false);
        const now = new Date();
        const defaultDate = now.toISOString().substring(0, 16);
        setCurrentEvent({
            title: '',
            start_time: defaultDate,
            end_time: '',
            type: 'academic',
            category: 'event',
            is_pinned: false,
            class_id: null,
            description: '',
            show_on_mural: false,
            image_url: '',
            location: ''
        });
        setSelectedClasses(user?.role === 'TEACHER' ? [] : ['global']);
        setShowModal(true);
    };

    const openEditModal = (event: Event) => {
        setIsEditing(true);
        setCurrentEvent(event);
        setSelectedClasses(event.class_id ? [event.class_id] : ['global']);
        setShowModal(true);
    };

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            setPendingImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = async (blob: Blob) => {
        setPendingImage(null);
        try {
            setUploading(true);
            const fileName = `mural_${Math.random().toString(36).substring(2)}.webp`;

            // Se já tem uma imagem, remove do storage antes de subir a nova
            if (currentEvent.image_url) {
                await deleteStorageFile(currentEvent.image_url);
            }

            const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, blob, {
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: false
            });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('photos').getPublicUrl(fileName);
            setCurrentEvent(prev => ({ ...prev, image_url: data.publicUrl }));
            addToast('success', 'Imagem processada e enviada!');
        } catch (error: any) {
            addToast('error', 'Erro no processamento: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    // Helper functions for date and storage
    const formatDateTimeLocal = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            // Ajusta para o fuso horário local
            const offset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - offset);
            return localDate.toISOString().slice(0, 16);
        } catch (e) {
            return '';
        }
    };

    const deleteStorageFile = async (url: string) => {
        if (!url) return;
        try {
            const fileName = url.split('/').pop();
            if (fileName) {
                await supabase.storage.from('photos').remove([fileName]);
            }
        } catch (e) {
            console.error('Erro ao deletar arquivo do storage:', e);
        }
    };

    const handleSaveEvent = async () => {
        if (!currentEvent.title) return addToast('error', 'Título obrigatório');
        if (currentEvent.show_on_mural && !currentEvent.image_url) {
            return addToast('error', 'Para destacar no mural, você deve enviar uma imagem de capa.');
        }

        const canManageGlobal = user?.role === 'ADMIN' || user?.role === 'SECRETARY';
        const hasGlobal = selectedClasses.includes('global');
        if (!canManageGlobal && hasGlobal) {
            return addToast('error', 'Apenas administradores ou secretaria podem criar eventos para toda a escola');
        }

        try {
            const basePayload = {
                school_id: currentSchool?.id,
                title: currentEvent.title,
                description: currentEvent.description,
                start_time: new Date(currentEvent.start_time).toISOString(),
                end_time: currentEvent.end_time ? new Date(currentEvent.end_time).toISOString() : null,
                type: currentEvent.type,
                category: currentEvent.category || 'event',
                is_pinned: currentEvent.is_pinned || false,
                show_on_mural: currentEvent.show_on_mural || false,
                image_url: currentEvent.image_url || null,
                location: currentEvent.location || null,
                created_by: user?.id
            };

            if (isEditing && currentEvent.id) {
                const payload = { ...basePayload, class_id: currentEvent.class_id };
                const res = await supabase.from('events').update(payload).eq('id', currentEvent.id);
                if (res.error) throw res.error;
            } else {
                if (selectedClasses.length === 0) {
                    return addToast('error', 'Por favor, selecione ao menos uma turma.');
                }

                const payloads = selectedClasses.map(clsId => ({
                    ...basePayload,
                    class_id: clsId === 'global' ? null : clsId
                }));
                const res = await supabase.from('events').insert(payloads);
                if (res.error) throw res.error;
            }

            addToast('success', isEditing ? 'Evento atualizado!' : 'Evento criado!');
            setShowModal(false);
            fetchEvents();
        } catch (error: any) {
            addToast('error', 'Erro ao salvar: ' + error.message);
        }
    };

    const handleDeleteEvent = async () => {
        if (!currentEvent.id) return;
        const canManageGlobal = user?.role === 'ADMIN' || user?.role === 'SECRETARY';
        if (!canManageGlobal && !currentEvent.class_id) {
            return addToast('error', 'Apenas administradores ou secretaria podem excluir eventos da escola');
        }

        const isConfirmed = await confirm({ title: 'Excluir?', message: 'Tem certeza?', type: 'danger' });
        if (!isConfirmed) return;

        // Limpa imagem do storage se existir
        if (currentEvent.image_url) {
            await deleteStorageFile(currentEvent.image_url);
        }

        const { error } = await supabase.from('events').delete().eq('id', currentEvent.id);
        if (error) return addToast('error', error.message);
        addToast('success', 'Excluído');
        setShowModal(false);
        fetchEvents();
    };

    const memoizedCalendar = useMemo(() => {
        const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
        const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-brand-50/20 border border-slate-50" />);
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), i);
            const dayEvents = events
                .filter(e => new Date(e.start_time).toDateString() === date.toDateString())
                .filter(e => filterType === 'all' || e.type === filterType);
            const isToday = new Date().toDateString() === date.toDateString();
            const isSelected = selectedDay.toDateString() === date.toDateString();

            days.push(
                <div
                    key={i}
                    onClick={() => setSelectedDay(date)}
                    className={`min-h-[110px] border border-slate-50 p-2 transition-all relative group cursor-pointer
                        ${isSelected ? 'bg-brand-50/50 ring-2 ring-brand-200/50 z-10' : 'bg-white hover:bg-slate-50'}
                    `}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="relative">
                            <span className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl transition-all
                                ${isToday ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : isSelected ? 'bg-brand-100 text-brand-700' : 'text-slate-400 opacity-60'}
                            `}>
                                {i}
                            </span>
                            {dayEvents.length > 0 && !isToday && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-500 rounded-full border-2 border-white shadow-sm" />
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        {dayEvents.slice(0, 3).map(ev => (
                            <div key={ev.id} className={`${getEventStyle(ev.type, ev.category)} shadow-sm`}>
                                <span className="truncate flex-1 font-bold">{ev.title}</span>
                            </div>
                        ))}
                        {dayEvents.length > 3 && <span className="text-[9px] font-black text-slate-300 ml-1">+{dayEvents.length - 3} mais</span>}
                    </div>
                </div>
            );
        }
        return days;
    }, [viewDate, events, selectedDay, filterType]);

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Padronizado */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-brand-900 tracking-tight">Agenda</h1>
                    <p className="text-brand-800 font-medium">Gestão centralizada de eventos e compromissos.</p>
                </div>
                <Button onClick={openCreateModal} className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-200 rounded-2xl px-6">
                    <Plus className="w-4 h-4 mr-2" /> Novo Registro
                </Button>
            </div>

            {/* Desktop UI */}
            <div className="hidden md:flex gap-8 items-start">
                {/* Main Calendar Column */}
                <div className="flex-1 flex flex-col gap-6">
                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200/60">
                        <div className="flex bg-slate-100/80 p-1 rounded-xl">
                            {['all', 'academic', 'holiday', 'meeting'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterType(t as any)}
                                    className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${filterType === t ? 'bg-white text-brand-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t === 'all' ? 'Tudo' : t === 'academic' ? 'Acadêmico' : t === 'holiday' ? 'Feriados' : 'Reuniões'}
                                </button>
                            ))}
                        </div>
                        <div className="w-px h-8 bg-slate-200" />
                        <div className="flex items-center gap-3 pr-2">
                            <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-10 w-10 p-0 rounded-xl hover:bg-slate-50"><ChevronLeft className="w-5 h-5 text-slate-400" /></Button>
                            <div className="min-w-[150px] text-center">
                                <span className="text-xs font-black text-brand-900 uppercase tracking-[0.2em] block leading-none mb-1">{MONTHS[viewDate.getMonth()]}</span>
                                <span className="text-sm font-bold text-brand-900 tracking-tight">{viewDate.getFullYear()}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-10 w-10 p-0 rounded-xl hover:bg-slate-50"><ChevronRight className="w-5 h-5 text-slate-400" /></Button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/20 border border-slate-100 flex flex-col overflow-hidden min-h-[600px]">
                        <div className="grid grid-cols-7 bg-brand-50/50 border-b border-slate-100">
                            {DAYS.map(d => (
                                <div key={d} className="py-5 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    {d}
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
                            {memoizedCalendar}
                        </div>
                    </div>
                </div>

                {/* Sidebar Feed */}
                <div className="w-[380px] flex flex-col gap-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col overflow-hidden min-h-[700px]">
                        <div className="p-2 bg-slate-50 rounded-3xl m-4 flex gap-1">
                            {['upcoming', 'past'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTimelineTab(t as any); setSelectedDay(new Date()); }}
                                    className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all ${timelineTab === t ? 'bg-white text-brand-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t === 'upcoming' ? 'Timeline' : 'Arquivo'}
                                </button>
                            ))}
                        </div>

                        <div className="px-6 mb-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                                <h4 className="text-xs font-black text-brand-900 uppercase tracking-widest">
                                    {selectedDay.toDateString() === new Date().toDateString() ? 'Próximos Eventos' : selectedDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                                </h4>
                            </div>
                            <button onClick={() => setSelectedDay(new Date())} className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg hover:bg-brand-100">Redefinir</button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar space-y-8">
                            {(() => {
                                const isFocused = selectedDay.toDateString() !== new Date().toDateString();
                                let filtered = [...events]
                                    .filter(e => filterType === 'all' || e.type === filterType)
                                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                                if (isFocused) {
                                    filtered = filtered.filter(e => new Date(e.start_time).toDateString() === selectedDay.toDateString());
                                } else {
                                    filtered = timelineTab === 'upcoming'
                                        ? filtered.filter(e => new Date(e.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)))
                                        : filtered.filter(e => new Date(e.start_time) < new Date(new Date().setHours(0, 0, 0, 0))).reverse();
                                }

                                if (filtered.length === 0) return <p className="text-center py-20 text-xs font-black text-slate-300 uppercase tracking-widest">Nenhum evento</p>;

                                const grouped: { [k: string]: Event[] } = {};
                                filtered.forEach(e => {
                                    const k = new Date(e.start_time).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
                                    if (!grouped[k]) grouped[k] = [];
                                    grouped[k].push(e);
                                });

                                return Object.entries(grouped).map(([dayKey, dayEvents]) => (
                                    <div key={dayKey} className="relative pl-7 border-l-2 border-slate-100">
                                        <div className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-4 border-white ${new Date(dayEvents[0].start_time).toDateString() === new Date().toDateString() ? 'bg-brand-500' : 'bg-slate-200'}`} />
                                        <h5 className="text-[10px] font-black uppercase text-slate-400 mb-5 tracking-[0.2em]">{dayKey}</h5>
                                        <div className="space-y-4">
                                            {dayEvents.map(e => (
                                                <div key={e.id} onClick={() => openEditModal(e)} className="group rounded-3xl transition-all cursor-pointer overflow-hidden border bg-white border-slate-100 hover:border-brand-200 p-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-50 text-slate-600">
                                                            {new Date(e.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className="text-lg">{getEventIcon(e.type)}</span>
                                                    </div>
                                                    <h4 className="text-sm font-black text-brand-800 leading-tight mb-2">{e.title}</h4>
                                                    {e.location && (
                                                        <div className="flex items-center gap-1.5 mb-3 text-slate-400">
                                                            <span className="text-[10px]">📍</span>
                                                            <span className="text-[10px] font-bold truncate max-w-[200px]">{e.location}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${getEventStyle(e.type, e.category)}`}>{e.type}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile UI */}
            <div className="md:hidden flex flex-col min-h-screen bg-white -mx-4">
                <div className="bg-white/90 backdrop-blur-xl px-4 pt-4 pb-2 border-b border-slate-100 sticky top-0 z-30">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-xl font-black text-brand-900 leading-none">Agenda</h1>
                            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-1">
                                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                            </p>
                        </div>
                        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0"><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
                        {(() => {
                            const days = [];
                            for (let i = 1; i <= getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()); i++) {
                                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), i);
                                const hasEvents = events.some(e => new Date(e.start_time).toDateString() === d.toDateString());
                                const isSel = selectedDay.toDateString() === d.toDateString();

                                days.push(
                                    <button
                                        key={i}
                                        ref={isSel ? activeDayRef : null}
                                        onClick={() => setSelectedDay(d)}
                                        className={`flex flex-col items-center shrink-0 w-12 h-16 rounded-[1rem] transition-all relative ${isSel ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'bg-slate-50 text-slate-400'}`}
                                    >
                                        <span className="text-[8px] font-bold uppercase mt-2">{DAYS[d.getDay()]}</span>
                                        <span className="text-base font-black">{i}</span>
                                        {hasEvents && (
                                            <div className={`w-1 h-1 rounded-full mb-2 ${isSel ? 'bg-brand-400' : 'bg-brand-500'}`} />
                                        )}
                                    </button>
                                );
                            }
                            return days;
                        })()}
                    </div>
                </div>
                <div className="p-4 space-y-4 pb-32">
                    {(() => {
                        const dayEvs = events.filter(e => new Date(e.start_time).toDateString() === selectedDay.toDateString());

                        if (dayEvs.length === 0) return (
                            <div className="py-20 flex flex-col items-center opacity-40">
                                <Calendar className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Nenhum evento</p>
                            </div>
                        );

                        return dayEvs.map(ev => (
                            <div key={ev.id} onClick={() => openEditModal(ev)} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm active:scale-95 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-brand-900">{new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-lg">{getEventIcon(ev.type)}</span>
                                    </div>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${getEventStyle(ev.type, ev.category)}`}>{ev.type}</span>
                                </div>
                                <h4 className="font-black text-brand-800 text-sm leading-tight">{ev.title}</h4>
                                {ev.location && (
                                    <div className="flex items-center gap-1 mt-1.5 text-slate-400">
                                        <span className="text-[10px]">📍</span>
                                        <span className="text-[10px] font-bold">{ev.location}</span>
                                    </div>
                                )}
                            </div>
                        ));
                    })()}
                </div>
                <button onClick={openCreateModal} className="fixed bottom-10 right-6 w-16 h-16 bg-brand-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 border-4 border-white active:scale-90 transition-all shadow-brand-500/40">
                    <Plus className="w-8 h-8" />
                </button>
            </div>

            {/* Modal */}
            {showModal && (
                <Modal
                    isOpen={showModal}
                    size="lg"
                    title={(() => {
                        const canEdit = (user?.role === 'ADMIN' || user?.role === 'SECRETARY') ||
                            (!currentEvent.id) || // Criando novo
                            (currentEvent.created_by === user?.id && new Date(currentEvent.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)));

                        if (!canEdit) return 'Detalhes do Evento (Somente Leitura)';
                        return isEditing ? 'Configurações do Evento' : 'Novo Planejamento';
                    })()}
                    onClose={() => setShowModal(false)}
                    footer={
                        (() => {
                            const canEdit = (user?.role === 'ADMIN' || user?.role === 'SECRETARY') ||
                                (!currentEvent.id) ||
                                (currentEvent.created_by === user?.id && new Date(currentEvent.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)));

                            if (!canEdit) return <div className="flex justify-end w-full"><Button variant="ghost" onClick={() => setShowModal(false)} className="rounded-2xl border px-6 font-black text-xs uppercase">Fechar</Button></div>;

                            return (
                                <div className="flex justify-between items-center w-full pt-2">
                                    {isEditing && currentEvent.id ? (
                                        <Button variant="ghost" onClick={handleDeleteEvent} className="text-rose-600 px-6 font-black text-xs uppercase"><Trash2 className="w-4 h-4 mr-2" /> Excluir</Button>
                                    ) : <div />}
                                    <div className="flex gap-3">
                                        <Button variant="ghost" onClick={() => setShowModal(false)} className="rounded-2xl border px-6 font-black text-xs uppercase">Cancelar</Button>
                                        <Button onClick={handleSaveEvent} className="bg-brand-600 text-white rounded-2xl px-8 font-black text-xs uppercase shadow-lg shadow-brand-200">Confirmar</Button>
                                    </div>
                                </div>
                            );
                        })()
                    }
                >
                    {(() => {
                        const canEdit = (user?.role === 'ADMIN' || user?.role === 'SECRETARY') ||
                            (!currentEvent.id) ||
                            (currentEvent.created_by === user?.id && new Date(currentEvent.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)));

                        return (
                            <div className={`space-y-6 py-4 ${!canEdit ? 'opacity-80 pointer-events-none grayscale-[0.5]' : ''}`}>
                                {!canEdit && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex items-center gap-2 pointer-events-auto">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        <p className="text-[10px] text-amber-800 font-bold uppercase">
                                            Modo Somente Leitura: Você não tem permissão para editar este evento.
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">O que vai acontecer?</label>
                                    <Input
                                        readOnly={!canEdit}
                                        placeholder="Título do Evento"
                                        value={currentEvent.title}
                                        onChange={e => setCurrentEvent({ ...currentEvent, title: e.target.value })}
                                        className="h-14 text-lg font-bold rounded-2xl"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                                        <select
                                            disabled={!canEdit}
                                            className="w-full h-12 border rounded-2xl px-4 text-sm font-bold bg-slate-50 disabled:opacity-50"
                                            value={currentEvent.type}
                                            onChange={e => setCurrentEvent({ ...currentEvent, type: e.target.value as any })}
                                        >
                                            <option value="academic">📚 Acadêmico</option>
                                            <option value="holiday">🎉 Feriado</option>
                                            <option value="meeting">🤝 Reunião</option>
                                            <option value="other">✨ Outro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Data/Hora</label>
                                        <Input
                                            readOnly={!canEdit}
                                            type="datetime-local"
                                            value={formatDateTimeLocal(currentEvent.start_time)}
                                            onChange={e => setCurrentEvent({ ...currentEvent, start_time: e.target.value })}
                                            className="h-12 font-bold rounded-2xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Onde será?</label>
                                    <Input
                                        readOnly={!canEdit}
                                        placeholder="Local (ex: Sala de Reunião, Auditório...)"
                                        value={currentEvent.location}
                                        onChange={e => setCurrentEvent({ ...currentEvent, location: e.target.value })}
                                        className="h-12 font-bold rounded-2xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Destinatários</label>
                                    <div className={`flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border ${!canEdit ? 'opacity-50' : ''}`}>
                                        {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                            <button
                                                disabled={!canEdit}
                                                onClick={() => setSelectedClasses(['global'])}
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase border ${selectedClasses.includes('global') ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-400'}`}
                                            >
                                                🌍 Escola Inteira
                                            </button>
                                        )}
                                        {classes.map(cls => (
                                            <button key={cls.id} disabled={!canEdit} onClick={() => {
                                                if (selectedClasses.includes('global')) setSelectedClasses([cls.id]);
                                                else setSelectedClasses(prev => prev.includes(cls.id) ? prev.filter(id => id !== cls.id) : [...prev, cls.id]);
                                            }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase border ${selectedClasses.includes(cls.id) ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>🎓 {cls.name}</button>
                                        ))}
                                    </div>
                                    {selectedClasses.length === 0 && canEdit && (
                                        <p className="text-[10px] text-rose-500 font-bold mt-2 ml-1 animate-pulse">
                                            Selecione ao menos uma turma para prosseguir
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas</label>
                                    <textarea
                                        readOnly={!canEdit}
                                        className="w-full min-h-[100px] border rounded-2xl p-4 text-sm font-medium bg-slate-50 resize-none disabled:bg-slate-100"
                                        placeholder="Descrição opcional..."
                                        value={currentEvent.description}
                                        onChange={e => setCurrentEvent({ ...currentEvent, description: e.target.value })}
                                    />
                                </div>

                                {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <ImageIcon className="w-5 h-5 text-amber-600" />
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-amber-900">Destaque no Mural</h4>
                                            <p className="text-[10px] text-amber-700 font-medium">Este evento aparecerá no carrossel inicial do App.</p>
                                        </div>
                                        <input
                                            disabled={!canEdit}
                                            type="checkbox"
                                            checked={currentEvent.show_on_mural}
                                            onChange={e => setCurrentEvent({ ...currentEvent, show_on_mural: e.target.checked })}
                                            className="w-5 h-5 accent-amber-600 shadow-sm"
                                        />
                                    </div>
                                )}

                                {currentEvent.show_on_mural && (
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagem de Capa</label>
                                        <div className="border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-white transition-colors">
                                            {currentEvent.image_url ? (
                                                <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-inner font-black">
                                                    <img src={currentEvent.image_url} className="w-full h-full object-cover" alt="Capa" />
                                                    {canEdit && (
                                                        <button
                                                            onClick={async () => {
                                                                if (currentEvent.image_url) {
                                                                    await deleteStorageFile(currentEvent.image_url);
                                                                    setCurrentEvent({ ...currentEvent, image_url: '' });
                                                                }
                                                            }}
                                                            className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <label className={`cursor-pointer flex flex-col items-center p-6 w-full group ${!canEdit ? 'pointer-events-none opacity-50' : ''}`}>
                                                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                                                        {uploading ? <Clock className="w-6 h-6 animate-spin text-slate-400" /> : <Upload className="w-6 h-6 text-slate-400" />}
                                                    </div>
                                                    <span className="text-[10px] font-black mt-3 uppercase tracking-widest text-slate-400">Clique para selecionar</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} disabled={uploading || !canEdit} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </Modal>
            )}

            {/* Image Cropper Modal Layer */}
            {pendingImage && (
                <ImageCropper
                    image={pendingImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setPendingImage(null)}
                    aspectRatio={21 / 9} // Aspecto ultra-wide para banners do app
                />
            )}
        </div>
    );
};
