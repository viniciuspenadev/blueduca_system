import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import { LeadsCalendar } from './LeadsCalendar';
import { LeadDetailsModal } from './LeadDetailsModal';
import { CreateLeadModal } from './CreateLeadModal';
import { Filter, Search, Plus, LayoutGrid, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface LeadCard {
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
    source: string;
    email?: string;
    phone?: string;
    visit_date?: string;
    lead_children?: { count: number }[];
}

const COLUMNS = [
    { id: 'new', title: 'Novos', emoji: '🆕', color: 'bg-blue-50 border-blue-100' },
    { id: 'qualifying', title: 'Em Qualificação', emoji: '💬', color: 'bg-yellow-50 border-yellow-100' },
    { id: 'scheduled', title: 'Visita Agendada', emoji: '📅', color: 'bg-purple-50 border-purple-100' },
    // Removed 'waiting' as requested
    { id: 'converted', title: 'Matriculados', emoji: '✅', color: 'bg-green-50 border-green-100' },
    { id: 'lost', title: 'Perdidos', emoji: '❌', color: 'bg-gray-50 border-gray-100' },
];

export const LeadsKanban: React.FC = () => {
    const [leads, setLeads] = useState<LeadCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');

    const { currentSchool } = useAuth();

    // KPI Calculations
    const today = new Date().toISOString().split('T')[0];
    const newLeadsToday = leads.filter(l => l.created_at.startsWith(today)).length;

    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status === 'converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    const stalledLeads = leads.filter(l => {
        if (['converted', 'lost', 'new'].includes(l.status)) return false;
        const lastUpdate = new Date(l.updated_at || l.created_at);
        const diffDays = Math.floor((new Date().getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));
        return diffDays > 3;
    }).length;

    // Filter Logic
    const filteredLeads = leads.filter(lead => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            lead.name.toLowerCase().includes(searchLower) ||
            (lead.email && lead.email.toLowerCase().includes(searchLower))
        );
    });

    useEffect(() => {
        if (currentSchool?.id) {
            fetchLeads();
        }
    }, [currentSchool?.id]);

    const fetchLeads = async () => {
        if (!currentSchool) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('leads')
            .select('id, name, status, created_at, updated_at, source, email, phone, visit_date, lead_children(count)')
            .eq('school_id', currentSchool.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching leads:', error);
        }

        setLeads(data || []);
        setLoading(false);
    };

    const handleDragStart = (e: React.DragEvent, leadId: string) => {
        e.dataTransfer.setData('leadId', leadId);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData('leadId');
        if (!leadId) return;

        // Optimistic Update
        const timestamp = new Date().toISOString();
        const updatedLeads = leads.map(l => l.id === leadId ? { ...l, status: newStatus, updated_at: timestamp } : l);
        setLeads(updatedLeads);

        // Backend Update
        await supabase.from('leads').update({ status: newStatus, updated_at: timestamp }).eq('id', leadId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Helper functions for Cards
    const openWhatsApp = (e: React.MouseEvent, phone?: string) => {
        e.stopPropagation();
        if (!phone) return;
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const isStalled = (lead: LeadCard) => {
        if (['converted', 'lost', 'new'].includes(lead.status)) return false;
        const lastUpdate = new Date(lead.updated_at || lead.created_at);
        const diffDays = Math.floor((new Date().getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));
        return diffDays > 3;
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col bg-gray-50 p-6 overflow-hidden w-full max-w-full">
            {/* KPI Header - Gestão à Vista */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 shrink-0">
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Novos Hoje</p>
                        <h3 className="text-2xl font-bold text-gray-800">{newLeadsToday}</h3>
                    </div>
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                        <span className="text-xl">🆕</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Taxa de Conversão</p>
                        <h3 className="text-2xl font-bold text-gray-800">{conversionRate}%</h3>
                    </div>
                    <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                        <span className="text-xl">📈</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Atenção (Parados +3d)</p>
                        <h3 className={`text-2xl font-bold ${stalledLeads > 0 ? 'text-orange-600' : 'text-gray-800'}`}>{stalledLeads}</h3>
                    </div>
                    <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
                        <span className="text-xl">⚠️</span>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        CRM de Matrículas <span className="text-sm font-normal text-gray-400 bg-white px-2 py-1 rounded-md border shadow-sm">{filteredLeads.length} Leads</span>
                    </h1>
                    <p className="text-gray-500 text-sm">Gerencie o funil de vendas e conversão de novos alunos</p>
                </div>

                <div className="flex gap-3">
                    {/* View Switcher */}
                    <div className="bg-white border border-gray-200 p-1 rounded-lg flex items-center shadow-sm">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Visualização Kanban"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Visualização Calendário"
                        >
                            <CalendarIcon size={18} />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar lead..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all w-64"
                        />
                    </div>

                    <button className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Filter size={18} /> Filtros
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">
                        <Plus size={18} /> Novo Lead
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden w-full min-w-0 flex flex-col">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : viewMode === 'calendar' ? (
                    <LeadsCalendar leads={filteredLeads} onLeadClick={setSelectedLeadId} />
                ) : (
                    /* Kanban Board Container with horizontal scroll fix */
                    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 w-full">
                        <div className="flex gap-4 h-full min-w-fit px-1">
                            {COLUMNS.map(col => (
                                <div
                                    key={col.id}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    onDragOver={handleDragOver}
                                    className={`flex-1 flex flex-col rounded-xl border ${col.color.replace('bg-', 'bg-opacity-30 ')} min-w-[280px] max-w-[320px] transition-colors hover:bg-opacity-50`}
                                >
                                    {/* Column Header */}
                                    <div className={`p-4 border-b border-gray-100/50 flex justify-between items-center ${col.color} bg-opacity-40 rounded-t-xl`}>
                                        <span className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                                            <span className="text-lg">{col.emoji}</span> {col.title}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-500 bg-white/50 px-2 py-0.5 rounded-full">
                                            {filteredLeads.filter(l => l.status === col.id).length}
                                        </span>
                                    </div>

                                    {/* Cards Container */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                        {filteredLeads.filter(l => l.status === col.id).map(lead => {
                                            const stalled = isStalled(lead);
                                            const date = new Date(lead.created_at).toLocaleDateString('pt-BR');

                                            return (
                                                <div
                                                    key={lead.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, lead.id)}
                                                    onClick={() => setSelectedLeadId(lead.id)}
                                                    className={`
                                                        bg-white p-4 rounded-lg shadow-sm border cursor-pointer 
                                                        hover:shadow-md active:cursor-grabbing group transition-all relative
                                                        ${stalled ? 'border-l-4 border-l-red-400 border-y-gray-100 border-r-gray-100' : 'border-gray-100 hover:border-blue-200'}
                                                    `}
                                                >
                                                    {/* Source Badge */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide
                                                            ${lead.source === 'lp' ? 'bg-indigo-50 text-indigo-600' :
                                                                lead.source === 'referral' ? 'bg-purple-50 text-purple-600' :
                                                                    'bg-gray-100 text-gray-500'}`
                                                        }>
                                                            {lead.source === 'lp' ? 'Landing Page' : lead.source}
                                                        </span>

                                                        {/* Stalled Warning Icon */}
                                                        {stalled && (
                                                            <span title="Lead parado há +3 dias" className="text-red-500 text-xs animate-pulse">⚠️</span>
                                                        )}
                                                    </div>

                                                    <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors mb-1">
                                                        {lead.name}
                                                    </h4>

                                                    <div className="flex items-center justify-between mt-3">
                                                        <div className="flex flex-col gap-1.5 w-full">
                                                            <div className="flex items-center justify-between w-full">
                                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                                    📅 {date}
                                                                </p>
                                                                {lead.lead_children?.[0]?.count ? (
                                                                    <span className="bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" title={`${lead.lead_children[0].count} filho(s)`}>
                                                                        👶 {lead.lead_children[0].count}
                                                                    </span>
                                                                ) : null}
                                                            </div>

                                                            {lead.visit_date && (
                                                                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit flex items-center gap-1 ${getVisitStatus(lead.visit_date).color}`}>
                                                                    {getVisitStatus(lead.visit_date).icon}
                                                                    {getVisitStatus(lead.visit_date).label}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quick Actions (WhatsApp) - Visible on Group Hover */}
                                                        {lead.phone && (
                                                            <button
                                                                onClick={(e) => openWhatsApp(e, lead.phone)}
                                                                className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-green-50 text-green-600 p-1.5 rounded-full hover:bg-green-100 shadow-sm"
                                                                title="Abrir WhatsApp"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedLeadId && (
                <LeadDetailsModal
                    leadId={selectedLeadId}
                    onClose={() => setSelectedLeadId(null)}
                    onUpdate={fetchLeads}
                />
            )}

            {isCreateModalOpen && (
                <CreateLeadModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={fetchLeads}
                />
            )}
        </div>
    );
};

// Helper function for Visit Status Badge
function getVisitStatus(dateString: string) {
    const visitDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    visitDate.setHours(0, 0, 0, 0);

    const diffTime = visitDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: `Atrasada (${Math.abs(diffDays)}d)`, color: 'bg-red-100 text-red-700 border border-red-200', icon: '⏰' };
    }
    if (diffDays === 0) {
        return { label: 'Visita Hoje!', color: 'bg-green-100 text-green-700 border border-green-200 animate-pulse', icon: '📍' };
    }
    if (diffDays === 1) {
        return { label: 'É Amanhã!', color: 'bg-blue-100 text-blue-700 border border-blue-200', icon: '🔜' };
    }
    if (diffDays <= 7) {
        return { label: `Faltam ${diffDays} dias`, color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: '🗓️' };
    }
    return { label: new Date(dateString).toLocaleDateString('pt-BR'), color: 'bg-gray-100 text-gray-600 border border-gray-200', icon: '📅' };
}
