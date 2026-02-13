import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommunicationChannel } from '../../types';
import { Loader2, Send, Users, Sparkles, AlertCircle, Layout, CheckCircle2 } from 'lucide-react';
import { PhonePreview } from '../../components/communications/PhonePreview';
import * as Icons from 'lucide-react';

const CommunicationsComposer: React.FC = () => {
    const { user, currentSchool } = useAuth();
    const [channels, setChannels] = useState<CommunicationChannel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [targetType, setTargetType] = useState<'SCHOOL' | 'CLASS' | 'STUDENT'>(user?.role === 'TEACHER' ? 'CLASS' : 'SCHOOL');
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<{ id: string, name: string }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: string, name: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [availableClasses, setAvailableClasses] = useState<{ id: string, name: string }[]>([]);
    const [priority, setPriority] = useState<number>(1);


    // Interaction Templates
    const [interactionType, setInteractionType] = useState<'NONE' | 'RSVP' | 'POLL'>('NONE');
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

    const [sending, setSending] = useState(false);

    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchChannels();
        fetchClasses();
    }, [currentSchool]);

    const fetchChannels = async () => {
        const { data } = await supabase.from('communication_channels').select('*').order('name');
        if (data) {
            let filteredChannels = data;
            if (user?.role === 'TEACHER') {
                const allowedNames = ['Eventos', 'Geral', 'Urgente'];
                filteredChannels = data.filter(c => allowedNames.includes(c.name));
            }
            setChannels(filteredChannels);
            if (filteredChannels.length > 0) setSelectedChannelId(filteredChannels[0].id);
        }
    };

    const fetchClasses = async () => {
        if (!currentSchool) return;

        const selectStr = user?.role === 'TEACHER'
            ? 'id, name, class_teachers!inner(teacher_id)'
            : 'id, name';

        let query = supabase.from('classes')
            .select(selectStr)
            .eq('status', 'active')
            .eq('school_id', currentSchool.id);

        if (user?.role === 'TEACHER') {
            query = query.eq('class_teachers.teacher_id', user.id);
        }

        const { data } = await query.order('name');
        if (data) setAvailableClasses(data as any);
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (targetType === 'STUDENT' && searchTerm.length > 2 && currentSchool) {
                setIsSearching(true);

                const selectStr = user?.role === 'TEACHER'
                    ? `id, name, class_enrollments!inner(class:classes!inner(id, class_teachers!inner(teacher_id)))`
                    : 'id, name';

                let query = supabase
                    .from('students')
                    .select(selectStr)
                    .ilike('name', `%${searchTerm}%`)
                    .eq('active', true)
                    .eq('school_id', currentSchool.id);

                if (user?.role === 'TEACHER') {
                    query = query.eq('class_enrollments.class.class_teachers.teacher_id', user.id);
                }

                const { data } = await query.limit(10);
                if (data) setSearchResults(data as any);
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, targetType]);

    const selectedChannel = channels.find(c => c.id === selectedChannelId);

    // Send Push Notifications via Edge Function
    const sendPushNotifications = async (commId: string) => {
        try {
            console.log('Requesting push notifications for:', commId);

            const standardizedTitle = 'Nova mensagem';
            const standardizedBody = 'Você recebeu uma nova mensagem';

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                console.error('No active session for push notification');
                return;
            }

            await supabase.functions.invoke('send-push', {
                body: {
                    communication_id: commId,
                    title: standardizedTitle,
                    body: standardizedBody,
                    tag: `comm-${commId}`
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            console.log('Push notification request sent.');
        } catch (err) {
            console.error('Error triggering push notifications:', err);
        }
    };

    // Helper to distribute message (Insert Recipients)
    const handleDistribution = async (commId: string) => {
        try {
            console.log('Distributing message...');
            let targets: { student_id: string, guardian_id: string }[] = [];

            if (targetType === 'STUDENT') {
                const { data } = await supabase
                    .from('student_guardians')
                    .select('student_id, guardian_id')
                    .in('student_id', selectedStudents.map(s => s.id));
                if (data) targets = data;

            } else if (targetType === 'CLASS') {
                const { data: enrollments } = await supabase
                    .from('class_enrollments')
                    .select('student_id')
                    .in('class_id', selectedClasses);

                const studentIds = enrollments?.map(e => e.student_id) || [];
                if (studentIds.length > 0) {
                    const { data } = await supabase
                        .from('student_guardians')
                        .select('student_id, guardian_id')
                        .in('student_id', studentIds);
                    if (data) targets = data;
                }

            } else if (targetType === 'SCHOOL') {
                const { data: students } = await supabase
                    .from('students')
                    .select('id')
                    .eq('school_id', currentSchool?.id)
                    .eq('active', true);

                const studentIds = students?.map(s => s.id) || [];
                if (studentIds.length > 0) {
                    const { data } = await supabase
                        .from('student_guardians')
                        .select('student_id, guardian_id')
                        .in('student_id', studentIds);
                    if (data) targets = data;
                }
            }

            if (targets.length === 0) {
                console.log('No targets found.');
                return;
            }

            // Deduplicate pairs
            const uniquePairs = targets.filter((v, i, a) =>
                a.findIndex(t => t.student_id === v.student_id && t.guardian_id === v.guardian_id) === i
            );

            console.log(`Inserting ${uniquePairs.length} recipients...`);

            // Insert in batches
            const INSERT_BATCH = 50;
            for (let i = 0; i < uniquePairs.length; i += INSERT_BATCH) {
                const batch = uniquePairs.slice(i, i + INSERT_BATCH).map(t => ({
                    communication_id: commId,
                    guardian_id: t.guardian_id,
                    student_id: t.student_id,
                    is_archived: false,
                    // removed is_read (doesn't exist)
                    created_at: new Date().toISOString()
                }));

                const { error } = await supabase.from('communication_recipients').insert(batch);
                if (error) console.error('Error inserting recipients:', error);
            }

            // Trigger Push Notifications
            sendPushNotifications(commId);
        } catch (err) {
            console.error('Error in distribution:', err);
        }
    };



    const handleSend = async () => {
        if (!title || !content || !selectedChannelId || !currentSchool) return;

        try {
            setSending(true);
            const metadata: any = {};
            if (interactionType === 'RSVP') {
                metadata.template = 'rsvp';
                metadata.options = ['Estarei Presente', 'Não Poderei Comparecer'];
            } else if (interactionType === 'POLL') {
                metadata.template = 'poll';
                metadata.question = pollQuestion;
                metadata.options = pollOptions.filter(o => o.trim() !== '');
            }

            // DB SPECIFIC MAPPING FOR MIXED-CASE CONSTRAINT
            // Constraint allows ONLY: 'SCHOOL', 'CLASS', 'student'
            const dbTargetType =
                targetType === 'SCHOOL' ? 'SCHOOL' :
                    targetType === 'CLASS' ? 'CLASS' :
                        'student';

            // DIRECT INSERT
            const communicationData = {
                channel_id: selectedChannelId,
                sender_profile_id: user?.id,
                title: title,
                preview_text: content.substring(0, 140),
                content: content.replace(/\n/g, '<br/>'),
                priority: priority,
                allow_reply: true,
                attachments: [],
                metadata: metadata,
                target_type: dbTargetType,
                target_ids: targetType === 'CLASS'
                    ? selectedClasses
                    : targetType === 'STUDENT'
                        ? selectedStudents.map(s => s.id)
                        : [],
                school_id: currentSchool.id
            };

            const { data, error } = await supabase
                .from('communications')
                .insert(communicationData)
                .select()
                .single();

            if (error) throw error;
            const newCommId = data?.id;

            console.log('Communication sent successfully:', newCommId);

            if (newCommId) {
                handleDistribution(newCommId);
            }

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setTitle('');
                setContent('');
                setInteractionType('NONE');
                setPollQuestion('');
                setPollOptions(['', '']);
                setPriority(1);
                setSelectedStudents([]);
                setSelectedClasses([]);
                setSearchTerm('');
            }, 3000);

        } catch (err: any) {
            console.error(err);
            // Enhanced error alert
            alert(`Erro ao enviar comunicado: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setSending(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-[600px] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce-slow">
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Enviado!</h2>
                <p className="text-gray-500 text-lg">Os pais receberão a notificação em instantes.</p>
                <button
                    onClick={() => setSuccess(false)}
                    className="mt-8 px-6 py-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors font-medium"
                >
                    Enviar Outro
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-100px)]">
            {/* LEFT COLUMN: EDITOR */}
            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col animate-slide-in-left">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Layout size={20} />
                        </span>
                        Criar Comunicado
                    </h1>
                    <p className="text-gray-400 text-sm mt-1 ml-14">Preencha os dados abaixo para notificar os pais.</p>
                </div>

                <div className="space-y-8 flex-1">

                    {/* SECTION 1: CHANNEL */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Canal de Envio</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {channels.map(channel => {
                                // @ts-ignore
                                const Icon = Icons[channel.icon_name.charAt(0).toUpperCase() + channel.icon_name.slice(1)] || Icons.MessageSquare;
                                const isSelected = selectedChannelId === channel.id;

                                const colorMap: Record<string, string> = {
                                    blue: 'border-blue-500 bg-blue-50 text-blue-700 select-bg-white bullet-bg-blue-500',
                                    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700 select-bg-white bullet-bg-emerald-500',
                                    amber: 'border-amber-500 bg-amber-50 text-amber-700 select-bg-white bullet-bg-amber-500',
                                    cyan: 'border-cyan-500 bg-cyan-50 text-cyan-700 select-bg-white bullet-bg-cyan-500',
                                    indigo: 'border-indigo-500 bg-indigo-50 text-indigo-700 select-bg-white bullet-bg-indigo-500',
                                    purple: 'border-purple-500 bg-purple-50 text-purple-700 select-bg-white bullet-bg-purple-500',
                                    rose: 'border-rose-500 bg-rose-50 text-rose-700 select-bg-white bullet-bg-rose-500'
                                };
                                const colors = colorMap[channel.color] || colorMap.blue;
                                const [border, bg, text, , bullet] = colors.split(' ');

                                return (
                                    <button
                                        key={channel.id}
                                        onClick={() => setSelectedChannelId(channel.id)}
                                        className={`
                                            relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200
                                            ${isSelected
                                                ? `${border} ${bg} ${text} shadow-md`
                                                : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
                                            }
                                        `}
                                    >
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center
                                            ${isSelected ? 'bg-white' : 'bg-gray-200'}
                                        `}>
                                            <Icon size={20} />
                                        </div>
                                        <span className="font-semibold text-sm">{channel.name}</span>
                                        {isSelected && (
                                            <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${bullet.replace('bullet-', '')}`} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* SECTION 2: AUDIENCE */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Destinatários</label>
                        <div className="p-1.5 bg-gray-100 rounded-xl flex gap-1">
                            {(['SCHOOL', 'CLASS', 'STUDENT'] as const)
                                .filter(type => user?.role !== 'TEACHER' || type !== 'SCHOOL')
                                .map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setTargetType(type)}
                                        className={`
                                        flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                                        ${targetType === type
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                            }
                                    `}
                                    >
                                        {type === 'SCHOOL' && <Users size={16} />}
                                        {type === 'CLASS' && <Icons.GraduationCap size={16} />}
                                        {type === 'STUDENT' && <Icons.User size={16} />}

                                        {type === 'SCHOOL' && 'Todo Mundo'}
                                        {type === 'CLASS' && 'Por Turma'}
                                        {type === 'STUDENT' && 'Individual'}
                                    </button>
                                ))}
                        </div>

                        {targetType === 'CLASS' && (
                            <div className="animate-fade-in p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione as Turmas:</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableClasses.map(cls => (
                                        <button
                                            key={cls.id}
                                            onClick={() => {
                                                setSelectedClasses(prev =>
                                                    prev.includes(cls.id)
                                                        ? prev.filter(id => id !== cls.id)
                                                        : [...prev, cls.id]
                                                );
                                            }}
                                            className={`
                                                px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
                                                ${selectedClasses.includes(cls.id)
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                                                }
                                            `}
                                        >
                                            {cls.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {targetType === 'STUDENT' && (
                            <div className="animate-fade-in p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                                <label className="block text-sm font-medium text-gray-700">Buscar Aluno ou Responsável:</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Icons.Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Digite o nome do aluno..."
                                        className="pl-10 block w-full rounded-lg border-gray-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2"
                                    />
                                    {isSearching && (
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                                        </div>
                                    )}

                                    {/* Search Results Dropdown */}
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                            {searchResults.map((student) => (
                                                <button
                                                    key={student.id}
                                                    onClick={() => {
                                                        if (!selectedStudents.find(s => s.id === student.id)) {
                                                            setSelectedStudents([...selectedStudents, student]);
                                                        }
                                                        setSearchTerm('');
                                                        setSearchResults([]);
                                                    }}
                                                    className="w-full text-left cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 flex items-center gap-3"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                        {student.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="block truncate font-medium text-gray-700">{student.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Students Tags */}
                                {selectedStudents.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {selectedStudents.map(student => (
                                            <span
                                                key={student.id}
                                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                            >
                                                {student.name}
                                                <button
                                                    onClick={() => setSelectedStudents(selectedStudents.filter(s => s.id !== student.id))}
                                                    className="ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:bg-blue-500 focus:text-white focus:outline-none"
                                                >
                                                    <span className="sr-only">Remove {student.name}</span>
                                                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                                        <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                                                    </svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: CONTENT */}
                    <div className="space-y-4">
                        <div>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Título do Comunicado"
                                className="w-full text-lg font-bold placeholder:text-gray-300 border-b-2 border-gray-100 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                            />
                        </div>
                        <div className="relative">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={8}
                                placeholder="Escreva sua mensagem aqui... Use uma linguagem clara e objetiva para os pais."
                                className="w-full bg-gray-50 rounded-2xl border-none p-4 text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-100 resize-none transition-shadow"
                            />
                            <div className="absolute bottom-3 right-3 flex gap-2">
                                <button
                                    onClick={() => setPriority(priority === 1 ? 2 : 1)}
                                    className={`
                                        p-2 rounded-lg transition-colors
                                        ${priority === 2 ? 'bg-red-100 text-red-600' : 'bg-white text-gray-400 hover:bg-gray-100'}
                                    `}
                                    title={priority === 2 ? "Alta Prioridade" : "Prioridade Normal"}
                                >
                                    <AlertCircle size={18} />
                                </button>
                                <button className="p-2 bg-white text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                    <Icons.Paperclip size={18} />
                                </button>
                                <button className="p-2 bg-white text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                    <Sparkles size={18} />
                                </button>
                            </div>
                        </div>
                    </div>



                    {/* SECTION 4: INTERACTION (TEMPLATES) */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Icons.MousePointerClick size={14} /> Interatividade (Opcional)
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setInteractionType('NONE')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${interactionType === 'NONE' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                Apenas Leitura
                            </button>
                            <button
                                onClick={() => setInteractionType('RSVP')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${interactionType === 'RSVP' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                Check-in (Presença)
                            </button>
                            <button
                                onClick={() => setInteractionType('POLL')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${interactionType === 'POLL' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                Enquete / Votação
                            </button>
                        </div>

                        {/* CONFIGURATION FOR TEMPLATES */}
                        {interactionType === 'RSVP' && (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-fade-in">
                                <p className="text-sm text-blue-800 font-medium mb-1">✅ Configuração de RSVP</p>
                                <p className="text-xs text-blue-600">Os pais verão botões para confirmar se vão ou não ao evento.</p>
                            </div>
                        )}

                        {interactionType === 'POLL' && (
                            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 animate-fade-in space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-purple-800 uppercase mb-1">Pergunta da Enquete</label>
                                    <input
                                        type="text"
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                        placeholder="Ex: Qual dia é melhor para a reunião?"
                                        className="w-full border-purple-200 rounded-lg text-sm focus:border-purple-500 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-800 uppercase mb-1">Opções</label>
                                    {pollOptions.map((opt, idx) => (
                                        <input
                                            key={idx}
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...pollOptions];
                                                newOpts[idx] = e.target.value;
                                                setPollOptions(newOpts);
                                            }}
                                            placeholder={`Opção ${idx + 1}`}
                                            className="w-full border-purple-200 rounded-lg text-sm mb-2 focus:border-purple-500 focus:ring-purple-500"
                                        />
                                    ))}
                                    <button
                                        onClick={() => setPollOptions([...pollOptions, ''])}
                                        className="text-xs text-purple-600 font-bold hover:underline"
                                    >
                                        + Adicionar Opção
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                        {targetType === 'SCHOOL'
                            ? 'Enviando para todos os pais ativos.'
                            : targetType === 'CLASS'
                                ? `Enviando para ${selectedClasses.length} turmas selecionadas.`
                                : `Enviando para ${selectedStudents.length} alunos selecionados.`
                        }
                    </span>
                    <div className="flex gap-3">

                        <button
                            onClick={handleSend}
                            disabled={sending || !title || !content || (targetType === 'CLASS' && selectedClasses.length === 0) || (targetType === 'STUDENT' && selectedStudents.length === 0)}
                            className={`
                                group flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-white transition-all transform hover:-translate-y-1
                                ${sending || !title || !content || (targetType === 'CLASS' && selectedClasses.length === 0) || (targetType === 'STUDENT' && selectedStudents.length === 0)
                                    ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30'
                                }
                            `}
                        >
                            {sending ? <Loader2 className="animate-spin" /> : <Send size={20} className="group-hover:translate-x-1 transition-transform" />}
                            {sending ? 'Enviando...' : (targetType === 'CLASS' && selectedClasses.length === 0) || (targetType === 'STUDENT' && selectedStudents.length === 0) ? 'Selecione o Destino' : 'Confirmar Envio'}
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: PREVIEW */}
            <div className="w-full lg:w-[350px] shrink-0 animate-slide-in-right hidden lg:block">
                <div className="sticky top-8">
                    <div className="mb-4 flex items-center justify-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
                        <Icons.Smartphone size={14} /> Live Preview
                    </div>
                    <PhonePreview
                        channel={selectedChannel}
                        title={title}
                        content={content}
                        isSchoolWide={targetType === 'SCHOOL'}
                    />
                </div>
            </div>
        </div >
    );
};

export default CommunicationsComposer;
