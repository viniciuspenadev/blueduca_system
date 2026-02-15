import { type FC, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    Star,
    Loader2,
    CheckCircle,
    Info,
    School,
    MessageSquare,
    DollarSign,
    Users,
    Calendar,
    CalendarDays,
    BookOpen,
    Clock,
    FileText,
    Settings
} from 'lucide-react';


// Import existing settings components
import { SchoolInfoSettings } from './SchoolInfoSettings';
import { CommunicationSettings } from './CommunicationSettings';
import { FinancialSettingsTab } from './FinancialSettingsTab';
import { AcademicYearsSettings } from './AcademicYearsSettings';
import { AssessmentPeriodsSettings } from './AssessmentPeriodsSettings';
import { SubjectCatalog } from './SubjectCatalog';
import { SystemBehaviorSettings } from './SystemBehaviorSettings';
import { TimelineSettings } from './TimelineSettings';
import { EnrollmentDocsSettings } from './EnrollmentDocsSettings';
import { UserManagement } from '../UserManagement';
import { PlanLimitsCard } from './PlanLimitsCard';
import { PlanUsageChart } from './PlanUsageChart';

export const SchoolConfigHub: FC = () => {
    const { currentSchool } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);

    // URL Params Sync
    const tabParam = searchParams.get('tab') || 'school';

    const [activeTab, setActiveTab] = useState(tabParam);

    // Config Modules from School Table (Provisioning - READ ONLY)
    const [provisionedModules, setProvisionedModules] = useState<any>({});

    // Sync state with URL changes
    useEffect(() => {
        setActiveTab(tabParam);
    }, [tabParam]);

    useEffect(() => {
        if (currentSchool) {
            setProvisionedModules(currentSchool.config_modules || {});
            setLoading(false);
        }
    }, [currentSchool]);

    const configTabs = [
        { id: 'school', label: 'Escola', icon: School },
        { id: 'plan', label: 'Plano', icon: Star },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        { id: 'finance', label: 'Financeiro', icon: DollarSign },
        { id: 'users', label: 'Usuários', icon: Users },
        { id: 'acad_general', label: 'Agendas', icon: Settings },
        { id: 'acad_years', label: 'Anos Letivos', icon: Calendar },
        { id: 'acad_periods', label: 'Períodos de Avaliação', icon: CalendarDays },
        { id: 'acad_subjects', label: 'Matérias', icon: BookOpen },
        { id: 'acad_timelines', label: 'Rotinas', icon: Clock },
        { id: 'acad_docs', label: 'Documentos', icon: FileText },
    ];

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="animate-fade-in pb-20">
            {/* Top Navigation Bar - Better for Mobile and Quick Switching */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                {configTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setSearchParams({ tab: tab.id })}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap border
                                ${active
                                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-100'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                }
                            `}
                        >
                            <tab.icon size={18} strokeWidth={active ? 2.5 : 2} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content Area - Now occupying full width */}
            <main className="bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[600px] p-6 lg:p-10">

                {/* INSTITUCIONAL */}
                {activeTab === 'school' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Dados da Escola</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Informações básicas e identidade visual da instituição.</p>
                        <SchoolInfoSettings />
                    </div>
                )}

                {activeTab === 'plan' && (
                    <div className="animate-fade-in max-w-7xl">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                            <Star className="w-7 h-7 text-brand-600" />
                            Meu Plano
                        </h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Módulos contratados e status da conta.</p>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column: Stats & Charts */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Liites do Plano */}
                                <PlanLimitsCard />

                                {/* Gráfico de Uso */}
                                <PlanUsageChart />

                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                                    <p className="text-gray-600">
                                        Seu plano atual é <span className="font-bold text-gray-900">{currentSchool?.product_plans?.name || 'Personalizado'}</span>.
                                        <br />Para ativar novos módulos, entre em contato com nosso suporte.
                                    </p>
                                </div>
                            </div>

                            {/* Right Column: Modules List */}
                            <div className="space-y-4">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Módulos Conectados</h3>
                                    <div className="space-y-3">
                                        {[
                                            { id: 'finance', label: 'Financeiro Manual', desc: 'Controle de parcelas e faturamento interno.' },
                                            { id: 'finance_asaas', label: 'Financeiro Asaas', desc: 'Emissão de boletos, Pix e automação bancária.' },
                                            { id: 'whatsapp', label: 'WhatsApp', desc: 'Envio de notificações automáticas via Evolution.' },
                                            { id: 'dunning', label: 'Régua de Cobrança', desc: 'Automação de notificações financeiras inteligentes.' },
                                            { id: 'communications', label: 'Mensagens (App)', desc: 'Envio de comunicados e notificações.' },
                                            { id: 'crm', label: 'CRM & Captação', desc: 'Gestão de leads e matrículas.' },
                                            { id: 'menu', label: 'Cardápio Escolar', desc: 'Divulgação de alimentação semanal.' },
                                            { id: 'library', label: 'Biblioteca', desc: 'Gestão de acervo e empréstimos.' },
                                            { id: 'inventory', label: 'Estoque', desc: 'Controle de almoxarifado.' },
                                            { id: 'academic', label: 'Gestão Acadêmica', desc: 'Boletins, turmas e matrículas.' }
                                        ].map(mod => {
                                            const isProv = provisionedModules[mod.id];
                                            return (
                                                <div key={mod.id} className={`flex items-start justify-between p-4 rounded-xl border ${isProv ? 'bg-white border-green-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-75'}`}>
                                                    <div>
                                                        <h4 className={`font-semibold text-sm ${isProv ? 'text-gray-900' : 'text-gray-500'}`}>{mod.label}</h4>
                                                        <p className="text-xs text-gray-500 mt-0.5">{mod.desc}</p>
                                                    </div>
                                                    <div className="mt-1">
                                                        {isProv ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                                                <CheckCircle size={12} />
                                                                Ativo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-500 text-xs font-bold">
                                                                Não Incluso
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* INTEGRAÇÕES */}
                {activeTab === 'whatsapp' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">WhatsApp</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Configurações de integração para mensagens automáticas.</p>
                        <CommunicationSettings
                            embedded={true}
                            isProvisioned={!!provisionedModules['whatsapp']}
                        />
                    </div>
                )}

                {activeTab === 'finance' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Configurações Financeiras</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Emissão de boletos, taxas e integração com gateway.</p>
                        <FinancialSettingsTab
                            isProvisioned={!!provisionedModules['finance']}
                            isAsaasProvisioned={!!provisionedModules['finance_asaas']}
                            hasWhatsapp={!!provisionedModules['whatsapp']}
                        />
                    </div>
                )}

                {/* ACADÊMICO */}
                {activeTab === 'acad_general' && (
                    <div className="animate-fade-in space-y-6 max-w-4xl">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Liberação de Agendas</h2>
                            <p className="text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100">Defina comportamentos globais e horários de funcionamento.</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl h-fit text-blue-600 shadow-sm">
                                <Info className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-blue-900">Importante</h3>
                                <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                                    As regras definidas aqui impactam diretamente o comportamento das rotinas diárias e o fechamento de agendas em todas as turmas.
                                </p>
                            </div>
                        </div>
                        <SystemBehaviorSettings isProvisioned={!!provisionedModules['academic']} />
                    </div>
                )}

                {activeTab === 'acad_years' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Anos Letivos</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Gestão de calendários e períodos escolares.</p>
                        <AcademicYearsSettings />
                    </div>
                )}

                {activeTab === 'acad_periods' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Períodos de Avaliação</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Configure os períodos para lançamento de notas e avaliações.</p>
                        <AssessmentPeriodsSettings />
                    </div>
                )}

                {activeTab === 'acad_subjects' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Catálogo de Matérias</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Lista mestre de matérias oferecidas pela escola.</p>
                        <SubjectCatalog />
                    </div>
                )}

                {activeTab === 'acad_timelines' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Rotinas Diárias</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Configuração de cards e atividades do diário escolar.</p>
                        <TimelineSettings />
                    </div>
                )}

                {activeTab === 'acad_docs' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Documentos de Matrícula</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Documentação obrigatória para matrícula de alunos.</p>
                        <EnrollmentDocsSettings />
                    </div>
                )}

                {/* ACESSO */}
                {activeTab === 'users' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Usuários & Permissões</h2>
                        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">Gestão de acessos da equipe e responsáveis.</p>
                        <UserManagement embedded={true} />
                    </div>
                )}

            </main>
        </div>
    );
};
