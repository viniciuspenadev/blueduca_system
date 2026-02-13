import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { Button } from '../../../components/ui';
import {
    LayoutDashboard,
    Settings,
    CreditCard,
    Users,
    ArrowLeft,
    Shield,
    Lock,
    CheckCircle,
    XCircle,
    MessageSquare
} from 'lucide-react';

// Tabs Components
// Tabs Components
import {
    SchoolOverview,
    SchoolSettings,
    SchoolUsers,
    SchoolBilling,
    SchoolWhatsAppLogs
} from './tabs';

export const SchoolDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [school, setSchool] = useState<any>(null);
    const [limits, setLimits] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchSchoolDetails();
    }, [id]);

    const fetchSchoolDetails = async () => {
        try {
            // 1. Get School + Plan
            const { data: schoolData, error: schoolError } = await supabase
                .from('schools')
                .select('*, product_plans(name, config_modules, config_limits)')
                .eq('id', id)
                .single();

            if (schoolError) throw schoolError;
            setSchool(schoolData);

            // 2. Get Usage Trackers
            const { data: usageData } = await supabase
                .from('school_usage_trackers')
                .select('*')
                .eq('school_id', id)
                .maybeSingle();

            // 3. Get Real User Count (Broken down by Staff, Students, Guardians)
            const { data: userStats, error: userError } = await supabase
                .rpc('get_school_user_count', { school_id_param: id });

            if (userError) console.error('Error counting users:', userError);

            setLimits({
                ...(usageData || { messages_sent_count: 0, storage_used_bytes: 0 }),
                active_users_count: (userStats?.staff || 0) + (userStats?.guardians || 0), // Logins only
                staff_count: userStats?.staff || 0         // Keeping staff count if needed for future
            });
        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando Raio-X da Escola...</div>;
    if (!school) return <div className="p-8 text-center text-red-500">Escola não encontrada.</div>;

    const tabs = [
        { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
        { id: 'settings', label: 'Configurações', icon: Settings },
        { id: 'users', label: 'Usuários (Admin)', icon: Users },
        { id: 'billing', label: 'Financeiro', icon: CreditCard },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Hero */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="p-2" onClick={() => navigate('/sys/admin')}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl font-bold text-gray-400 capitalize overflow-hidden">
                        {school.logo_url ? <img src={school.logo_url} className="w-full h-full object-cover" /> : school.name[0]}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span className="font-mono bg-gray-50 px-2 py-0.5 rounded text-xs select-all">ID: {school.id}</span>
                            <span className="flex items-center gap-1">
                                {school.active ? (
                                    <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        <CheckCircle size={12} /> Ativa
                                    </span>
                                ) : (
                                    <span className="text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        <XCircle size={12} /> Suspensa
                                    </span>
                                )}
                            </span>
                            <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-xs font-bold border border-brand-100">
                                {school.product_plans?.name || 'Sem Plano'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-200">
                        <Lock size={16} className="mr-2" />
                        Bloquear
                    </Button>
                    <Button variant="primary" className="bg-brand-600 hover:bg-brand-700">
                        <Shield size={16} className="mr-2" />
                        Acessar Painel
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                                    ${isActive
                                        ? 'border-brand-500 text-brand-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                `}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && <SchoolOverview school={school} limits={limits} />}
                {activeTab === 'settings' && <SchoolSettings school={school} />}
                {activeTab === 'users' && <SchoolUsers school={school} />}
                {activeTab === 'billing' && <SchoolBilling school={school} />}
                {activeTab === 'whatsapp' && <SchoolWhatsAppLogs school={school} />}
            </div>
        </div>
    );
};
