import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { X, Phone, MessageCircle, Mail, Calendar, CheckCircle, User, FileText, Send, Clock, Baby } from 'lucide-react';
import { useConfirm } from '../../../contexts/ConfirmContext';

interface Lead {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    source: string;
    notes: string | null;
    created_at: string;
    visit_date?: string | null;
}

interface LeadChild {
    id: string;
    name: string;
    intended_grade: string;
    birth_date: string | null;
}

interface Interaction {
    id: string;
    type: string;
    content: string;
    created_at: string;
    created_by_profile?: { name: string };
}

interface LeadDetailsModalProps {
    leadId: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ leadId, onClose, onUpdate }) => {
    const navigate = useNavigate();
    const { confirm } = useConfirm();
    const [lead, setLead] = useState<Lead | null>(null);
    const [children, setChildren] = useState<LeadChild[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [newNote, setNewNote] = useState('');

    // Fetch Data
    useEffect(() => {
        fetchLeadDetails();
    }, [leadId]);

    const fetchLeadDetails = async () => {
        setLoading(true);
        // 1. Get Lead
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', leadId).single();
        setLead(leadData);

        // 2. Get Children
        const { data: childrenData } = await supabase.from('lead_children').select('*').eq('lead_id', leadId);
        setChildren(childrenData || []);

        // 3. Get Interactions
        const { data: interactionData } = await supabase
            .from('lead_interactions')
            .select('*, created_by_profile:profiles(name)')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });
        setInteractions(interactionData || []);

        setLoading(false);
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!lead) return;
        await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
        setLead({ ...lead, status: newStatus });
        onUpdate();
    };

    const handleAddInteraction = async (type: string, content: string) => {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('lead_interactions').insert({
            lead_id: leadId,
            type,
            content,
            created_by: user.id
        });

        setNewNote('');
        fetchLeadDetails(); // Refresh timeline
    };

    const handleScheduleVisit = async (dateTime: string) => {
        if (!lead) return;

        // Update Lead with Visit Date and Status to Scheduled
        const { error } = await supabase
            .from('leads')
            .update({
                visit_date: dateTime,
                status: 'scheduled',
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);

        if (error) {
            console.error('Error scheduling visit:', error);
            alert('Erro ao agendar visita.');
            return;
        }

        setLead({ ...lead, visit_date: dateTime, status: 'scheduled' });

        // Log interaction automatically
        await handleAddInteraction('meeting', `Agendou visita para ${new Date(dateTime).toLocaleString('pt-BR')}`);
        onUpdate();
    };

    const handleConvertChild = (child: LeadChild) => {
        if (!lead) return;
        // Redirect to Enrollment Create with pre-filled data
        const params = new URLSearchParams({
            name: child.name,
            parentEmail: lead.email || '',
            leadId: lead.id,
            childId: child.id
        });
        navigate(`/matriculas/nova?${params.toString()}`);
    };

    const handleStartEnrollment = async () => {
        if (!lead) return;

        const isConfirmed = await confirm({
            title: 'Iniciar Matrícula',
            message: `Deseja realmente iniciar o processo de matrícula para ${lead.name}?`,
            confirmText: 'Sim, iniciar',
            type: 'success'
        });

        if (!isConfirmed) return;

        // If has children, default to the first one for now or just generic start
        if (children.length > 0) {
            handleConvertChild(children[0]);
        } else {
            // Generic start without child pre-filled
            const params = new URLSearchParams({
                parentEmail: lead.email || '',
                leadId: lead.id
            });
            navigate(`/matriculas/nova?${params.toString()}`);
        }
    };

    if (!lead && !loading) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

                {loading ? (
                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    {lead!.name}
                                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(lead!.status)}`}>
                                        {getStatusLabel(lead!.status)}
                                    </span>
                                </h2>
                                <p className="text-sm text-gray-500">Criado em {new Date(lead!.created_at).toLocaleDateString()}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">

                            {/* LEFT COLUMN: Info & Actions */}
                            <div className="p-6 md:w-1/3 border-r border-gray-100 space-y-6 bg-white shrink-0">

                                {/* Quick Actions */}
                                <div className="flex gap-2">
                                    <a href={`https://wa.me/55${lead!.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                        className="flex-1 bg-green-50 text-green-600 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-100 transition-colors cursor-pointer border border-green-200"
                                        onClick={() => handleAddInteraction('whatsapp', 'Iniciou conversa no WhatsApp')}>
                                        <MessageCircle size={18} /> WhatsApp
                                    </a>
                                    <a href={`tel:${lead!.phone}`}
                                        className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200"
                                        onClick={() => handleAddInteraction('call', 'Realizou ligação')}>
                                        <Phone size={18} /> Ligar
                                    </a>
                                </div>

                                {/* Schedule Visit */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Agendar Visita</label>
                                    <div className="flex items-center gap-2 bg-purple-50 p-2 rounded-lg border border-purple-200">
                                        <Calendar size={18} className="text-purple-600" />
                                        <input
                                            type="datetime-local"
                                            className="bg-transparent border-none outline-none text-sm text-purple-700 w-full"
                                            value={lead!.visit_date ? new Date(lead!.visit_date).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => handleScheduleVisit(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Status Selector */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status do Pipeline</label>
                                    <select
                                        value={lead!.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className="w-full mt-2 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="new">🆕 Novo</option>
                                        <option value="qualifying">💬 Em Qualificação</option>
                                        <option value="scheduled">📅 Visita Agendada</option>
                                        <option value="converted">✅ Matriculado</option>
                                        <option value="lost">❌ Perdido</option>
                                    </select>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-700 flex items-center gap-2"><User size={16} /> Contato</h3>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p className="flex items-center gap-2"><Mail size={14} /> {lead!.email || 'Sem email'}</p>
                                        <p className="flex items-center gap-2"><Phone size={14} /> {lead!.phone || 'Sem telefone'}</p>
                                    </div>
                                </div>

                                {/* Children */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Baby size={16} /> Filhos ({children.length})</h3>
                                    <div className="space-y-2">
                                        {children.map(child => (
                                            <div key={child.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm group hover:border-blue-200 transition-all">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-medium text-gray-800">{child.name}</p>
                                                        <p className="text-gray-500 text-xs">{child.intended_grade} • {child.birth_date ? new Date(child.birth_date).toLocaleDateString() : 'Sem data'}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleConvertChild(child)}
                                                        className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-colors text-xs font-medium"
                                                        title="Matricular este aluno"
                                                    >
                                                        Matricular
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Convert Button - Main */}
                                <div className="pt-4 border-t border-gray-100">
                                    <button
                                        onClick={handleStartEnrollment}
                                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                                        <CheckCircle size={18} />
                                        Iniciar Matrícula
                                    </button>
                                </div>

                            </div>

                            {/* RIGHT COLUMN: Timeline & Interactions */}
                            <div className="p-6 md:w-2/3 bg-gray-50/30 flex flex-col">
                                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><FileText size={18} /> Histórico de Interações</h3>

                                {/* Input Note */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Adicione uma nota interna ou resumo da conversa..."
                                        className="w-full resize-none outline-none text-sm min-h-[80px]"
                                    />
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                                        <div className="flex gap-2 text-gray-400">
                                            <button className="hover:text-blue-500" title="Log Call" onClick={() => handleAddInteraction('call', 'Tentativa de contato telefônico')}><Phone size={16} /></button>
                                            <button className="hover:text-green-500" title="Log WhatsApp" onClick={() => handleAddInteraction('whatsapp', 'Enviou mensagem WhatsApp')}><MessageCircle size={16} /></button>
                                        </div>
                                        <button
                                            onClick={() => newNote.trim() && handleAddInteraction('note', newNote)}
                                            disabled={!newNote.trim()}
                                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                                            Salvar Nota <Send size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Timeline Feed */}
                                <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                                    {interactions.length === 0 && (
                                        <p className="text-center text-gray-400 py-8 text-sm">Nenhuma interação registrada ainda.</p>
                                    )}

                                    {interactions.map(interaction => (
                                        <div key={interaction.id} className="flex gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getInteractionColor(interaction.type)}`}>
                                                {getInteractionIcon(interaction.type)}
                                            </div>
                                            <div>
                                                <div className="bg-white p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm border border-gray-100">
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{interaction.content}</p>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 ml-1 text-xs text-gray-400">
                                                    <span>{interaction.created_by_profile?.name || 'Sistema'}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(interaction.created_at).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Utils
function getStatusColor(status: string) {
    const map: Record<string, string> = {
        new: 'bg-blue-50 border-blue-200 text-blue-700',
        qualifying: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        scheduled: 'bg-purple-50 border-purple-200 text-purple-700',
        waiting: 'bg-orange-50 border-orange-200 text-orange-700',
        converted: 'bg-green-50 border-green-200 text-green-700',
        lost: 'bg-gray-50 border-gray-200 text-gray-500'
    };
    return map[status] || 'bg-gray-50 border-gray-200 text-gray-500';
}

function getStatusLabel(status: string) {
    const map: Record<string, string> = {
        new: 'Novo',
        qualifying: 'Em Qualificação',
        scheduled: 'Visita Agendada',
        waiting: 'Aguardando Matrícula',
        converted: 'Matriculado',
        lost: 'Perdido'
    };
    return map[status] || status;
}

function getInteractionColor(type: string) {
    switch (type) {
        case 'call': return 'bg-blue-100 text-blue-600';
        case 'whatsapp': return 'bg-green-100 text-green-600';
        case 'email': return 'bg-indigo-100 text-indigo-600';
        case 'meeting': return 'bg-purple-100 text-purple-600';
        default: return 'bg-gray-100 text-gray-600';
    }
}

function getInteractionIcon(type: string) {
    switch (type) {
        case 'call': return <Phone size={14} />;
        case 'whatsapp': return <MessageCircle size={14} />;
        case 'email': return <Mail size={14} />;
        case 'meeting': return <Calendar size={14} />;
        default: return <FileText size={14} />;
    }
}
